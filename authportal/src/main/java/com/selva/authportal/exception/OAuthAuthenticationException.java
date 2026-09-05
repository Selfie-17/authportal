package com.selva.authportal.exception;

/**
 * Thrown when an OAuth identity fails domain validation or provisioning checks.
 */
public class OAuthAuthenticationException extends RuntimeException {
    public OAuthAuthenticationException(String message) {
        super(message);
    }

    public OAuthAuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
