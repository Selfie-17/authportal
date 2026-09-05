package com.selva.authportal.exception;

/**
 * Thrown when an uploaded file violates security rules (disallowed extension, executable content, empty file, etc.).
 */
public class FileValidationException extends RuntimeException {
    public FileValidationException(String message) {
        super(message);
    }
}
