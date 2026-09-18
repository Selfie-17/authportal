package com.selva.authportal.exception;

import com.selva.authportal.dto.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Centralized exception handler providing clean, consistent JSON error responses
 * without leaking database internals or stack traces.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }

        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("VALIDATION_FAILED")
                .message("Input validation failed.")
                .errors(errors)
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(InvalidInstitutionalEmailException.class)
    public ResponseEntity<ErrorResponse> handleInvalidInstitutionalEmail(InvalidInstitutionalEmailException ex) {
        log.warn("Institutional email violation: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("INVALID_INSTITUTIONAL_EMAIL")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(InvalidSubmissionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidSubmission(InvalidSubmissionException ex) {
        log.warn("Invalid submission attempt: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("INVALID_SUBMISSION")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(FileValidationException.class)
    public ResponseEntity<ErrorResponse> handleFileValidation(FileValidationException ex) {
        log.warn("File security validation failed: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("INVALID_FILE")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }


    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<ErrorResponse> handleUserAlreadyExists(UserAlreadyExistsException ex) {
        log.warn("Registration conflict: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.CONFLICT.value())
                .code("USER_ALREADY_EXISTS")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        log.warn("Failed authentication attempt: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .code("INVALID_CREDENTIALS")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(UserDisabledException.class)
    public ResponseEntity<ErrorResponse> handleUserDisabled(UserDisabledException ex) {
        log.warn("Disabled user attempted action: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.FORBIDDEN.value())
                .code("ACCOUNT_DISABLED")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.NOT_FOUND.value())
                .code("RESOURCE_NOT_FOUND")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(OAuthAuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleOAuthAuthenticationException(OAuthAuthenticationException ex) {
        log.warn("OAuth authentication failed: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("OAUTH_ERROR")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationException.class})
    public ResponseEntity<ErrorResponse> handleAuthenticationException(Exception ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .code("UNAUTHORIZED")
                .message("Authentication failed. Please verify your credentials.")
                .build();
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.FORBIDDEN.value())
                .code("ACCESS_DENIED")
                .message("You do not have permission to access this resource.")
                .build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(
            IllegalArgumentException ex,
            HttpServletResponse servletResponse
    ) {
        if (ClientDisconnectDetector.isClientAbort(ex) || isCommitted(servletResponse)) {
            log.info("Client disconnected while writing response; skipping JSON error body ({})", ex.getMessage());
            return null;
        }
        log.warn("Invalid argument: {}", ex.getMessage());
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .code("INVALID_ARGUMENT")
                .message(ex.getMessage())
                .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * Client/proxy aborted the connection (timeout, navigation, or closed socket).
     * Do not attempt a JSON error body — Jackson would write to a dead stream and
     * can raise "Self-suppression not permitted" when the same failure is added as suppressed.
     */
    @ExceptionHandler({
            AsyncRequestNotUsableException.class,
            HttpMessageNotWritableException.class
    })
    public void handleUnusableResponse(Exception ex) {
        if (ClientDisconnectDetector.isClientAbort(ex)) {
            log.info("Client disconnected during response write: {}", rootMessage(ex));
            return;
        }
        log.warn("Response could not be written: {}", rootMessage(ex));
    }

    @ExceptionHandler(IOException.class)
    public ResponseEntity<ErrorResponse> handleIoException(IOException ex, HttpServletResponse servletResponse) {
        if (ClientDisconnectDetector.isClientAbort(ex) || isCommitted(servletResponse)) {
            log.info("Client aborted connection: {}", rootMessage(ex));
            return null;
        }
        return handleGeneralException(ex, servletResponse);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(Exception ex, HttpServletResponse servletResponse) {
        if (ClientDisconnectDetector.isClientAbort(ex) || isCommitted(servletResponse)) {
            log.info("Skipping JSON error response after client disconnect or committed output: {}",
                    ex.getClass().getSimpleName());
            return null;
        }
        log.error("Unhandled exception caught: ", ex);
        ErrorResponse response = ErrorResponse.builder()
                .timestamp(Instant.now())
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .code("INTERNAL_SERVER_ERROR")
                .message("An unexpected error occurred. Please try again later.")
                .build();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private static boolean isCommitted(HttpServletResponse servletResponse) {
        return servletResponse != null && servletResponse.isCommitted();
    }

    private static String rootMessage(Throwable ex) {
        Throwable current = ex;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() != null ? current.getMessage() : ex.getClass().getSimpleName();
    }
}
