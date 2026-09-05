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
     * Streams a structured ZIP archive containing submissions directly to the provided OutputStream.
     * Preserves the student ID directory for every student.
     *
     * @param submissions List of submissions matching teacher filter
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

            for (Submission submission : submissions) {
                Path studentDir = storageService.resolveSubmissionDirectory(
                        submission.getWeek(),
                        submission.getSection(),
                        submission.getStudentId()
                );

                if (submission.getFiles() == null || submission.getFiles().isEmpty()) {
                    continue;
                }

                for (SubmissionFile file : submission.getFiles()) {
                    Path filePath = studentDir.resolve(file.getStoredFilename());
                    if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
                        log.warn("Submission file not found on disk at {}. Skipping from ZIP.", filePath);
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
                        zipEntry.setSize(Files.size(filePath));
                        zipEntry.setTime(file.getCreatedAt().toEpochMilli());
                        zipOut.putNextEntry(zipEntry);
                        Files.copy(filePath, zipOut);
                        zipOut.closeEntry();
                    }
                }
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
