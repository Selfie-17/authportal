package com.selva.authportal.exception;

/**
 * Thrown when an authenticated account is marked as disabled or suspended.
 */
public class UserDisabledException extends RuntimeException {
    public UserDisabledException(String message) {
        super(message);
    }
}
