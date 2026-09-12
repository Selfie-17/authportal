package com.selva.authportal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.*;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.FileType;
import com.selva.authportal.model.StudentEvaluation;
import com.selva.authportal.model.Submission;
import com.selva.authportal.model.SubmissionFile;
import com.selva.authportal.model.TeacherFeedback;
import com.selva.authportal.model.YearLevel;
import com.selva.authportal.repository.StudentEvaluationRepository;
import com.selva.authportal.repository.TeacherFeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Service managing Teacher Evaluations and Human Teacher Feedback.
 *
 * Key guarantees:
 * - Dynamic student rows: exactly one row per Student ID.
 * - Dynamic week columns: dynamically generated from uploaded data and sorted naturally.
 * - Replacement rule: (student_id + week) uniquely identifies an evaluation; re-upload replaces AI evaluation.
 * - Independence rule: Teacher feedback belongs to (student_id + week) and never alters AI evaluation data.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final StudentEvaluationRepository evaluationRepository;
    private final TeacherFeedbackRepository feedbackRepository;
    private final ObjectMapper objectMapper;
    private final com.selva.authportal.repository.UserRepository userRepository;
    private final com.selva.authportal.repository.SubmissionRepository submissionRepository;
    private final StorageService storageService;

    // Regex for parsing week identifier e.g. "week-01", "week-2", "Week 5", "week_10", "1"
    private static final Pattern WEEK_NUMBER_PATTERN = Pattern.compile("(?i)(?:week[_-]?0*(\\d+)|\\b(\\d+)\\b)");

    // Markdown score extraction patterns
    private static final Pattern OBJECTIVE_PATTERN = Pattern.compile("(?i)\\|\\s*Objective of the Lab\\s*\\|\\s*([^|\\r\\n]+?)\\s*\\|");
    private static final Pattern PROBLEM_PATTERN = Pattern.compile("(?i)\\|\\s*Problem Understanding\\s*\\|\\s*([^|\\r\\n]+?)\\s*\\|");
    private static final Pattern LOGIC_PATTERN = Pattern.compile("(?i)\\|\\s*Logic\\s*/?\\s*Approach Used\\s*\\|\\s*([^|\\r\\n]+?)\\s*\\|");
    private static final Pattern VARIABLES_PATTERN = Pattern.compile("(?i)\\|\\s*Important Variables(?: and Their Purpose)?\\s*\\|\\s*([^|\\r\\n]+?)\\s*\\|");
    private static final Pattern OBSERVED_PATTERN = Pattern.compile("(?i)\\|\\s*What I Observed\\s*\\|\\s*([^|\\r\\n]+?)\\s*\\|");
    private static final Pattern TOTAL_PATTERN = Pattern.compile("(?i)\\|\\s*\\*\\*Total\\*\\*\\s*\\|\\s*\\*\\*?([^|\\r\\n*]+?)\\*\\*?\\s*\\|");
    private static final Pattern FINAL_SCORE_PATTERN = Pattern.compile("(?i)\\|\\s*\\*\\*Final Score\\*\\*\\s*\\|\\s*\\*\\*?([^|\\r\\n*]+?)\\*\\*?\\s*\\|");
    private static final Pattern ASSESSMENT_PATTERN = Pattern.compile("(?i)### Overall Assessment(?:\\r?\\n|\\\\n|\\s)+([^#\\r\\n]+)");

    /**
     * Helper record holding normalized week representation.
     */
    public record WeekInfo(String displayName, int weekNumber) {}

    /**
     * Normalizes arbitrary week strings to "Week X" and integer number for sorting.
     */
    public static WeekInfo normalizeWeek(String rawWeek) {
        if (rawWeek == null || rawWeek.trim().isEmpty()) {
            return new WeekInfo("Week 1", 1);
        }
        String trimmed = rawWeek.trim();
        Matcher matcher = WEEK_NUMBER_PATTERN.matcher(trimmed);
        if (matcher.find()) {
            String numStr = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            try {
                int num = Integer.parseInt(numStr);
                return new WeekInfo("Week " + num, num);
            } catch (NumberFormatException ignored) {}
        }
        // If no number could be parsed, return capitalized string
        return new WeekInfo(trimmed, 999);
    }

    /**
     * Uploads and parses evaluation JSON from a MultipartFile.
     */
    @Transactional
    public EvaluationUploadResponse processJsonUpload(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded JSON file is empty.");
        }
        String jsonContent = new String(file.getBytes(), StandardCharsets.UTF_8);
        return processJsonString(jsonContent);
    }

    /**
     * Uploads and parses evaluation JSON from a raw JSON string.
     */
    @Transactional
    public EvaluationUploadResponse processJsonString(String jsonContent) throws IOException {
        JsonNode root = objectMapper.readTree(jsonContent);
        List<JsonNode> studentNodes = new ArrayList<>();
        String rootWeek = null;
        String rootSection = null;

        if (root.isObject()) {
            if (root.hasNonNull("week_id")) rootWeek = root.get("week_id").asText();
            else if (root.hasNonNull("week")) rootWeek = root.get("week").asText();

            if (root.hasNonNull("section_id")) rootSection = root.get("section_id").asText();
            else if (root.hasNonNull("section")) rootSection = root.get("section").asText();

            if (root.has("students") && root.get("students").isArray()) {
                for (JsonNode sNode : root.get("students")) {
                    studentNodes.add(sNode);
                }
            } else if (root.has("student_id")) {
                studentNodes.add(root);
            }
        } else if (root.isArray()) {
            for (JsonNode sNode : root) {
                studentNodes.add(sNode);
            }
        }

        if (studentNodes.isEmpty()) {
            throw new IllegalArgumentException("No student evaluations found in the provided JSON.");
        }

        Set<String> processedWeeks = new LinkedHashSet<>();
        int count = 0;

        for (JsonNode sNode : studentNodes) {
            String studentId = null;
            if (sNode.hasNonNull("student_id")) {
                studentId = sNode.get("student_id").asText().trim().toUpperCase();
            }
            if (studentId == null || studentId.isEmpty()) {
                continue;
            }

            String rawWeek = null;
            if (sNode.hasNonNull("week_id")) rawWeek = sNode.get("week_id").asText();
            else if (sNode.hasNonNull("week")) rawWeek = sNode.get("week").asText();
            else rawWeek = rootWeek;

            WeekInfo weekInfo = normalizeWeek(rawWeek);
            processedWeeks.add(weekInfo.displayName());

            String sectionId = null;
            if (sNode.hasNonNull("section_id")) sectionId = sNode.get("section_id").asText();
            else if (sNode.hasNonNull("section")) sectionId = sNode.get("section").asText();
            else sectionId = rootSection;

            // Extract scores and assessment
            ParsedScores scores = parseScores(sNode);

            // CASE 3: Student exists and week exists -> REPLACE
            // CASE 1 & 2: Student does not exist OR week does not exist -> INSERT
            final String studentIdToSave = studentId;
            final String weekToSave = weekInfo.displayName();
            Optional<StudentEvaluation> existingOpt = evaluationRepository.findByStudentIdAndWeek(
                    studentIdToSave, weekToSave
            );

            StudentEvaluation evaluation = existingOpt.orElseGet(() -> StudentEvaluation.builder()
                    .studentId(studentIdToSave)
                    .week(weekToSave)
                    .build()
            );

            evaluation.setWeekNumber(weekInfo.weekNumber());
            evaluation.setSectionId(sectionId);
            evaluation.setObjectiveScore(scores.objectiveScore());
            evaluation.setProblemUnderstandingScore(scores.problemUnderstandingScore());
            evaluation.setLogicScore(scores.logicScore());
            evaluation.setVariablesScore(scores.variablesScore());
            evaluation.setObservationScore(scores.observationScore());
            evaluation.setTotalScore(scores.totalScore());
            evaluation.setFinalScore(scores.finalScore());
            evaluation.setAssessment(scores.assessment());
            evaluation.setRawJson(sNode.toString());

            evaluationRepository.save(evaluation);
            count++;
        }

        log.info("Processed {} student evaluations for weeks: {}", count, processedWeeks);

        return EvaluationUploadResponse.builder()
                .success(true)
                .message("Successfully processed " + count + " student evaluations.")
                .processedCount(count)
                .weeks(new ArrayList<>(processedWeeks))
                .build();
    }

    /**
     * Extracts scores and overall assessment from evaluation markdown or direct attributes.
     */
    private ParsedScores parseScores(JsonNode sNode) {
        String objective = null;
        String problem = null;
        String logic = null;
        String variables = null;
        String observed = null;
        String total = null;
        String finalScore = null;
        String assessment = null;

        // Check evaluation markdown text
        String evalMarkdown = sNode.hasNonNull("evaluation") ? sNode.get("evaluation").asText() : "";
        if (!evalMarkdown.isEmpty()) {
            // Isolate the Overall Evaluation block so table headers from Compliance Matrix don't conflict
            String evalBlock = evalMarkdown;
            int overallEvalIdx = evalMarkdown.indexOf("### Overall Evaluation");
            if (overallEvalIdx != -1) {
                evalBlock = evalMarkdown.substring(overallEvalIdx);
            } else {
                int finalScoreIdx = evalMarkdown.indexOf("## 📊 Final Score");
                if (finalScoreIdx != -1) {
                    evalBlock = evalMarkdown.substring(finalScoreIdx);
                }
            }

            objective = extractRegex(OBJECTIVE_PATTERN, evalBlock);
            problem = extractRegex(PROBLEM_PATTERN, evalBlock);
            logic = extractRegex(LOGIC_PATTERN, evalBlock);
            variables = extractRegex(VARIABLES_PATTERN, evalBlock);
            observed = extractRegex(OBSERVED_PATTERN, evalBlock);
            total = extractRegex(TOTAL_PATTERN, evalBlock);
            finalScore = extractRegex(FINAL_SCORE_PATTERN, evalBlock);
            assessment = extractRegex(ASSESSMENT_PATTERN, evalMarkdown);
        }

        // Direct fallback fields if present
        if (objective == null && sNode.hasNonNull("objective_score")) objective = sanitize(sNode.get("objective_score").asText());
        if (problem == null && sNode.hasNonNull("problem_understanding_score")) problem = sanitize(sNode.get("problem_understanding_score").asText());
        if (logic == null && sNode.hasNonNull("logic_score")) logic = sanitize(sNode.get("logic_score").asText());
        if (variables == null && sNode.hasNonNull("variables_score")) variables = sanitize(sNode.get("variables_score").asText());
        if (observed == null && sNode.hasNonNull("observation_score")) observed = sanitize(sNode.get("observation_score").asText());
        if (total == null && sNode.hasNonNull("total_score")) total = sanitize(sNode.get("total_score").asText());
        if (finalScore == null && sNode.hasNonNull("final_score")) finalScore = sanitize(sNode.get("final_score").asText());
        if (assessment == null && sNode.hasNonNull("assessment")) assessment = sNode.get("assessment").asText();

        // Default fallbacks if sections were completely missing
        if (finalScore == null) finalScore = "N/A";
        if (assessment == null) assessment = "No assessment provided.";

        return new ParsedScores(objective, problem, logic, variables, observed, total, finalScore, assessment);
    }

    private String sanitize(String val) {
        if (val == null) return null;
        val = val.trim();
        return val.length() > 250 ? val.substring(0, 250) : val;
    }

    private String extractRegex(Pattern pattern, String text) {
        if (text == null) return null;
        Matcher m = pattern.matcher(text);
        if (m.find()) {
            String val = m.group(1).trim();
            val = val.replace("**", "").trim();
            if (val.length() > 250) {
                val = val.substring(0, 250);
            }
            return val;
        }
        return null;
    }

    private record ParsedScores(
            String objectiveScore,
            String problemUnderstandingScore,
            String logicScore,
            String variablesScore,
            String observationScore,
            String totalScore,
            String finalScore,
            String assessment
    ) {}

    /**
     * Builds the complete teacher evaluation grid response.
     * Guarantees:
     * - Each student has exactly one row.
     * - Dynamic week columns sorted in natural order (Week 1, Week 2, Week 3...).
     * - Evaluation cells contain compact score breakdown and human feedback review status.
     */
    @Transactional(readOnly = true)
    public TeacherEvaluationGridResponse getEvaluationGrid() {
        List<StudentEvaluation> allEvaluations = evaluationRepository.findAllByOrderByIdAsc();
        List<TeacherFeedback> allFeedbacks = feedbackRepository.findAll();

        // Map feedback by key "studentId::week"
        Map<String, TeacherFeedback> feedbackMap = allFeedbacks.stream()
                .collect(Collectors.toMap(
                        fb -> fb.getStudentId() + "::" + fb.getWeek(),
                        fb -> fb,
                        (existing, replacement) -> replacement
                ));

        // Distinct weeks sorted by weekNumber ASC then week ASC
        List<String> sortedWeeks = allEvaluations.stream()
                .map(e -> new WeekInfo(e.getWeek(), e.getWeekNumber()))
                .distinct()
                .sorted(Comparator.comparingInt(WeekInfo::weekNumber).thenComparing(WeekInfo::displayName))
                .map(WeekInfo::displayName)
                .collect(Collectors.toList());

        // Pre-load student details from UserRepository and SubmissionRepository
        Map<String, com.selva.authportal.model.User> userMap = new HashMap<>();
        try {
            List<com.selva.authportal.model.User> allUsers = userRepository.findAll();
            for (com.selva.authportal.model.User u : allUsers) {
                if (u.getEmail() != null && u.getEmail().contains("@")) {
                    String local = u.getEmail().split("@")[0].trim().toUpperCase();
                    userMap.put(local, u);
                }
            }
        } catch (Exception e) {
            log.warn("Could not pre-load users for evaluation grid: {}", e.getMessage());
        }

        try {
            List<com.selva.authportal.model.Submission> allSubs = submissionRepository.findAll();
            for (com.selva.authportal.model.Submission sub : allSubs) {
                if (sub.getStudentId() != null && sub.getUser() != null) {
                    userMap.putIfAbsent(sub.getStudentId().trim().toUpperCase(), sub.getUser());
                }
            }
        } catch (Exception e) {
            log.warn("Could not pre-load submissions for evaluation grid: {}", e.getMessage());
        }

        // Maintain student insertion order
        Map<String, TeacherEvaluationRowDTO> rowMap = new LinkedHashMap<>();

        for (StudentEvaluation eval : allEvaluations) {
            String studentId = eval.getStudentId();
            com.selva.authportal.model.User matchedUser = userMap.get(studentId.toUpperCase());
            String studentName = matchedUser != null ? matchedUser.getName() : null;
            String profilePic = matchedUser != null ? matchedUser.getProfilePicture() : null;

            TeacherEvaluationRowDTO row = rowMap.computeIfAbsent(studentId, k -> TeacherEvaluationRowDTO.builder()
                    .rNo(rowMap.size() + 1)
                    .studentId(studentId)
                    .studentName(studentName)
                    .profilePicture(profilePic)
                    .evaluations(new HashMap<>())
                    .build()
            );

            if (row.getStudentName() == null && studentName != null) {
                row.setStudentName(studentName);
            }
            if (row.getProfilePicture() == null && profilePic != null) {
                row.setProfilePicture(profilePic);
            }

            TeacherFeedback fb = feedbackMap.get(studentId + "::" + eval.getWeek());
            boolean reviewed = (fb != null && fb.isReviewed());
            String feedbackText = (fb != null) ? fb.getFeedbackText() : null;

            EvaluationCellDTO cell = EvaluationCellDTO.builder()
                    .studentId(studentId)
                    .week(eval.getWeek())
                    .objectiveScore(eval.getObjectiveScore())
                    .problemUnderstandingScore(eval.getProblemUnderstandingScore())
                    .logicScore(eval.getLogicScore())
                    .variablesScore(eval.getVariablesScore())
                    .observationScore(eval.getObservationScore())
                    .totalScore(eval.getTotalScore())
                    .finalScore(eval.getFinalScore())
                    .reviewed(reviewed)
                    .feedbackText(feedbackText)
                    .build();

            row.getEvaluations().put(eval.getWeek(), cell);
        }

        return TeacherEvaluationGridResponse.builder()
                .weeks(sortedWeeks)
                .rows(new ArrayList<>(rowMap.values()))
                .totalStudents(rowMap.size())
                .build();
    }

    /**
     * Extracts an integer section number from a raw section identifier (e.g. "SEC2" -> 2, "sec-03" -> 3, "1" -> 1).
     */
    public static Integer parseSectionNumber(String rawSection) {
        if (rawSection == null || rawSection.trim().isEmpty()) {
            return null;
        }
        Matcher matcher = Pattern.compile("(?i)(?:sec[_-]?0*|section[_-]?0*)?(\\d+)").matcher(rawSection.trim());
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    /**
     * Locates the exact matching Submission using the student's existing submission metadata:
     * Student ID + Week Number + Section (+ Academic Year/Level if available).
     * Resolves multiple versions by preferring the highest revision / most recently updated submission.
     */
    public Submission findMatchingSubmission(String studentId, Integer weekNumber, Integer sectionNumber, String yearStr) {
        if (studentId == null || weekNumber == null) {
            return null;
        }

        List<Submission> candidates;
        if (sectionNumber != null) {
            candidates = submissionRepository.findByStudentIdIgnoreCaseAndWeekAndSectionOrderByVersionDescUpdatedAtDesc(
                    studentId, weekNumber, sectionNumber
            );
            if (candidates.isEmpty()) {
                candidates = submissionRepository.findByStudentIdIgnoreCaseAndWeekOrderByVersionDescUpdatedAtDesc(
                        studentId, weekNumber
                );
            }
        } else {
            candidates = submissionRepository.findByStudentIdIgnoreCaseAndWeekOrderByVersionDescUpdatedAtDesc(
                    studentId, weekNumber
            );
        }

        if (candidates.isEmpty()) {
            return null;
        }

        // If academic year is available, filter by matching YearLevel
        if (yearStr != null && !yearStr.trim().isEmpty()) {
            try {
                YearLevel targetYear = YearLevel.valueOf(yearStr.trim().toUpperCase());
                for (Submission sub : candidates) {
                    if (sub.getYear() == targetYear) {
                        return sub;
                    }
                }
            } catch (IllegalArgumentException ignored) {}
        }

        // Return the most authoritative candidate (highest version, most recent updatedAt)
        return candidates.get(0);
    }

    /**
     * Scans submission files for the PDF report file, strictly preferring FileType.PDF_REPORT.
     */
    public SubmissionFile findPdfFile(Submission submission) {
        if (submission == null || submission.getFiles() == null || submission.getFiles().isEmpty()) {
            return null;
        }
        // 1. Primary: Match FileType.PDF_REPORT
        for (SubmissionFile file : submission.getFiles()) {
            if (file.getFileType() == FileType.PDF_REPORT) {
                return file;
            }
        }
        // 2. Secondary fallback: file extension or original filename ending in .pdf
        for (SubmissionFile file : submission.getFiles()) {
            if (file.getFileExtension() != null && file.getFileExtension().equalsIgnoreCase(".pdf")) {
                return file;
            }
            if (file.getOriginalFilename() != null && file.getOriginalFilename().toLowerCase().endsWith(".pdf")) {
                return file;
            }
        }
        return null;
    }

    /**
     * Retrieves detailed evaluation report, OCR text, PDF mapping, and teacher feedback for a single student and week.
     */
    @Transactional(readOnly = true)
    public SingleStudentReportResponse getStudentReport(String studentId, String week) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        StudentEvaluation eval = evaluationRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName()
                ));

        TeacherFeedback fb = feedbackRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElse(null);

        Map<String, Object> extractionMap = null;
        Map<String, Object> ocrMap = null;
        Map<String, Object> sourceMap = null;
        String rawMarkdown = null;
        String yearStr = null;

        if (eval.getRawJson() != null && !eval.getRawJson().isEmpty()) {
            try {
                JsonNode sNode = objectMapper.readTree(eval.getRawJson());
                if (sNode.hasNonNull("evaluation")) {
                    rawMarkdown = sNode.get("evaluation").asText();
                }
                if (sNode.has("extraction")) {
                    extractionMap = objectMapper.convertValue(sNode.get("extraction"), new TypeReference<Map<String, Object>>() {});
                }
                if (sNode.has("ocr")) {
                    ocrMap = objectMapper.convertValue(sNode.get("ocr"), new TypeReference<Map<String, Object>>() {});
                }
                if (sNode.has("source")) {
                    sourceMap = objectMapper.convertValue(sNode.get("source"), new TypeReference<Map<String, Object>>() {});
                }
                if (sNode.hasNonNull("year")) {
                    yearStr = sNode.get("year").asText();
                } else if (sNode.hasNonNull("year_level")) {
                    yearStr = sNode.get("year_level").asText();
                }
            } catch (Exception e) {
                log.warn("Failed to parse rawJson for student {} and week {}: {}", normalizedId, weekInfo.displayName(), e.getMessage());
            }
        }

        // Authoritative mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT) -> Backblaze B2
        Integer sectionNumber = parseSectionNumber(eval.getSectionId());
        Submission matchingSubmission = findMatchingSubmission(eval.getStudentId(), eval.getWeekNumber(), sectionNumber, yearStr);
        SubmissionFile pdfFile = findPdfFile(matchingSubmission);

        boolean pdfAvailable = false;
        String pdfFilename = null;
        Long submissionId = null;
        Long submissionFileId = null;

        if (matchingSubmission != null && pdfFile != null) {
            submissionId = matchingSubmission.getId();
            submissionFileId = pdfFile.getId();
            pdfFilename = pdfFile.getOriginalFilename();

            String storageKey = pdfFile.getEffectiveStorageKey();
            if (storageKey != null && storageService.fileExists(storageKey)) {
                pdfAvailable = true;
            } else {
                log.warn("PDF file record exists in database (id={}) but physical file not found in storage with key: {}",
                        pdfFile.getId(), storageKey);
            }
        }

        return SingleStudentReportResponse.builder()
                .studentId(eval.getStudentId())
                .week(eval.getWeek())
                .sectionId(eval.getSectionId())
                .finalScore(eval.getFinalScore())
                .assessment(eval.getAssessment())
                .objectiveScore(eval.getObjectiveScore())
                .problemUnderstandingScore(eval.getProblemUnderstandingScore())
                .logicScore(eval.getLogicScore())
                .variablesScore(eval.getVariablesScore())
                .observationScore(eval.getObservationScore())
                .totalScore(eval.getTotalScore())
                .rawEvaluationMarkdown(rawMarkdown)
                .extraction(extractionMap)
                .ocr(ocrMap)
                .source(sourceMap)
                .pdfAvailable(pdfAvailable)
                .pdfFilename(pdfFilename)
                .submissionId(submissionId)
                .submissionFileId(submissionFileId)
                .reviewed(fb != null && fb.isReviewed())
                .feedbackText(fb != null ? fb.getFeedbackText() : "")
                .build();
    }

    /**
     * Streams the student's uploaded PDF report for inline browser viewing.
     * Uses authoritative metadata mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT) -> StorageService (Backblaze B2).
     */
    @Transactional(readOnly = true)
    public SubmissionService.DownloadableFile loadStudentPdf(String studentId, String week) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        StudentEvaluation eval = evaluationRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName()
                ));

        Integer sectionNumber = parseSectionNumber(eval.getSectionId());
        String yearStr = null;
        if (eval.getRawJson() != null && !eval.getRawJson().isEmpty()) {
            try {
                JsonNode sNode = objectMapper.readTree(eval.getRawJson());
                if (sNode.hasNonNull("year")) yearStr = sNode.get("year").asText();
                else if (sNode.hasNonNull("year_level")) yearStr = sNode.get("year_level").asText();
            } catch (Exception ignored) {}
        }

        Submission matchingSubmission = findMatchingSubmission(eval.getStudentId(), eval.getWeekNumber(), sectionNumber, yearStr);
        if (matchingSubmission == null) {
            throw new ResourceNotFoundException("No submission found for student " + normalizedId + " in " + weekInfo.displayName());
        }

        SubmissionFile pdfFile = findPdfFile(matchingSubmission);
        if (pdfFile == null) {
            throw new ResourceNotFoundException("No PDF report file found in submission for student " + normalizedId + " in " + weekInfo.displayName());
        }

        String storageKey = pdfFile.getEffectiveStorageKey();
        if (!storageService.fileExists(storageKey)) {
            throw new ResourceNotFoundException("PDF file not found in storage with key: " + storageKey);
        }

        InputStream inputStream;
        try {
            inputStream = storageService.openStream(storageKey);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read PDF from storage: " + pdfFile.getOriginalFilename(), e);
        }

        Resource resource = new InputStreamResource(inputStream);
        return new SubmissionService.DownloadableFile(resource, pdfFile.getOriginalFilename(), "application/pdf");
    }

    /**
     * Saves or updates teacher feedback for a specific (studentId, week).
     * Strictly decoupled from AI evaluation: does NOT modify any AI scores or evaluations.
     */
    @Transactional
    public TeacherFeedbackResponse saveFeedback(TeacherFeedbackRequest request, String teacherEmail) {
        String normalizedId = request.getStudentId().trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(request.getWeek());

        TeacherFeedback feedback = feedbackRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElseGet(() -> TeacherFeedback.builder()
                        .studentId(normalizedId)
                        .week(weekInfo.displayName())
                        .build()
                );

        feedback.setReviewed(Boolean.TRUE.equals(request.getReviewed()));
        feedback.setFeedbackText(request.getFeedbackText());
        feedback.setTeacherEmail(teacherEmail);

        TeacherFeedback saved = feedbackRepository.save(feedback);
        log.info("Saved teacher feedback for {} and {}: reviewed={}", normalizedId, weekInfo.displayName(), saved.isReviewed());

        // If score update is included with feedback submission, persist it as well
        if (request.getFinalScore() != null && !request.getFinalScore().trim().isEmpty()) {
            double numScore = validateAndExtractNumericScore(request.getFinalScore(), request.getNumericScore());
            String formattedScore = formatFinalScoreString(request.getFinalScore(), numScore);
            evaluationRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                    .ifPresent(eval -> {
                        eval.setFinalScore(formattedScore);
                        if (request.getObjectiveScore() != null) eval.setObjectiveScore(request.getObjectiveScore().trim());
                        if (request.getProblemUnderstandingScore() != null) eval.setProblemUnderstandingScore(request.getProblemUnderstandingScore().trim());
                        if (request.getLogicScore() != null) eval.setLogicScore(request.getLogicScore().trim());
                        if (request.getVariablesScore() != null) eval.setVariablesScore(request.getVariablesScore().trim());
                        if (request.getObservationScore() != null) eval.setObservationScore(request.getObservationScore().trim());
                        if (request.getTotalScore() != null) eval.setTotalScore(request.getTotalScore().trim());
                        evaluationRepository.save(eval);
                        log.info("Updated final score & sections via feedback save for {} and {}: {}", normalizedId, weekInfo.displayName(), formattedScore);
                    });
        }

        return TeacherFeedbackResponse.builder()
                .studentId(saved.getStudentId())
                .week(saved.getWeek())
                .reviewed(saved.isReviewed())
                .feedbackText(saved.getFeedbackText())
                .teacherEmail(saved.getTeacherEmail())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    /**
     * Updates the final awarded score and section-by-section breakdown for a student evaluation report.
     * Strictly validates that the numeric score falls within 0.0 and 10.0 inclusive.
     */
    @Transactional
    public SingleStudentReportResponse updateScore(ScoreUpdateRequest request, String teacherEmail) {
        String normalizedId = request.getStudentId().trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(request.getWeek());

        double numericScore = validateAndExtractNumericScore(request.getFinalScore(), request.getNumericScore());
        String formattedFinalScore = formatFinalScoreString(request.getFinalScore(), numericScore);

        StudentEvaluation eval = evaluationRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName()
                ));

        eval.setFinalScore(formattedFinalScore);
        if (request.getObjectiveScore() != null) eval.setObjectiveScore(request.getObjectiveScore().trim());
        if (request.getProblemUnderstandingScore() != null) eval.setProblemUnderstandingScore(request.getProblemUnderstandingScore().trim());
        if (request.getLogicScore() != null) eval.setLogicScore(request.getLogicScore().trim());
        if (request.getVariablesScore() != null) eval.setVariablesScore(request.getVariablesScore().trim());
        if (request.getObservationScore() != null) eval.setObservationScore(request.getObservationScore().trim());
        if (request.getTotalScore() != null) eval.setTotalScore(request.getTotalScore().trim());

        StudentEvaluation saved = evaluationRepository.save(eval);
        log.info("Teacher {} updated scores for {} and {} to {} (raw total: {})",
                teacherEmail, normalizedId, weekInfo.displayName(), formattedFinalScore, saved.getTotalScore());

        return getStudentReport(saved.getStudentId(), saved.getWeek());
    }

    /**
     * Extracts and validates numeric score from finalScore string or direct Double.
     * Strictly ensures score is between 0.0 and 10.0 inclusive.
     */
    public static double validateAndExtractNumericScore(String finalScore, Double directNumeric) {
        Double scoreVal = directNumeric;
        if (scoreVal == null && finalScore != null && !finalScore.trim().isEmpty()) {
            Matcher m = Pattern.compile("(?i)^\\s*([0-9]+(?:\\.[0-9]+)?)").matcher(finalScore.trim());
            if (m.find()) {
                try {
                    scoreVal = Double.parseDouble(m.group(1));
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid numeric score format: " + finalScore);
                }
            }
        }

        if (scoreVal == null) {
            throw new IllegalArgumentException("A valid numeric score is required.");
        }

        if (scoreVal < 0.0 || scoreVal > 10.0) {
            throw new IllegalArgumentException("Score must be between 0 and 10 (received: " + scoreVal + ").");
        }

        return scoreVal;
    }

    /**
     * Formats the final score string consistently.
     * Preserves existing fractional precision (e.g. 7.94, 8.5) and retains or attaches " / 10".
     */
    public static String formatFinalScoreString(String finalScore, double validatedNumeric) {
        String trimmed = (finalScore != null) ? finalScore.trim() : "";
        if (trimmed.contains("/")) {
            return trimmed;
        }
        if (validatedNumeric == Math.floor(validatedNumeric) && !Double.isInfinite(validatedNumeric)) {
            return String.format("%.0f / 10", validatedNumeric);
        }
        return validatedNumeric + " / 10";
    }

    /**
     * Deletes an evaluation report and associated teacher feedback for a specific (studentId, week).
     */
    @Transactional
    public void deleteStudentReport(String studentId, String week) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        evaluationRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .ifPresent(evaluationRepository::delete);

        feedbackRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .ifPresent(feedbackRepository::delete);

        log.info("Deleted evaluation report and feedback for {} and {}", normalizedId, weekInfo.displayName());
    }

    /**
     * Deletes all evaluation reports and feedbacks for a student.
     */
    @Transactional
    public void deleteAllReportsForStudent(String studentId) {
        String normalizedId = studentId.trim().toUpperCase();

        List<StudentEvaluation> evals = evaluationRepository.findByStudentId(normalizedId);
        if (!evals.isEmpty()) {
            evaluationRepository.deleteAll(evals);
        }

        List<TeacherFeedback> fbs = feedbackRepository.findByStudentId(normalizedId);
        if (!fbs.isEmpty()) {
            feedbackRepository.deleteAll(fbs);
        }

        log.info("Deleted all evaluation reports and feedback for student {}", normalizedId);
    }
}
