package com.selva.authportal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Custom access denied handler returning standard JSON error responses for 403 Forbidden errors.
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpStatus.FORBIDDEN.value());

        String jsonResponse = String.format(
                "{\"timestamp\":\"%s\",\"status\":%d,\"code\":\"FORBIDDEN\",\"message\":\"You do not have permission to access this resource.\"}",
                Instant.now(),
                HttpStatus.FORBIDDEN.value()
        );

        response.getWriter().write(jsonResponse);
    }
}
