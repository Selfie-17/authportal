package com.selva.authportal.web;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class RequestLoggingObservationHandlerTest {

    @Test
    void logsAuthenticationOutcomeAndDuration(CapturedOutput output) {
        logRequest("POST", "/api/auth/login", "/api/auth/login", 401, Long.MAX_VALUE);

        assertThat(output.getAll()).contains("http_request method=POST route=/api/auth/login status=401 duration_ms=");
    }

    @Test
    void logsSlowRequestsAndServerErrorsUsingOnlyRouteTemplates(CapturedOutput output) {
        logRequest("GET", "/api/submissions/123", "/api/submissions/{id}", 200, 0);
        logRequest("GET", "/private-path", null, 503, Long.MAX_VALUE);

        assertThat(output.getAll())
                .contains("http_request method=GET route=/api/submissions/{id} status=200 duration_ms=",
                        "http_request method=GET route=UNMATCHED status=503 duration_ms=")
                .doesNotContain("/api/submissions/123", "/private-path", "private-query", "private-token");
    }

    @Test
    void logsGoogleCallbackWithoutItsAuthorizationCode(CapturedOutput output) {
        logRequest("GET", "/login/oauth2/code/google", null, 302, Long.MAX_VALUE);

        assertThat(output.getAll())
                .contains("http_request method=GET route=/login/oauth2/code/{registrationId} status=302 duration_ms=")
                .doesNotContain("private-query");
    }

    @Test
    void skipsRoutineHealthChecks(CapturedOutput output) {
        logRequest("GET", "/health", "/health", 200, Long.MAX_VALUE);

        assertThat(output.getAll()).doesNotContain("http_request");
    }

    private void logRequest(String method, String path, String pattern, int status, long thresholdMs) {
        var handler = new RequestLoggingObservationHandler(thresholdMs);
        var request = new MockHttpServletRequest(method, path);
        request.setQueryString("code=private-query");
        request.addHeader("Authorization", "Bearer private-token");
        var response = new MockHttpServletResponse();
        var context = new ServerRequestObservationContext(request, response);
        handler.onStart(context);
        context.setPathPattern(pattern);
        response.setStatus(status);
        handler.onStop(context);
    }
}
