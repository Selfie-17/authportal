package com.selva.authportal.service;

import com.selva.authportal.model.Submission;
import com.selva.authportal.model.SubmissionFile;
import com.selva.authportal.util.SubmissionPathUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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
 *
 * Files are selected from Aiven submission_files.storage_key (exact B2 object keys).
 * This service never lists a broad B2 prefix such as "submissions/".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZipArchiveService {

    private final StorageService storageService;

    public record ZipSourceFile(
            String studentId,
            int section,
            String originalFilename,
            String storageKey,
            Instant createdAt
    ) {
    }

    /**
     * Copies ZIP metadata off Hibernate entities so async streaming does not touch a closed persistence context.
     */
    public List<ZipSourceFile> snapshotSourceFiles(List<Submission> submissions) {
        List<ZipSourceFile> sources = new ArrayList<>();
        if (submissions == null) {
            return sources;
        }
        for (Submission submission : submissions) {
            if (submission.getFiles() == null || submission.getFiles().isEmpty()) {
                continue;
            }
            for (SubmissionFile file : submission.getFiles()) {
                String storageKey = (file.getStorageKey() != null && !file.getStorageKey().trim().isEmpty())
                        ? file.getStorageKey()
                        : SubmissionPathUtils.buildStorageKey(submission.getStoragePath(), file.getStoredFilename());
                sources.add(new ZipSourceFile(
                        submission.getStudentId(),
                        submission.getSection(),
                        file.getOriginalFilename(),
                        storageKey,
                        file.getCreatedAt()
                ));
            }
        }
        return sources;
    }

    /**
     * Streams a compressed ZIP archive containing all matching lab submissions.
     * Empty submissions lists produce a ZIP containing a descriptive README.txt notice.
     */
    public void generateSubmissionsZip(List<Submission> submissions, Integer week, Integer section, OutputStream outputStream) throws IOException {
        writeZip(snapshotSourceFiles(submissions), submissions == null ? 0 : submissions.size(), week, section, outputStream);
    }

    public void writeZip(List<ZipSourceFile> sources, int submissionCount, Integer week, Integer section, OutputStream outputStream) throws IOException {
        log.info("ZIP generation started week={} section={} submissions={} files={}",
                week, section, submissionCount, sources == null ? 0 : sources.size());

        try (ZipOutputStream zipOut = new ZipOutputStream(outputStream)) {
            if (sources == null || sources.isEmpty()) {
                ZipEntry emptyNotice = new ZipEntry("README.txt");
                zipOut.putNextEntry(emptyNotice);
                String msg;
                if (submissionCount == 0) {
                    msg = "No submissions found matching criteria for Week " + week +
                            (section != null ? ", Section " + section : "") + ".\n";
                } else {
                    msg = "No physical submission files were found in storage for Week " + week +
                            (section != null ? ", Section " + section : "") + ".\n\n" +
                            "Submissions registered in database: " + submissionCount + "\n";
                }
                zipOut.write(msg.getBytes(StandardCharsets.UTF_8));
                zipOut.closeEntry();
                zipOut.finish();
                return;
            }

            Set<String> addedEntries = new HashSet<>();
            List<String> missingFiles = new ArrayList<>();

            for (ZipSourceFile file : sources) {
                String entryPath;
                if (section != null) {
                    entryPath = String.format("week-%d-sec-%d/%s/%s",
                            week, section, file.studentId(), file.originalFilename());
                } else {
                    entryPath = String.format("week-%d/sec-%d/%s/%s",
                            week, file.section(), file.studentId(), file.originalFilename());
                }

                if (!addedEntries.add(entryPath.toLowerCase())) {
                    continue;
                }

                try (InputStream is = storageService.openStream(file.storageKey())) {
                    ZipEntry zipEntry = new ZipEntry(entryPath);
                    if (file.createdAt() != null) {
                        zipEntry.setTime(file.createdAt().toEpochMilli());
                    }
                    zipOut.putNextEntry(zipEntry);
                    is.transferTo(zipOut);
                    zipOut.closeEntry();
                } catch (FileNotFoundException ex) {
                    log.warn("Submission file not found in storage at {}. Skipping from ZIP.", file.storageKey());
                    addedEntries.remove(entryPath.toLowerCase());
                    missingFiles.add(String.format("Student %s: %s (file missing in storage)",
                            file.studentId(), file.originalFilename()));
                }
            }

            if (addedEntries.isEmpty()) {
                ZipEntry emptyNotice = new ZipEntry("README.txt");
                zipOut.putNextEntry(emptyNotice);
                StringBuilder sb = new StringBuilder();
                sb.append("No physical submission files were found in storage for Week ").append(week);
                if (section != null) {
                    sb.append(", Section ").append(section);
                }
                sb.append(".\n\n");
                sb.append("Submissions registered in database: ").append(submissionCount).append("\n");
                if (!missingFiles.isEmpty()) {
                    sb.append("Missing files detail:\n");
                    for (String mf : missingFiles) {
                        sb.append(" - ").append(mf).append("\n");
                    }
                }
                sb.append("\nNote: When using local ephemeral container storage, files do not persist across restarts. Configure Backblaze B2 (STORAGE_TYPE=backblaze) for durable persistence.\n");
                zipOut.write(sb.toString().getBytes(StandardCharsets.UTF_8));
                zipOut.closeEntry();
            } else if (!missingFiles.isEmpty()) {
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
            log.info("ZIP generation finished week={} section={} entries={} missing={}",
                    week, section, addedEntries.size(), missingFiles.size());
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
