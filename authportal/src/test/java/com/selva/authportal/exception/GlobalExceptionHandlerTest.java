package com.selva.authportal.exception;

import com.selva.authportal.dto.ErrorResponse;
import org.apache.catalina.connector.ClientAbortException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;
    private MockHttpServletResponse servletResponse;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
        servletResponse = new MockHttpServletResponse();
    }

    @Test
    @DisplayName("Should detect Broken Pipe as client abort and return null without writing JSON")
    void testBrokenPipeReturnsNull() {
        IOException ex = new IOException("Broken pipe");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIoException(ex, servletResponse);
        assertThat(response).isNull();
    }

    @Test
    @DisplayName("Should detect ClientAbortException as client abort and return null")
    void testClientAbortExceptionReturnsNull() {
        ClientAbortException ex = new ClientAbortException(new IOException("Connection reset by peer"));
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIoException(ex, servletResponse);
        assertThat(response).isNull();
    }

    @Test
    @DisplayName("Should handle AsyncRequestNotUsableException cleanly without throwing")
    void testAsyncRequestNotUsableExceptionHandledCleanly() {
        AsyncRequestNotUsableException ex = new AsyncRequestNotUsableException("Response not usable after response errors");
        exceptionHandler.handleUnusableResponse(ex);
        // Method completes without attempting to write to output
        assertThat(ClientDisconnectDetector.isClientAbort(ex)).isTrue();
    }

    @Test
    @DisplayName("Should detect Self-suppression not permitted as client abort and return null")
    void testSelfSuppressionHandledWithoutSecondJsonError() {
        IllegalArgumentException ex = new IllegalArgumentException("Self-suppression not permitted");
        assertThat(ClientDisconnectDetector.isClientAbort(ex)).isTrue();

        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgumentException(ex, servletResponse);
        assertThat(response).isNull();
    }

    @Test
    @DisplayName("Should skip JSON error body if response is already committed")
    void testSkippedWhenResponseCommitted() {
        MockHttpServletResponse committedResponse = new MockHttpServletResponse() {
            @Override
            public boolean isCommitted() {
                return true;
            }
        };

        Exception ex = new RuntimeException("Unexpected runtime error during streaming");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleGeneralException(ex, committedResponse);
        assertThat(response).isNull();
    }

    @Test
    @DisplayName("Should return clean JSON error response for normal application exceptions")
    void testNormalResourceNotFoundReturnsJson() {
        ResourceNotFoundException ex = new ResourceNotFoundException("Submission not found with id: 42");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleResourceNotFound(ex);

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("RESOURCE_NOT_FOUND");
        assertThat(response.getBody().getMessage()).isEqualTo("Submission not found with id: 42");
    }

    @Test
    @DisplayName("Should return clean JSON error response for normal invalid arguments")
    void testNormalInvalidArgumentReturnsJson() {
        IllegalArgumentException ex = new IllegalArgumentException("Invalid week number: 15");
        ResponseEntity<ErrorResponse> response = exceptionHandler.handleIllegalArgumentException(ex, servletResponse);

        assertThat(response).isNotNull();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("INVALID_ARGUMENT");
        assertThat(response.getBody().getMessage()).isEqualTo("Invalid week number: 15");
    }
}
