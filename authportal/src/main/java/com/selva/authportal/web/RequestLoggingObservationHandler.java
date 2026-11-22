package com.selva.authportal.web;

import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class RequestLoggingObservationHandler implements ObservationHandler<ServerRequestObservationContext> {

    private static final Object START_TIME = new Object();

    private final long slowRequestMs;

    public RequestLoggingObservationHandler(@Value("${app.logging.slow-request-ms:1000}") long slowRequestMs) {
        this.slowRequestMs = slowRequestMs;
    }

    @Override
    public boolean supportsContext(Observation.Context context) {
        return context instanceof ServerRequestObservationContext;
    }

    @Override
    public void onStart(ServerRequestObservationContext context) {
        context.put(START_TIME, System.nanoTime());
    }

    @Override
    public void onStop(ServerRequestObservationContext context) {
        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - context.<Long>getRequired(START_TIME));
        int status = context.getResponse().getStatus();
        String method = context.getCarrier().getMethod();
        String route = routeLabel(context);

        if (durationMs >= slowRequestMs || status >= 500 || context.getError() != null) {
            log.warn("http_request method={} route={} status={} duration_ms={}", method, route, status, durationMs);
        } else if (!"OPTIONS".equals(method) && (route.startsWith("/api/auth/") || route.startsWith("/oauth2/")
                || route.startsWith("/login/oauth2/"))) {
            log.info("http_request method={} route={} status={} duration_ms={}", method, route, status, durationMs);
        }
    }

    private String routeLabel(ServerRequestObservationContext context) {
        String pattern = context.getPathPattern();
        if (pattern != null && !pattern.equals("/**")) {
            return pattern;
        }

        // Spring Security handles these redirects before MVC can supply a route pattern.
        var request = context.getCarrier();
        if (request.getRequestURI().equals(request.getContextPath() + "/oauth2/authorization/google")) {
            return "/oauth2/authorization/{registrationId}";
        }
        if (request.getRequestURI().equals(request.getContextPath() + "/login/oauth2/code/google")) {
            return "/login/oauth2/code/{registrationId}";
        }
        return "UNMATCHED";
    }
}
