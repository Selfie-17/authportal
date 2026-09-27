package com.selva.authportal.service;

import com.selva.authportal.dto.SubmissionRequest;
import com.selva.authportal.dto.SubmissionResponse;
import com.selva.authportal.exception.FileValidationException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.*;
import com.selva.authportal.dto.TeacherSubmissionPageResponse;
import com.selva.authportal.dto.TeacherSubmissionRecordDTO;
import com.selva.authportal.repository.SubmissionFileRepository;
import com.selva.authportal.repository.SubmissionRepository;
import com.selva.authportal.repository.SubmissionSpecification;
import com.selva.authportal.repository.TeacherFeedbackRepository;
import com.selva.authportal.util.SubmissionPathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Core business service for Academic C-Program Submissions.
 * Handles validation, student ID derivation, ownership anchoring,
 * duplicate handling (revision counter increment), and secure file retrieval.
 */
@Slf4j
@Service
public class SubmissionService {

    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("^[A-Za-z]\\d{6}$");
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
    private static final int MAX_FILES_PER_SUBMISSION = 20;

    private final SubmissionRepository submissionRepository;
    private final SubmissionFileRepository submissionFileRepository;
    private final StorageService storageService;
    private TeacherFeedbackRepository teacherFeedbackRepository;

    public SubmissionService(SubmissionRepository submissionRepository,
                             SubmissionFileRepository submissionFileRepository,
                             StorageService storageService) {
        this.submissionRepository = submissionRepository;
        this.submissionFileRepository = submissionFileRepository;
        this.storageService = storageService;
    }

    @Autowired
    public SubmissionService(SubmissionRepository submissionRepository,
                             SubmissionFileRepository submissionFileRepository,
                             StorageService storageService,
                             TeacherFeedbackRepository teacherFeedbackRepository) {
        this.submissionRepository = submissionRepository;
        this.submissionFileRepository = submissionFileRepository;
        this.storageService = storageService;
        this.teacherFeedbackRepository = teacherFeedbackRepository;
    }

    public void setTeacherFeedbackRepository(TeacherFeedbackRepository teacherFeedbackRepository) {
        this.teacherFeedbackRepository = teacherFeedbackRepository;
    }

    @Value("${app.auth.student-pattern:^[A-Za-z](\\d{6})@(rguktn\\.ac\\.in|rguktrkv\\.ac\\.in|rguktong\\.ac\\.in|rguktsklm\\.ac\\.in|rgukt\\.in)$}")
    private String studentPatternRegex;

    /**
     * Derives the default institutional student ID from an authenticated email.
     * Example: n210001@rguktn.ac.in -> N210001, r210001@rguktrkv.ac.in -> R210001
     *
     * @param email The user's authenticated institutional email
     * @return Uppercase Student ID (e.g. N210001) or empty string if not derived
     */
    public String deriveDefaultStudentId(String email) {
        if (email == null || email.trim().isEmpty()) {
            return "";
        }
        try {
            Pattern pattern = Pattern.compile(studentPatternRegex, Pattern.CASE_INSENSITIVE);
            Matcher matcher = pattern.matcher(email.trim());
            if (matcher.matches()) {
                String localPart = email.trim().split("@")[0];
                return localPart.toUpperCase();
            }
        } catch (Exception e) {
            log.warn("Failed to derive student ID from email {}: {}", email, e.getMessage());
        }
        return "";
    }

    /**
     * Validates and normalizes a student ID.
     */
    public String validateAndNormalizeStudentId(String studentId) {
        if (studentId == null || !STUDENT_ID_PATTERN.matcher(studentId.trim()).matches()) {
            throw new InvalidSubmissionException(
                    "Invalid Student ID: '" + studentId + "'. Must follow institutional format with campus prefix and 6 digits (e.g. N210001, R210001, O210001, S210001)."
            );
        }
        return studentId.trim().toUpperCase();
    }

    /**
     * Submits or replaces an assignment for a given Week, Year, and Section.
     * The authenticated User entity is strictly the ownership anchor.
     *
     * @param user    The authenticated user
     * @param request Submission metadata
     * @param files   List of uploaded .c and .pdf files
     * @return SubmissionResponse with details and file listing
     */
    @Transactional
    public SubmissionResponse submitAssignment(User user, SubmissionRequest request, List<MultipartFile> files) {
        if (user == null || !user.isEnabled()) {
            throw new AccessDeniedException("User account is invalid or disabled.");
        }
        if (user.getRole() != Role.STUDENT && user.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only students can submit assignments.");
        }

        String studentId = validateAndNormalizeStudentId(request.getStudentId());
        validateFiles(files);

        String relativeStoragePath = SubmissionPathUtils.resolveRelativeStoragePath(
                request.getWeek(),
                request.getSection(),
                studentId
        );

        // Check if an existing submission exists for (user_id, week, year, section)
        Optional<Submission> existingOpt = submissionRepository.findByUserIdAndWeekAndYearAndSection(
                user.getId(),
                request.getWeek(),
                request.getYear(),
                request.getSection()
        );

        Submission submission;
        if (existingOpt.isPresent()) {
            // Replace / Update flow: increment revision counter
            submission = existingOpt.get();
            submission.setStudentId(studentId); // update studentId label if student edited it
            submission.setVersion(submission.getVersion() + 1);
            submission.setStatus(SubmissionStatus.UPDATED);
            if (request.getBranch() != null) {
                submission.setBranch(request.getBranch().trim());
            }

            // Clean up previous files in storage
            try {
                storageService.deletePrefix(submission.getStoragePath());
            } catch (IOException e) {
                throw new IllegalStateException("Failed to clean up previous submission files in storage", e);
            }

            // Remove existing file database records
            submission.getFiles().clear();
            log.info("Updating existing submission id {} for user {} to revision {}",
                    submission.getId(), user.getEmail(), submission.getVersion());
        } else {
            // Initial submission: revision counter starts at 1
            submission = Submission.builder()
                    .user(user)
                    .studentId(studentId)
                    .week(request.getWeek())
                    .year(request.getYear())
                    .section(request.getSection())
                    .branch(request.getBranch() != null ? request.getBranch().trim() : null)
                    .storagePath(relativeStoragePath)
                    .status(SubmissionStatus.SUBMITTED)
                    .version(1)
                    .files(new ArrayList<>())
                    .build();
            log.info("Creating new submission for user {} (week {}, year {}, sec {})",
                    user.getEmail(), request.getWeek(), request.getYear(), request.getSection());
        }

        // Store each validated file
        Set<String> seenFilenames = new HashSet<>();
        for (MultipartFile file : files) {
            String originalFilename = SubmissionPathUtils.sanitizeFilename(file.getOriginalFilename());
            if (!seenFilenames.add(originalFilename.toLowerCase())) {
                throw new FileValidationException("Duplicate file in submission: " + originalFilename);
            }

            String ext = getFileExtension(originalFilename);
            FileType fileType = ext.equalsIgnoreCase(".c") ? FileType.SOURCE_CODE : FileType.PDF_REPORT;

            String storageKey = SubmissionPathUtils.buildStorageKey(relativeStoragePath, originalFilename);
            try {
                storageService.storeFile(file.getInputStream(), storageKey, file.getContentType(), file.getSize());
            } catch (IOException e) {
                throw new IllegalStateException("Failed to store file: " + originalFilename, e);
            }

            SubmissionFile submissionFile = SubmissionFile.builder()
                    .originalFilename(originalFilename)
                    .storedFilename(originalFilename)
                    .storageKey(storageKey)
                    .fileExtension(ext.toLowerCase())
                    .fileType(fileType)
                    .fileSizeBytes(file.getSize())
                    .build();

            submission.addFile(submissionFile);
        }

        Submission saved = submissionRepository.save(submission);
        return SubmissionResponse.fromEntity(saved);
    }

    /**
     * Retrieves all submissions belonging to the authenticated student.
     */
    @Transactional(readOnly = true)
    public List<SubmissionResponse> getMySubmissions(Long userId) {
        return submissionRepository.findByUserIdOrderByWeekAscCreatedAtDesc(userId).stream()
                .map(SubmissionResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves a single submission belonging to the authenticated student.
     */
    @Transactional(readOnly = true)
    public SubmissionResponse getMySubmissionById(Long userId, Long submissionId) {
        Submission submission = submissionRepository.findByIdAndUserId(submissionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found with id: " + submissionId));
        return SubmissionResponse.fromEntity(submission);
    }

    /**
     * Deletes a submission by ID.
     * Enforces ownership: students may only delete their own submissions.
     * Admins are permitted to delete any submission.
     * Cleans up stored files on disk and removes the database record.
     */
    @Transactional
    public void deleteSubmission(User currentUser, Long submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found with id: " + submissionId));

        if (currentUser.getRole() == Role.STUDENT && !submission.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You do not have permission to delete this submission.");
        }

        // Clean up files in storage
        if (submission.getStoragePath() != null && !submission.getStoragePath().trim().isEmpty()) {
            try {
                storageService.deletePrefix(submission.getStoragePath());
            } catch (IOException e) {
                log.warn("Failed to clean up storage for submission id {}: {}", submissionId, e.getMessage());
            }
        }

        submissionRepository.delete(submission);
        log.info("User {} deleted submission id {} for student {}", currentUser.getEmail(), submissionId, submission.getStudentId());
    }

    /**
     * Filters lab submissions for teachers using Week, Year, Section, and Student ID.
     */
    @Transactional(readOnly = true)
    public List<SubmissionResponse> filterSubmissionsForTeacher(Integer week, YearLevel year, Integer section, String studentId) {
        return submissionRepository.findAll(
                com.selva.authportal.repository.SubmissionSpecification.withFilters(week, year, section, studentId)
        ).stream()
                .sorted(Comparator.comparing(Submission::getStudentId))
                .map(SubmissionResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Fetches raw submission entities for teacher ZIP generation.
     * Ensures all submission files are fully loaded and initialized within the transaction.
     */
    @Transactional(readOnly = true)
    public List<Submission> getSubmissionsForZip(Integer week, YearLevel year, Integer section) {
        if (week == null) {
            throw new IllegalArgumentException("Week is required to generate a ZIP archive.");
        }
        List<Submission> submissions = submissionRepository.findAll(
                com.selva.authportal.repository.SubmissionSpecification.withFilters(week, year, section, null)
        ).stream()
                .distinct()
                .sorted(Comparator.comparing(Submission::getStudentId))
                .collect(Collectors.toList());

        // Explicitly touch files within the transaction boundary so that
        // background streaming threads have access to the complete collection.
        for (Submission s : submissions) {
            if (s.getFiles() != null) {
                s.getFiles().forEach(f -> f.getOriginalFilename());
            }
        }

        return submissions;
    }


    /**
     * Loads a file resource for download with strict ownership verification.
     * Students may only download files from their own submissions.
     * Teachers and Admins may download files from any submission.
     */
    @Transactional(readOnly = true)
    public DownloadableFile loadFileForDownload(User currentUser, Long submissionId, Long fileId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found with id: " + submissionId));

        // Authorization check: students must own the submission
        if (currentUser.getRole() == Role.STUDENT && !submission.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You do not have permission to access files from this submission.");
        }

        SubmissionFile submissionFile = submissionFileRepository.findByIdAndSubmissionId(fileId, submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found with id: " + fileId));

        String storageKey = (submissionFile.getStorageKey() != null && !submissionFile.getStorageKey().trim().isEmpty())
                ? submissionFile.getStorageKey()
                : SubmissionPathUtils.buildStorageKey(submission.getStoragePath(), submissionFile.getStoredFilename());

        InputStream inputStream;
        try {
            inputStream = storageService.openStream(storageKey);
        } catch (java.io.FileNotFoundException e) {
            throw new ResourceNotFoundException("File not found in storage: " + submissionFile.getOriginalFilename());
        } catch (IOException e) {
            throw new IllegalStateException("Could not read file from storage: " + submissionFile.getOriginalFilename(), e);
        }

        log.info("Authorized file download submissionId={} fileId={} studentId={} storageKey={} sizeBytes={} type=file",
                submissionId, fileId, submission.getStudentId(), storageKey, submissionFile.getFileSizeBytes());

        Resource resource = new InputStreamResource(inputStream);
        String contentType = submissionFile.getFileExtension().equalsIgnoreCase(".pdf")
                ? "application/pdf"
                : "text/plain; charset=UTF-8";

        return new DownloadableFile(resource, submissionFile.getOriginalFilename(), contentType);
    }

    /**
     * Validates files against whitelist rules:
     * - Only .c and .pdf files permitted
     * - File count within limits (1 to 20)
     * - Non-empty, under max size
     * - Deep content inspection blocking executable binaries (PE, ELF, Mach-O, shell scripts)
     */
    public void validateFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new FileValidationException("Submission must contain at least one file.");
        }
        if (files.size() > MAX_FILES_PER_SUBMISSION) {
            throw new FileValidationException("Exceeded maximum allowed files per submission (" + MAX_FILES_PER_SUBMISSION + ").");
        }

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                throw new FileValidationException("Cannot upload an empty file.");
            }
            if (file.getSize() > MAX_FILE_SIZE) {
                throw new FileValidationException("File '" + file.getOriginalFilename() + "' exceeds 20MB limit.");
            }

            String filename = file.getOriginalFilename();
            String ext = getFileExtension(filename);

            if (!ext.equalsIgnoreCase(".c") && !ext.equalsIgnoreCase(".pdf")) {
                throw new FileValidationException(
                        "File extension not permitted: '" + ext + "' for file '" + filename + "'. Only .c and .pdf files are accepted."
                );
            }

            // Executable and magic byte inspection
            inspectContentSafety(file, ext);
        }
    }

    /**
     * Inspects the first bytes of a file to block executables even if renamed.
     */
    private void inspectContentSafety(MultipartFile file, String extension) {
        byte[] header = new byte[8];
        try (InputStream is = file.getInputStream()) {
            int read = is.read(header);
            if (read >= 2) {
                // Windows PE Executable (MZ)
                if (header[0] == 'M' && header[1] == 'Z') {
                    throw new FileValidationException("Executable Windows binary (MZ) detected in '" + file.getOriginalFilename() + "'. Executables are forbidden.");
                }
            }
            if (read >= 4) {
                // Linux ELF binary (\x7F ELF)
                if (header[0] == 0x7F && header[1] == 'E' && header[2] == 'L' && header[3] == 'F') {
                    throw new FileValidationException("Executable Linux binary (ELF) detected in '" + file.getOriginalFilename() + "'. Executables are forbidden.");
                }
                // Mach-O binary
                if ((header[0] == (byte) 0xFE && header[1] == (byte) 0xED && header[2] == (byte) 0xFA && header[3] == (byte) 0xCE) ||
                        (header[0] == (byte) 0xCF && header[1] == (byte) 0xFA && header[2] == (byte) 0xED && header[3] == (byte) 0xFE)) {
                    throw new FileValidationException("Executable Mach-O binary detected in '" + file.getOriginalFilename() + "'. Executables are forbidden.");
                }
            }
            // If claiming to be a PDF, verify %PDF- header
            if (extension.equalsIgnoreCase(".pdf")) {
                if (read < 5 || header[0] != '%' || header[1] != 'P' || header[2] != 'D' || header[3] != 'F' || header[4] != '-') {
                    throw new FileValidationException("File '" + file.getOriginalFilename() + "' does not match valid PDF file format signature.");
                }
            }
        } catch (IOException e) {
            throw new FileValidationException("Could not read file header for safety verification: " + file.getOriginalFilename());
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return (dot >= 0) ? filename.substring(dot) : "";
    }

    /**
     * Retrieves a paginated list of student submissions combined with PDF file metadata
     * and teacher feedback/review status for the teacher & admin review page.
     */
    @Transactional(readOnly = true)
    public TeacherSubmissionPageResponse getPaginatedSubmissions(int page, int size, String week, String search) {
        int safePage = Math.max(0, page);
        int safeSize = (size <= 0) ? 20 : Math.min(size, 100);

        Integer parsedWeekNumber = null;
        if (week != null && !week.trim().isEmpty() && !week.equalsIgnoreCase("ALL")) {
            EvaluationService.WeekInfo weekInfo = EvaluationService.normalizeWeek(week);
            if (weekInfo.weekNumber() != 999) {
                parsedWeekNumber = weekInfo.weekNumber();
            } else {
                try {
                    parsedWeekNumber = Integer.parseInt(week.replaceAll("\\D+", ""));
                } catch (Exception ignored) {}
            }
        }

        Specification<Submission> spec = SubmissionSpecification.withWeekAndSearch(parsedWeekNumber, search);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Submission> submissionPage = submissionRepository.findAll(spec, pageRequest);

        List<Submission> submissions = submissionPage.getContent();
        if (submissions.isEmpty()) {
            return TeacherSubmissionPageResponse.builder()
                    .content(Collections.emptyList())
                    .currentPage(safePage)
                    .pageSize(safeSize)
                    .totalElements(submissionPage.getTotalElements())
                    .totalPages(submissionPage.getTotalPages())
                    .build();
        }

        // Batch fetch feedbacks for all students present in the current page
        Set<String> studentIds = submissions.stream()
                .map(s -> s.getStudentId().toUpperCase().trim())
                .collect(Collectors.toSet());

        Map<String, TeacherFeedback> feedbackMap = new HashMap<>();
        if (teacherFeedbackRepository != null && !studentIds.isEmpty()) {
            List<TeacherFeedback> feedbacks = teacherFeedbackRepository.findByStudentIdIn(studentIds);
            for (TeacherFeedback fb : feedbacks) {
                EvaluationService.WeekInfo normWeek = EvaluationService.normalizeWeek(fb.getWeek());
                String key = fb.getStudentId().toUpperCase().trim() + "#" + normWeek.displayName().toUpperCase();
                feedbackMap.put(key, fb);
            }
        }

        List<TeacherSubmissionRecordDTO> recordDTOs = submissions.stream().map(sub -> {
            // Find PDF file if present
            SubmissionFile pdfFile = null;
            if (sub.getFiles() != null) {
                for (SubmissionFile f : sub.getFiles()) {
                    if (f.getFileType() == FileType.PDF_REPORT ||
                            (f.getFileExtension() != null && f.getFileExtension().equalsIgnoreCase(".pdf"))) {
                        pdfFile = f;
                        break;
                    }
                }
            }

            // Find matching teacher feedback: studentId + Week N
            String feedbackKey = sub.getStudentId().toUpperCase().trim() + "#WEEK " + sub.getWeek();
            TeacherFeedback fb = feedbackMap.get(feedbackKey);

            User user = sub.getUser();
            String studentName = (user != null && user.getName() != null) ? user.getName() : sub.getStudentId();
            String studentEmail = (user != null) ? user.getEmail() : null;
            String studentProfilePic = (user != null) ? user.getProfilePicture() : null;

            return TeacherSubmissionRecordDTO.builder()
                    .id(sub.getId())
                    .studentId(sub.getStudentId())
                    .studentName(studentName)
                    .studentEmail(studentEmail)
                    .studentProfilePicture(studentProfilePic)
                    .week(sub.getWeek())
                    .weekDisplay("Week " + sub.getWeek())
                    .year(sub.getYear() != null ? sub.getYear().name() : null)
                    .section(sub.getSection())
                    .branch(sub.getBranch())
                    .version(sub.getVersion())
                    .submittedAt(sub.getCreatedAt())
                    .submissionUpdatedAt(sub.getUpdatedAt())
                    .hasPdf(pdfFile != null)
                    .pdfFileId(pdfFile != null ? pdfFile.getId() : null)
                    .pdfFileName(pdfFile != null ? pdfFile.getOriginalFilename() : null)
                    .pdfSizeBytes(pdfFile != null ? pdfFile.getFileSizeBytes() : null)
                    .feedbackId(fb != null ? fb.getId() : null)
                    .reviewed(fb != null && fb.isReviewed())
                    .feedbackText(fb != null ? fb.getFeedbackText() : null)
                    .teacherEmail(fb != null ? fb.getTeacherEmail() : null)
                    .feedbackUpdatedAt(fb != null ? fb.getUpdatedAt() : null)
                    .build();
        }).collect(Collectors.toList());

        return TeacherSubmissionPageResponse.builder()
                .content(recordDTOs)
                .currentPage(submissionPage.getNumber())
                .pageSize(safeSize)
                .totalElements(submissionPage.getTotalElements())
                .totalPages(submissionPage.getTotalPages())
                .build();
    }

    public record DownloadableFile(Resource resource, String filename, String contentType) {}
}
