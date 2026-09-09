package com.selva.authportal.service;

import com.selva.authportal.model.Submission;
import com.selva.authportal.model.SubmissionFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Generates structured ZIP archives for teacher batch evaluation.
 *
 * Folder structure:
 * When section is specified:
 *   week-{week}-sec-{section}/
 *   └── {studentId}/
 *       ├── program.c
 *       └── assignment.pdf
 *
 * When section is null (entire week):
 *   week-{week}/
 *   └── sec-{section}/
 *       └── {studentId}/
 *           ├── program.c
 *           └── assignment.pdf
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZipArchiveService {

    private final StorageService storageService;

    /**
     * Streams a compressed ZIP archive containing all matching lab submissions.
     * Empty submissions lists produce a ZIP containing a descriptive README.txt notice.
     *
     * @param submissions Filtered list of student submissions
     * @param week        Selected week (1–12)
     * @param section     Selected section (1–6, or null for all sections)
     * @param outputStream Target output stream for the ZIP
     */
    public void generateSubmissionsZip(List<Submission> submissions, Integer week, Integer section, OutputStream outputStream) throws IOException {
        try (ZipOutputStream zipOut = new ZipOutputStream(outputStream)) {
            if (submissions == null || submissions.isEmpty()) {
                // Write an informational notice entry so the downloaded ZIP is valid
                ZipEntry emptyNotice = new ZipEntry("README.txt");
                zipOut.putNextEntry(emptyNotice);
                String msg = "No submissions found matching criteria for Week " + week +
                        (section != null ? ", Section " + section : "") + ".\n";
                zipOut.write(msg.getBytes(StandardCharsets.UTF_8));
                zipOut.closeEntry();
                zipOut.finish();
                return;
            }

            Set<String> addedEntries = new HashSet<>();
            java.util.List<String> missingFiles = new java.util.ArrayList<>();

            for (Submission submission : submissions) {
                Path studentDir;
                try {
                    studentDir = storageService.resolveSubmissionDirectory(
                            submission.getWeek(),
                            submission.getSection(),
                            submission.getStudentId()
                    );
                } catch (Exception e) {
                    log.warn("Invalid submission directory for student {}: {}", submission.getStudentId(), e.getMessage());
                    missingFiles.add(String.format("Student %s (Week %d, Sec %d): Directory error - %s",
                            submission.getStudentId(), submission.getWeek(), submission.getSection(), e.getMessage()));
                    continue;
                }

                if (submission.getFiles() == null || submission.getFiles().isEmpty()) {
                    continue;
                }

                for (SubmissionFile file : submission.getFiles()) {
                    Path filePath = studentDir.resolve(file.getStoredFilename());
                    if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                        log.warn("Submission file not found on disk at {}. Skipping from ZIP.", filePath);
                        missingFiles.add(String.format("Student %s: %s (file missing on server storage)",
                                submission.getStudentId(), file.getOriginalFilename()));
                        continue;
                    }

                    String entryPath;
                    if (section != null) {
                        entryPath = String.format("week-%d-sec-%d/%s/%s",
                                week, section, submission.getStudentId(), file.getOriginalFilename());
                    } else {
                        entryPath = String.format("week-%d/sec-%d/%s/%s",
                                week, submission.getSection(), submission.getStudentId(), file.getOriginalFilename());
                    }

                    // Avoid duplicate zip entry collisions
                    if (addedEntries.add(entryPath.toLowerCase())) {
                        ZipEntry zipEntry = new ZipEntry(entryPath);
                        if (file.getCreatedAt() != null) {
                            zipEntry.setTime(file.getCreatedAt().toEpochMilli());
                        }
                        zipOut.putNextEntry(zipEntry);
                        Files.copy(filePath, zipOut);
                        zipOut.closeEntry();
                    }
                }
            }

            // If some or all files were missing on disk, add an informative notice entry
            if (addedEntries.isEmpty()) {
                ZipEntry emptyNotice = new ZipEntry("README.txt");
                zipOut.putNextEntry(emptyNotice);
                StringBuilder sb = new StringBuilder();
                sb.append("No physical submission files were found on the server filesystem for Week ").append(week);
                if (section != null) {
                    sb.append(", Section ").append(section);
                }
                sb.append(".\n\n");
                sb.append("Submissions registered in database: ").append(submissions.size()).append("\n");
                if (!missingFiles.isEmpty()) {
                    sb.append("Missing files detail:\n");
                    for (String mf : missingFiles) {
                        sb.append(" - ").append(mf).append("\n");
                    }
                }
                sb.append("\nNote: In cloud deployments (e.g. Render Free Tier), local disk storage is ephemeral and is reset across redeployments or container restarts.\n");
                zipOut.write(sb.toString().getBytes(StandardCharsets.UTF_8));
                zipOut.closeEntry();
            } else if (!missingFiles.isEmpty()) {
                // If some files were present but others missing, add a notice about the missing files
                ZipEntry missingNotice = new ZipEntry("MISSING_FILES_NOTICE.txt");
                zipOut.putNextEntry(missingNotice);
                StringBuilder sb = new StringBuilder();
                sb.append("Notice: Some files recorded in the database were not found on the server filesystem:\n\n");
                for (String mf : missingFiles) {
                    sb.append(" - ").append(mf).append("\n");
                }
                zipOut.write(sb.toString().getBytes(StandardCharsets.UTF_8));
                zipOut.closeEntry();
            }

            zipOut.finish();
        }
    }

    /**
     * Determines the suggested filename for the downloaded ZIP archive.
     */
    public String getArchiveFilename(Integer week, Integer section) {
        if (section != null) {
            return String.format("week-%d-sec-%d.zip", week, section);
        }
        return String.format("week-%d.zip", week);
    }
}
