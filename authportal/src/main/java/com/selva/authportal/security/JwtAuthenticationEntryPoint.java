package com.selva.authportal.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Custom entry point returning standard JSON error responses for unauthenticated requests.
 */
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException authException
    ) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setStatus(HttpStatus.UNAUTHORIZED.value());

        String jsonResponse = String.format(
                "{\"timestamp\":\"%s\",\"status\":%d,\"code\":\"UNAUTHORIZED\",\"message\":\"Full authentication is required to access this resource.\"}",
                Instant.now(),
                HttpStatus.UNAUTHORIZED.value()
        );

        response.getWriter().write(jsonResponse);
    }
}
