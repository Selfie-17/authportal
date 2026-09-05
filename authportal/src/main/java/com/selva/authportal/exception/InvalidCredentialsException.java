package com.selva.authportal.exception;

/**
 * Thrown when user credentials (email or password) are invalid during authentication.
 * Employs a generic error message to protect against user enumeration attacks.
 */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
