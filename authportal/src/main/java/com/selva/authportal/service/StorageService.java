package com.selva.authportal.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.util.Comparator;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Service managing filesystem storage for academic submissions.
 * Enforces strict path traversal defenses, sanitized directory generation,
 * and isolated student storage folders.
 *
 * Folder Hierarchy:
 * storage/
 * └── submissions/
 *     └── week-{week}/
 *         └── sec-{section}/
 *             └── {studentId}/
 *                 ├── program.c
 *                 └── assignment.pdf
 */
@Slf4j
@Service
public class StorageService {

    private static final Pattern STUDENT_ID_SANITIZER = Pattern.compile("^[A-Za-z0-9_-]{3,16}$");

    private final Path rootLocation;

    public StorageService(@Value("${app.storage.base-path:storage}") String basePath) {
        this.rootLocation = Paths.get(basePath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(rootLocation);
            Files.createDirectories(rootLocation.resolve("submissions"));
            log.info("Initialized local file storage root at: {}", rootLocation);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize storage directory: " + rootLocation, e);
        }
    }

    /**
     * Resolves and validates the server-side target directory for a student submission.
     * Path formula: submissions/week-{week}/sec-{section}/{studentId}/
     * Strictly verifies that the resolved path does not escape the storage root.
     *
     * @param week       Week number (1–12)
     * @param section    Section number (1–6)
     * @param studentId  Validated student ID (e.g. N210001)
     * @return Validated Path within the storage root
     */
    public Path resolveSubmissionDirectory(int week, int section, String studentId) {
        if (week < 1 || week > 12) {
            throw new IllegalArgumentException("Invalid week number: " + week + ". Must be between 1 and 12.");
        }
        if (section < 1 || section > 6) {
            throw new IllegalArgumentException("Invalid section number: " + section + ". Must be between 1 and 6.");
        }
        if (studentId == null || !STUDENT_ID_SANITIZER.matcher(studentId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid student ID format: " + studentId);
        }

        String sanitizedStudentId = studentId.trim().toUpperCase();

        Path submissionDir = rootLocation
                .resolve("submissions")
                .resolve("week-" + week)
                .resolve("sec-" + section)
                .resolve(sanitizedStudentId)
                .normalize();

        // Path traversal defense
        if (!submissionDir.startsWith(rootLocation)) {
            throw new SecurityException("Potential path traversal attempt detected for path: " + submissionDir);
        }

        return submissionDir;
    }

    /**
     * Returns the relative path for database storage (e.g. submissions/week-1/sec-1/N210001).
     */
    public String getRelativeStoragePath(int week, int section, String studentId) {
        return "submissions/week-" + week + "/sec-" + section + "/" + studentId.trim().toUpperCase();
    }

    /**
     * Sanitizes an uploaded file's original name, stripping all directory delimiters and invalid characters.
     *
     * @param originalFilename Raw filename from client multipart request
     * @return Clean, single-token filename
     */
    public String sanitizeFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            throw new IllegalArgumentException("Filename cannot be empty.");
        }

        // Strictly reject any traversal attempts or null bytes in the raw filename
        if (originalFilename.contains("..") || originalFilename.contains("\0")) {
            throw new SecurityException("Filename contains invalid or dangerous characters: " + originalFilename);
        }

        String cleaned = StringUtils.cleanPath(originalFilename);

        // Strip path prefix if present (e.g. C:\folder\file.c or /path/file.c)
        int lastUnixSlash = cleaned.lastIndexOf('/');
        int lastWindowsSlash = cleaned.lastIndexOf('\\');
        int lastSlash = Math.max(lastUnixSlash, lastWindowsSlash);
        if (lastSlash >= 0) {
            cleaned = cleaned.substring(lastSlash + 1);
        }

        if (cleaned.trim().isEmpty() || cleaned.contains("..") || cleaned.contains("/") || cleaned.contains("\\")) {
            throw new SecurityException("Filename contains invalid or dangerous characters: " + originalFilename);
        }

        return cleaned;
    }


    /**
     * Writes a multipart file to the target directory on disk.
     *
     * @param file             Uploaded file
     * @param targetDirectory  Destination directory
     * @param storedFilename   Validated filename
     * @return Stored file Path
     */
    public Path storeFile(MultipartFile file, Path targetDirectory, String storedFilename) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store an empty file.");
        }

        // Ensure directory exists
        Files.createDirectories(targetDirectory);

        Path destinationPath = targetDirectory.resolve(storedFilename).normalize();

        // Verify target path remains within target directory
        if (!destinationPath.startsWith(targetDirectory)) {
            throw new SecurityException("Cannot store file outside target directory.");
        }

        Files.copy(file.getInputStream(), destinationPath, StandardCopyOption.REPLACE_EXISTING);
        log.debug("Stored file at: {}", destinationPath);

        return destinationPath;
    }

    /**
     * Cleans up all files in a student's submission directory when replacing/updating a submission.
     *
     * @param directory The submission directory to empty
     */
    public void deleteDirectoryContents(Path directory) throws IOException {
        Path normalized = directory.normalize();
        if (!normalized.startsWith(rootLocation)) {
            throw new SecurityException("Cannot delete directory outside storage root: " + directory);
        }

        if (Files.exists(normalized) && Files.isDirectory(normalized)) {
            try (Stream<Path> stream = Files.walk(normalized)) {
                stream.sorted(Comparator.reverseOrder())
                        .filter(p -> !p.equals(normalized)) // keep the folder itself, remove children
                        .forEach(p -> {
                            try {
                                Files.delete(p);
                            } catch (IOException e) {
                                log.warn("Failed to delete file during cleanup: {}", p, e);
                            }
                        });
            }
            log.info("Cleaned up previous submission files in: {}", normalized);
        }
    }

    /**
     * Loads a file from disk as a Spring Resource for download.
     *
     * @param filePath Absolute or relative path to the file
     * @return Resource representing the file
     */
    public Resource loadAsResource(Path filePath) throws MalformedURLException {
        Path normalized = filePath.normalize();
        if (!normalized.startsWith(rootLocation)) {
            throw new SecurityException("Access denied: File outside storage root.");
        }

        Resource resource = new UrlResource(normalized.toUri());
        if (resource.exists() && resource.isReadable()) {
            return resource;
        } else {
            throw new IllegalArgumentException("File not found or unreadable: " + filePath.getFileName());
        }
    }

    public Path getRootLocation() {
        return rootLocation;
    }
}
