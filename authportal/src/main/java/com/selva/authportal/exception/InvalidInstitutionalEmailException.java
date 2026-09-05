package com.selva.authportal.exception;

/**
 * Thrown when an email does not conform to RGUKTN institutional email requirements.
 */
public class InvalidInstitutionalEmailException extends RuntimeException {
    public InvalidInstitutionalEmailException(String message) {
        super(message);
    }
}
