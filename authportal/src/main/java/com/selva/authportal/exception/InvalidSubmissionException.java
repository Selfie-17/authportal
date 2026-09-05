package com.selva.authportal.exception;

/**
 * Thrown when submission business logic or metadata validation fails.
 */
public class InvalidSubmissionException extends RuntimeException {
    public InvalidSubmissionException(String message) {
        super(message);
    }
}
