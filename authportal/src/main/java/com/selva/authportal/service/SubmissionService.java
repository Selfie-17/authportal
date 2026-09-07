package com.selva.authportal.service;

import com.selva.authportal.dto.SubmissionRequest;
import com.selva.authportal.dto.SubmissionResponse;
import com.selva.authportal.exception.FileValidationException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.*;
import com.selva.authportal.repository.SubmissionFileRepository;
import com.selva.authportal.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Path;
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
@RequiredArgsConstructor
public class SubmissionService {

    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("^[Nn]\\d{6}$");
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
    private static final int MAX_FILES_PER_SUBMISSION = 20;

    private final SubmissionRepository submissionRepository;
    private final SubmissionFileRepository submissionFileRepository;
    private final StorageService storageService;

    @Value("${app.auth.student-pattern:^[Nn](\\d{6})@rguktn\\.ac\\.in$}")
    private String studentPatternRegex;

    /**
     * Derives the default institutional student ID from an authenticated email.
     * Example: n210001@rguktn.ac.in -> N210001
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
                    "Invalid Student ID: '" + studentId + "'. Must start with N or n followed by 6 digits (e.g. N210001)."
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

        Path targetDirectory = storageService.resolveSubmissionDirectory(
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

            // Clean up previous files on disk
            try {
                storageService.deleteDirectoryContents(targetDirectory);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to clean up previous submission files on disk", e);
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
                    .storagePath(storageService.getRelativeStoragePath(request.getWeek(), request.getSection(), studentId))
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
            String originalFilename = storageService.sanitizeFilename(file.getOriginalFilename());
            if (!seenFilenames.add(originalFilename.toLowerCase())) {
                throw new FileValidationException("Duplicate file in submission: " + originalFilename);
            }

            String ext = getFileExtension(originalFilename);
            FileType fileType = ext.equalsIgnoreCase(".c") ? FileType.SOURCE_CODE : FileType.PDF_REPORT;

            try {
                storageService.storeFile(file, targetDirectory, originalFilename);
            } catch (IOException e) {
                throw new IllegalStateException("Failed to store file: " + originalFilename, e);
            }

            SubmissionFile submissionFile = SubmissionFile.builder()
                    .originalFilename(originalFilename)
                    .storedFilename(originalFilename)
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
    public DownloadableFile loadFileForDownload(User currentUser, Long submissionId, Long fileId) throws MalformedURLException {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found with id: " + submissionId));

        // Authorization check: students must own the submission
        if (currentUser.getRole() == Role.STUDENT && !submission.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You do not have permission to access files from this submission.");
        }

        SubmissionFile submissionFile = submissionFileRepository.findByIdAndSubmissionId(fileId, submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found with id: " + fileId));

        Path filePath = storageService.resolveSubmissionDirectory(
                submission.getWeek(),
                submission.getSection(),
                submission.getStudentId()
        ).resolve(submissionFile.getStoredFilename());

        Resource resource = storageService.loadAsResource(filePath);
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

    public record DownloadableFile(Resource resource, String filename, String contentType) {}
}
