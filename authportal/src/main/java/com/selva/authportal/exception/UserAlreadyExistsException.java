package com.selva.authportal.exception;

/**
 * Thrown when attempting to register an email address that already exists in the system.
 */
public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String message) {
        super(message);
    }
}
