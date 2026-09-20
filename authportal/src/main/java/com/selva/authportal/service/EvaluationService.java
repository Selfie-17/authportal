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
 * - Multi-provider support: Gemini and Ollama evaluations coexist for each student and week.
 * - Dynamic student rows: exactly one row per Student ID.
 * - Dynamic week columns: dynamically generated from uploaded data and sorted naturally.
 * - High performance: lightweight projections avoid loading multi-megabyte raw JSON across DB connections.
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

    // Markdown score extraction patterns (legacy schema fallback)
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
        return new WeekInfo(trimmed, 999);
    }

    /**
     * Uploads and parses evaluation JSON from a MultipartFile.
     */
    @Transactional
    public EvaluationUploadResponse processJsonUpload(MultipartFile file) throws IOException {
        return processJsonUpload(file, null);
    }

    /**
     * Uploads and parses evaluation JSON from a MultipartFile with optional forced provider.
     */
    @Transactional
    public EvaluationUploadResponse processJsonUpload(MultipartFile file, String forcedProvider) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded JSON file is empty.");
        }
        String jsonContent = new String(file.getBytes(), StandardCharsets.UTF_8);
        return processJsonString(jsonContent, forcedProvider);
    }

    /**
     * Uploads and parses evaluation JSON from a raw JSON string.
     */
    @Transactional
    public EvaluationUploadResponse processJsonString(String jsonContent) throws IOException {
        return processJsonString(jsonContent, null);
    }

    private record StudentEvaluationInput(String studentId, JsonNode node) {}

    /**
     * Uploads and parses evaluation JSON with optional forced provider.
     * Supports both Schema 2.0 (Gemini, Ollama object dictionaries) and Schema 1.0 (arrays).
     */
    @Transactional
    public EvaluationUploadResponse processJsonString(String jsonContent, String forcedProvider) throws IOException {
        JsonNode root = objectMapper.readTree(jsonContent);
        List<StudentEvaluationInput> studentInputs = new ArrayList<>();
        String rootWeek = null;
        String rootSection = null;
        String rootProvider = (forcedProvider != null && !forcedProvider.trim().isEmpty())
                ? forcedProvider.trim().toLowerCase()
                : null;

        if (root.isObject()) {
            if (root.hasNonNull("week_id")) rootWeek = root.get("week_id").asText();
            else if (root.hasNonNull("week")) rootWeek = root.get("week").asText();

            if (root.hasNonNull("section_id")) rootSection = root.get("section_id").asText();
            else if (root.hasNonNull("section")) rootSection = root.get("section").asText();

            if (rootProvider == null && root.hasNonNull("provider")) {
                rootProvider = root.get("provider").asText().trim().toLowerCase();
            }

            if (root.has("students")) {
                JsonNode studentsNode = root.get("students");
                if (studentsNode.isObject()) {
                    // Schema 2.0: Map of student_id -> student evaluation node
                    Iterator<Map.Entry<String, JsonNode>> fields = studentsNode.fields();
                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        studentInputs.add(new StudentEvaluationInput(entry.getKey(), entry.getValue()));
                    }
                } else if (studentsNode.isArray()) {
                    // Legacy Schema 1.0: Array of student objects
                    for (JsonNode sNode : studentsNode) {
                        String sId = sNode.hasNonNull("student_id") ? sNode.get("student_id").asText() : null;
                        studentInputs.add(new StudentEvaluationInput(sId, sNode));
                    }
                }
            } else if (root.has("student_id")) {
                studentInputs.add(new StudentEvaluationInput(root.get("student_id").asText(), root));
            }
        } else if (root.isArray()) {
            for (JsonNode sNode : root) {
                String sId = sNode.hasNonNull("student_id") ? sNode.get("student_id").asText() : null;
                studentInputs.add(new StudentEvaluationInput(sId, sNode));
            }
        }

        if (studentInputs.isEmpty()) {
            throw new IllegalArgumentException("No student evaluations found in the provided JSON.");
        }

        Set<String> processedWeeks = new LinkedHashSet<>();
        int count = 0;

        for (StudentEvaluationInput input : studentInputs) {
            String studentId = input.studentId();
            JsonNode sNode = input.node();

            if (studentId == null && sNode.hasNonNull("student_id")) {
                studentId = sNode.get("student_id").asText();
            }
            if (studentId == null || studentId.trim().isEmpty()) {
                continue;
            }
            studentId = studentId.trim().toUpperCase();

            // Determine provider: forced provider -> root provider -> student node provider -> default "gemini"
            String itemProvider = rootProvider;
            if (itemProvider == null && sNode.hasNonNull("provider")) {
                itemProvider = sNode.get("provider").asText().trim().toLowerCase();
            }
            if (itemProvider == null || itemProvider.isEmpty()) {
                itemProvider = "gemini";
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

            String modelName = sNode.hasNonNull("model_name") ? sNode.get("model_name").asText() : null;
            String grade = sNode.hasNonNull("grade") ? sNode.get("grade").asText() : null;
            String status = sNode.hasNonNull("status") ? sNode.get("status").asText() : null;

            // Extract scores and assessment
            ParsedScores scores = parseScores(sNode);

            final String studentIdToSave = studentId;
            final String weekToSave = weekInfo.displayName();
            final String providerToSave = itemProvider;

            // Multi-provider uniqueness: (student_id, week, provider)
            Optional<StudentEvaluation> existingOpt = evaluationRepository.findByStudentIdAndWeekAndProvider(
                    studentIdToSave, weekToSave, providerToSave
            );

            StudentEvaluation evaluation = existingOpt.orElseGet(() -> StudentEvaluation.builder()
                    .studentId(studentIdToSave)
                    .week(weekToSave)
                    .provider(providerToSave)
                    .build()
            );

            evaluation.setWeekNumber(weekInfo.weekNumber());
            evaluation.setSectionId(sectionId);
            evaluation.setProvider(providerToSave);
            evaluation.setModelName(modelName);
            evaluation.setGrade(grade);
            evaluation.setStatus(status);
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

        log.info("Processed {} student evaluations for provider '{}' across weeks: {}", count, rootProvider, processedWeeks);

        return EvaluationUploadResponse.builder()
                .success(true)
                .message("Successfully processed " + count + " " + (rootProvider != null ? rootProvider.toUpperCase() : "AI") + " evaluations.")
                .processedCount(count)
                .weeks(new ArrayList<>(processedWeeks))
                .build();
    }

    /**
     * Extracts scores and overall assessment from evaluation markdown or direct attributes.
     * Supports Schema 2.0 criteria_scores (D1..D5) and Schema 1.0 tables.
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

        // 1. Schema 2.0: Structured criteria_scores (D1..D5)
        if (sNode.has("criteria_scores") && sNode.get("criteria_scores").isObject()) {
            JsonNode cNode = sNode.get("criteria_scores");
            if (cNode.has("D1")) objective = formatCriteriaScore(cNode.get("D1"));
            if (cNode.has("D2")) problem = formatCriteriaScore(cNode.get("D2"));
            if (cNode.has("D3")) logic = formatCriteriaScore(cNode.get("D3"));
            if (cNode.has("D4")) variables = formatCriteriaScore(cNode.get("D4"));
            if (cNode.has("D5")) observed = formatCriteriaScore(cNode.get("D5"));
        }

        // Schema 2.0 direct score fields
        if (sNode.hasNonNull("score_display")) {
            finalScore = sanitize(sNode.get("score_display").asText());
            total = finalScore;
        } else if (sNode.hasNonNull("recommended_score")) {
            double sc = sNode.get("recommended_score").asDouble();
            double max = sNode.hasNonNull("max_score") ? sNode.get("max_score").asDouble() : 10.0;
            finalScore = sc + " / " + max;
            total = finalScore;
        }

        // 2. Schema 1.0 or legacy markdown inspection
        String evalMarkdown = "";
        if (sNode.hasNonNull("full_report_markdown")) {
            evalMarkdown = sNode.get("full_report_markdown").asText();
        } else if (sNode.hasNonNull("evaluation")) {
            evalMarkdown = sNode.get("evaluation").asText();
        }

        if (!evalMarkdown.isEmpty()) {
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

            if (objective == null) objective = extractRegex(OBJECTIVE_PATTERN, evalBlock);
            if (problem == null) problem = extractRegex(PROBLEM_PATTERN, evalBlock);
            if (logic == null) logic = extractRegex(LOGIC_PATTERN, evalBlock);
            if (variables == null) variables = extractRegex(VARIABLES_PATTERN, evalBlock);
            if (observed == null) observed = extractRegex(OBSERVED_PATTERN, evalBlock);
            if (total == null) total = extractRegex(TOTAL_PATTERN, evalBlock);
            if (finalScore == null) finalScore = extractRegex(FINAL_SCORE_PATTERN, evalBlock);
            assessment = extractRegex(ASSESSMENT_PATTERN, evalMarkdown);
        }

        // 3. Fallback direct attributes
        if (objective == null && sNode.hasNonNull("objective_score")) objective = sanitize(sNode.get("objective_score").asText());
        if (problem == null && sNode.hasNonNull("problem_understanding_score")) problem = sanitize(sNode.get("problem_understanding_score").asText());
        if (logic == null && sNode.hasNonNull("logic_score")) logic = sanitize(sNode.get("logic_score").asText());
        if (variables == null && sNode.hasNonNull("variables_score")) variables = sanitize(sNode.get("variables_score").asText());
        if (observed == null && sNode.hasNonNull("observation_score")) observed = sanitize(sNode.get("observation_score").asText());
        if (total == null && sNode.hasNonNull("total_score")) total = sanitize(sNode.get("total_score").asText());
        if (finalScore == null && sNode.hasNonNull("final_score")) finalScore = sanitize(sNode.get("final_score").asText());
        if (assessment == null && sNode.hasNonNull("assessment")) assessment = sNode.get("assessment").asText();

        // 4. Fallback status or grade as assessment if missing
        if (assessment == null) {
            if (sNode.hasNonNull("status")) assessment = "Status: " + sNode.get("status").asText();
            else if (sNode.hasNonNull("grade")) assessment = "Grade: " + sNode.get("grade").asText();
            else assessment = "No assessment provided.";
        }
        if (finalScore == null) finalScore = "N/A";
        if (total == null) total = finalScore;

        return new ParsedScores(objective, problem, logic, variables, observed, total, finalScore, assessment);
    }

    private String formatCriteriaScore(JsonNode dNode) {
        if (dNode == null) return null;
        if (dNode.hasNonNull("score") && dNode.hasNonNull("max_score")) {
            return dNode.get("score").asText() + " / " + dNode.get("max_score").asText();
        } else if (dNode.hasNonNull("score")) {
            return dNode.get("score").asText() + " / 2.0";
        }
        return null;
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
     * High-performance implementation:
     * - Uses findAllSummaries() projection to avoid loading multi-megabyte raw JSON across the network.
     * - Eliminates N+1 queries by pre-loading student names strictly from UserRepository.
     * - Supports multi-provider metrics (Gemini, Ollama) per week cell.
     */
    @Transactional(readOnly = true)
    public TeacherEvaluationGridResponse getEvaluationGrid() {
        List<StudentEvaluationRepository.EvaluationSummaryProjection> allSummaries = evaluationRepository.findAllSummaries();
        List<TeacherFeedback> allFeedbacks = feedbackRepository.findAll();

        // Map feedback by key "studentId::week"
        Map<String, TeacherFeedback> feedbackMap = allFeedbacks.stream()
                .collect(Collectors.toMap(
                        fb -> fb.getStudentId() + "::" + fb.getWeek(),
                        fb -> fb,
                        (existing, replacement) -> replacement
                ));

        // Distinct weeks sorted by weekNumber ASC then week ASC
        List<String> sortedWeeks = allSummaries.stream()
                .map(e -> new WeekInfo(e.getWeek(), e.getWeekNumber() != null ? e.getWeekNumber() : 1))
                .distinct()
                .sorted(Comparator.comparingInt(WeekInfo::weekNumber).thenComparing(WeekInfo::displayName))
                .map(WeekInfo::displayName)
                .collect(Collectors.toList());

        // Pre-load student details from UserRepository ONLY (zero N+1 queries, zero submission table scans)
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

        // Multi-provider grouping: studentId -> week -> Map<provider, EvaluationSummaryProjection>
        Map<String, Map<String, Map<String, StudentEvaluationRepository.EvaluationSummaryProjection>>> studentWeekProviderMap = new LinkedHashMap<>();

        for (StudentEvaluationRepository.EvaluationSummaryProjection summary : allSummaries) {
            String studentId = summary.getStudentId();
            String week = summary.getWeek();
            String provider = (summary.getProvider() != null) ? summary.getProvider().toLowerCase() : "gemini";

            studentWeekProviderMap
                    .computeIfAbsent(studentId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(week, k -> new LinkedHashMap<>())
                    .put(provider, summary);
        }

        Map<String, TeacherEvaluationRowDTO> rowMap = new LinkedHashMap<>();

        for (Map.Entry<String, Map<String, Map<String, StudentEvaluationRepository.EvaluationSummaryProjection>>> studentEntry : studentWeekProviderMap.entrySet()) {
            String studentId = studentEntry.getKey();
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

            for (Map.Entry<String, Map<String, StudentEvaluationRepository.EvaluationSummaryProjection>> weekEntry : studentEntry.getValue().entrySet()) {
                String week = weekEntry.getKey();
                Map<String, StudentEvaluationRepository.EvaluationSummaryProjection> provMap = weekEntry.getValue();

                TeacherFeedback fb = feedbackMap.get(studentId + "::" + week);
                boolean reviewed = (fb != null && fb.isReviewed());
                String feedbackText = (fb != null) ? fb.getFeedbackText() : null;

                // Build provider summaries
                Map<String, EvaluationCellDTO.ProviderSummaryDTO> providerSummaries = new HashMap<>();
                List<String> availableProviders = new ArrayList<>(provMap.keySet());
                String geminiScore = null;
                String ollamaScore = null;

                for (Map.Entry<String, StudentEvaluationRepository.EvaluationSummaryProjection> pEntry : provMap.entrySet()) {
                    String pName = pEntry.getKey();
                    StudentEvaluationRepository.EvaluationSummaryProjection pSum = pEntry.getValue();

                    if ("gemini".equalsIgnoreCase(pName)) {
                        geminiScore = pSum.getFinalScore();
                    } else if ("ollama".equalsIgnoreCase(pName)) {
                        ollamaScore = pSum.getFinalScore();
                    }

                    if (row.getSectionId() == null && pSum.getSectionId() != null) {
                        row.setSectionId(pSum.getSectionId());
                    }

                    providerSummaries.put(pName, EvaluationCellDTO.ProviderSummaryDTO.builder()
                            .provider(pName)
                            .modelName(pSum.getModelName())
                            .finalScore(pSum.getFinalScore())
                            .totalScore(pSum.getTotalScore())
                            .grade(pSum.getGrade())
                            .status(pSum.getStatus())
                            .objectiveScore(pSum.getObjectiveScore())
                            .problemUnderstandingScore(pSum.getProblemUnderstandingScore())
                            .logicScore(pSum.getLogicScore())
                            .variablesScore(pSum.getVariablesScore())
                            .observationScore(pSum.getObservationScore())
                            .build());
                }

                // Prefer Gemini as the default primary display if available, else Ollama, else first
                StudentEvaluationRepository.EvaluationSummaryProjection primary = provMap.get("gemini");
                if (primary == null) {
                    primary = provMap.get("ollama");
                }
                if (primary == null && !provMap.isEmpty()) {
                    primary = provMap.values().iterator().next();
                }

                EvaluationCellDTO cell = EvaluationCellDTO.builder()
                        .studentId(studentId)
                        .week(week)
                        .objectiveScore(primary != null ? primary.getObjectiveScore() : null)
                        .problemUnderstandingScore(primary != null ? primary.getProblemUnderstandingScore() : null)
                        .logicScore(primary != null ? primary.getLogicScore() : null)
                        .variablesScore(primary != null ? primary.getVariablesScore() : null)
                        .observationScore(primary != null ? primary.getObservationScore() : null)
                        .totalScore(primary != null ? primary.getTotalScore() : null)
                        .finalScore(primary != null ? primary.getFinalScore() : null)
                        .provider(primary != null ? primary.getProvider() : null)
                        .modelName(primary != null ? primary.getModelName() : null)
                        .grade(primary != null ? primary.getGrade() : null)
                        .status(primary != null ? primary.getStatus() : null)
                        .geminiScore(geminiScore)
                        .ollamaScore(ollamaScore)
                        .availableProviders(availableProviders)
                        .providers(providerSummaries)
                        .reviewed(reviewed)
                        .feedbackText(feedbackText)
                        .build();

                row.getEvaluations().put(week, cell);
            }
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

        return candidates.get(0);
    }

    /**
     * Scans submission files for the PDF report file, strictly preferring FileType.PDF_REPORT.
     */
    public SubmissionFile findPdfFile(Submission submission) {
        if (submission == null || submission.getFiles() == null || submission.getFiles().isEmpty()) {
            return null;
        }
        for (SubmissionFile file : submission.getFiles()) {
            if (file.getFileType() == FileType.PDF_REPORT) {
                return file;
            }
        }
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
     * Retrieves detailed evaluation report for a single student and week (default provider).
     */
    @Transactional(readOnly = true)
    public SingleStudentReportResponse getStudentReport(String studentId, String week) {
        return getStudentReport(studentId, week, null);
    }

    /**
     * Retrieves detailed evaluation report, OCR text, PDF mapping, and teacher feedback
     * for a single student, week, and specific provider (e.g. "gemini" or "ollama").
     */
    @Transactional(readOnly = true)
    public SingleStudentReportResponse getStudentReport(String studentId, String week, String provider) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        List<StudentEvaluation> allEvals = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
        if (allEvals.isEmpty()) {
            throw new ResourceNotFoundException(
                    "Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName()
            );
        }

        List<String> availableProviders = allEvals.stream()
                .map(StudentEvaluation::getProvider)
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .distinct()
                .collect(Collectors.toList());

        // Select requested provider or default to Gemini or first available
        StudentEvaluation eval = null;
        if (provider != null && !provider.trim().isEmpty()) {
            String target = provider.trim().toLowerCase();
            eval = allEvals.stream()
                    .filter(e -> e.getProvider() != null && e.getProvider().equalsIgnoreCase(target))
                    .findFirst()
                    .orElse(null);
        }
        if (eval == null) {
            eval = allEvals.stream()
                    .filter(e -> "gemini".equalsIgnoreCase(e.getProvider()))
                    .findFirst()
                    .orElse(allEvals.get(0));
        }

        TeacherFeedback fb = feedbackRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                .orElse(null);

        // 1. Authoritative mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT)
        Integer sectionNumber = parseSectionNumber(eval.getSectionId());
        String yearStr = null;
        for (StudentEvaluation e : allEvals) {
            if (e.getRawJson() != null && !e.getRawJson().isEmpty()) {
                try {
                    JsonNode sNode = objectMapper.readTree(e.getRawJson());
                    if (sNode.hasNonNull("year")) yearStr = sNode.get("year").asText();
                    else if (sNode.hasNonNull("year_level")) yearStr = sNode.get("year_level").asText();
                    if (yearStr != null) break;
                } catch (Exception ignored) {}
            }
        }

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
            // Database-level existence check avoiding slow remote HTTP HEAD roundtrip to Backblaze B2
            if (storageKey != null && !storageKey.trim().isEmpty()) {
                pdfAvailable = true;
            }
        }

        // 2. Build multi-provider bundled reports map for instant 0ms client-side switching
        Map<String, SingleStudentReportResponse> reportsMap = new LinkedHashMap<>();
        for (StudentEvaluation e : allEvals) {
            SingleStudentReportResponse r = buildSingleReportDto(e, availableProviders, pdfAvailable, pdfFilename, submissionId, submissionFileId, fb);
            String pKey = e.getProvider() != null ? e.getProvider().toLowerCase() : "default";
            reportsMap.put(pKey, r);
        }

        // 3. Build active report and attach bundled reports map
        SingleStudentReportResponse activeReport = buildSingleReportDto(eval, availableProviders, pdfAvailable, pdfFilename, submissionId, submissionFileId, fb);
        activeReport.setReports(reportsMap);

        return activeReport;
    }

    private SingleStudentReportResponse buildSingleReportDto(
            StudentEvaluation eval,
            List<String> availableProviders,
            boolean pdfAvailable,
            String pdfFilename,
            Long submissionId,
            Long submissionFileId,
            TeacherFeedback fb
    ) {
        Map<String, Object> criteriaScoresMap = null;
        List<String> strengthsList = null;
        List<String> recommendationsList = null;
        Map<String, Object> extractionMap = null;
        Map<String, Object> ocrMap = null;
        Map<String, Object> sourceMap = null;
        String rawMarkdown = null;

        if (eval.getRawJson() != null && !eval.getRawJson().isEmpty()) {
            try {
                JsonNode sNode = objectMapper.readTree(eval.getRawJson());
                if (sNode.hasNonNull("full_report_markdown")) {
                    rawMarkdown = sNode.get("full_report_markdown").asText();
                } else if (sNode.hasNonNull("evaluation")) {
                    rawMarkdown = sNode.get("evaluation").asText();
                }

                if (sNode.has("criteria_scores")) {
                    criteriaScoresMap = objectMapper.convertValue(sNode.get("criteria_scores"), new TypeReference<Map<String, Object>>() {});
                }
                if (sNode.has("strengths")) {
                    strengthsList = objectMapper.convertValue(sNode.get("strengths"), new TypeReference<List<String>>() {});
                }
                if (sNode.has("recommendations")) {
                    recommendationsList = objectMapper.convertValue(sNode.get("recommendations"), new TypeReference<List<String>>() {});
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
            } catch (Exception e) {
                log.warn("Failed to parse rawJson for student {} and week {}: {}", eval.getStudentId(), eval.getWeek(), e.getMessage());
            }
        }

        return SingleStudentReportResponse.builder()
                .studentId(eval.getStudentId())
                .week(eval.getWeek())
                .sectionId(eval.getSectionId())
                .provider(eval.getProvider())
                .modelName(eval.getModelName())
                .grade(eval.getGrade())
                .status(eval.getStatus())
                .availableProviders(availableProviders)
                .finalScore(eval.getFinalScore())
                .assessment(eval.getAssessment())
                .objectiveScore(eval.getObjectiveScore())
                .problemUnderstandingScore(eval.getProblemUnderstandingScore())
                .logicScore(eval.getLogicScore())
                .variablesScore(eval.getVariablesScore())
                .observationScore(eval.getObservationScore())
                .totalScore(eval.getTotalScore())
                .criteriaScores(criteriaScoresMap)
                .strengths(strengthsList)
                .recommendations(recommendationsList)
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
     */
    @Transactional(readOnly = true)
    public SubmissionService.DownloadableFile loadStudentPdf(String studentId, String week) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        List<StudentEvaluation> evals = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
        if (evals.isEmpty()) {
            throw new ResourceNotFoundException("Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName());
        }
        StudentEvaluation eval = evals.get(0);

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

        InputStream inputStream;
        try {
            inputStream = storageService.openStream(storageKey);
        } catch (java.io.FileNotFoundException e) {
            throw new ResourceNotFoundException("PDF file not found in storage with key: " + storageKey);
        } catch (IOException e) {
            throw new IllegalStateException("Could not read PDF from storage: " + pdfFile.getOriginalFilename(), e);
        }

        log.info("Authorized PDF download studentId={} week={} submissionId={} storageKey={} type=pdf",
                normalizedId, weekInfo.displayName(), matchingSubmission.getId(), storageKey);

        Resource resource = new InputStreamResource(inputStream);
        return new SubmissionService.DownloadableFile(resource, pdfFile.getOriginalFilename(), "application/pdf");
    }

    /**
     * Saves or updates teacher feedback for a specific (studentId, week).
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

        // If score update is included with feedback submission, persist it across matching evaluation records
        if (request.getFinalScore() != null && !request.getFinalScore().trim().isEmpty()) {
            double numScore = validateAndExtractNumericScore(request.getFinalScore(), request.getNumericScore());
            String formattedScore = formatFinalScoreString(request.getFinalScore(), numScore);
            List<StudentEvaluation> evals = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
            for (StudentEvaluation eval : evals) {
                eval.setFinalScore(formattedScore);
                if (request.getObjectiveScore() != null) eval.setObjectiveScore(request.getObjectiveScore().trim());
                if (request.getProblemUnderstandingScore() != null) eval.setProblemUnderstandingScore(request.getProblemUnderstandingScore().trim());
                if (request.getLogicScore() != null) eval.setLogicScore(request.getLogicScore().trim());
                if (request.getVariablesScore() != null) eval.setVariablesScore(request.getVariablesScore().trim());
                if (request.getObservationScore() != null) eval.setObservationScore(request.getObservationScore().trim());
                if (request.getTotalScore() != null) eval.setTotalScore(request.getTotalScore().trim());
                evaluationRepository.save(eval);
            }
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
     */
    @Transactional
    public SingleStudentReportResponse updateScore(ScoreUpdateRequest request, String teacherEmail) {
        String normalizedId = request.getStudentId().trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(request.getWeek());

        double numericScore = validateAndExtractNumericScore(request.getFinalScore(), request.getNumericScore());
        String formattedFinalScore = formatFinalScoreString(request.getFinalScore(), numericScore);

        List<StudentEvaluation> evals = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
        if (evals.isEmpty()) {
            throw new ResourceNotFoundException(
                    "Evaluation not found for student " + normalizedId + " and " + weekInfo.displayName()
            );
        }

        for (StudentEvaluation eval : evals) {
            eval.setFinalScore(formattedFinalScore);
            if (request.getObjectiveScore() != null) eval.setObjectiveScore(request.getObjectiveScore().trim());
            if (request.getProblemUnderstandingScore() != null) eval.setProblemUnderstandingScore(request.getProblemUnderstandingScore().trim());
            if (request.getLogicScore() != null) eval.setLogicScore(request.getLogicScore().trim());
            if (request.getVariablesScore() != null) eval.setVariablesScore(request.getVariablesScore().trim());
            if (request.getObservationScore() != null) eval.setObservationScore(request.getObservationScore().trim());
            if (request.getTotalScore() != null) eval.setTotalScore(request.getTotalScore().trim());
            evaluationRepository.save(eval);
        }

        log.info("Teacher {} updated scores for {} and {} to {}", teacherEmail, normalizedId, weekInfo.displayName(), formattedFinalScore);

        return getStudentReport(normalizedId, weekInfo.displayName(), null);
    }

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
     * Deletes an evaluation report (optionally scoped to provider) and associated teacher feedback.
     */
    @Transactional
    public void deleteStudentReport(String studentId, String week) {
        deleteStudentReport(studentId, week, null);
    }

    @Transactional
    public void deleteStudentReport(String studentId, String week, String provider) {
        String normalizedId = studentId.trim().toUpperCase();
        WeekInfo weekInfo = normalizeWeek(week);

        if (provider != null && !provider.trim().isEmpty()) {
            evaluationRepository.findByStudentIdAndWeekAndProvider(normalizedId, weekInfo.displayName(), provider.trim().toLowerCase())
                    .ifPresent(evaluationRepository::delete);
        } else {
            List<StudentEvaluation> evals = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
            evaluationRepository.deleteAll(evals);
        }

        List<StudentEvaluation> remaining = evaluationRepository.findAllByStudentIdAndWeek(normalizedId, weekInfo.displayName());
        if (remaining.isEmpty()) {
            feedbackRepository.findByStudentIdAndWeek(normalizedId, weekInfo.displayName())
                    .ifPresent(feedbackRepository::delete);
        }

        log.info("Deleted evaluation report for {} and {} (provider: {})", normalizedId, weekInfo.displayName(), provider);
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
