package com.selva.authportal.util;

import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

/**
 * Utility class for academic submission path generation, student ID validation,
 * and filename sanitization. Independent of underlying storage medium.
 */
public final class SubmissionPathUtils {

    private static final Pattern STUDENT_ID_SANITIZER = Pattern.compile("^[A-Za-z0-9_-]{3,16}$");

    private SubmissionPathUtils() {
        // Prevent instantiation
    }

    /**
     * Sanitizes an uploaded file's original name, stripping all directory delimiters and invalid characters.
     *
     * @param originalFilename Raw filename from client multipart request
     * @return Clean, single-token filename
     */
    public static String sanitizeFilename(String originalFilename) {
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
     * Generates the canonical relative storage path for a submission.
     * Format: submissions/week-{week}/sec-{section}/{studentId}
     *
     * @param week       Week number (1-12)
     * @param section    Section number (1-6)
     * @param studentId  Student ID
     * @return Canonical relative path
     */
    public static String resolveRelativeStoragePath(int week, int section, String studentId) {
        if (week < 1 || week > 12) {
            throw new IllegalArgumentException("Invalid week number: " + week + ". Must be between 1 and 12.");
        }
        if (section < 1 || section > 6) {
            throw new IllegalArgumentException("Invalid section number: " + section + ". Must be between 1 and 6.");
        }
        if (studentId == null || !STUDENT_ID_SANITIZER.matcher(studentId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid student ID format: " + studentId);
        }

        return "submissions/week-" + week + "/sec-" + section + "/" + studentId.trim().toUpperCase();
    }

    /**
     * Combines storage path and stored filename into a canonical storage key.
     * Example: "submissions/week-1/sec-1/N210001/main.c"
     *
     * @param storagePath    Relative path (e.g. "submissions/week-1/sec-1/N210001")
     * @param storedFilename Sanitized stored filename (e.g. "main.c")
     * @return Canonical storage key
     */
    public static String buildStorageKey(String storagePath, String storedFilename) {
        if (storagePath == null || storagePath.trim().isEmpty()) {
            throw new IllegalArgumentException("Storage path cannot be empty.");
        }
        if (storedFilename == null || storedFilename.trim().isEmpty()) {
            throw new IllegalArgumentException("Stored filename cannot be empty.");
        }
        String cleanPath = storagePath.replace('\\', '/').replaceAll("^/+", "").replaceAll("/+$", "");
        String cleanFile = storedFilename.replace('\\', '/').replaceAll("^/+", "");
        return cleanPath + "/" + cleanFile;
    }
}
