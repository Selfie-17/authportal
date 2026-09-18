package com.selva.authportal.exception;

import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

/**
 * Detects client/proxy disconnects during response writing.
 * These are not application failures and must not trigger a second JSON error body.
 */
public final class ClientDisconnectDetector {

    private ClientDisconnectDetector() {
    }

    public static boolean isClientAbort(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String name = current.getClass().getName();
            String message = current.getMessage() != null ? current.getMessage() : "";

            if (current instanceof AsyncRequestNotUsableException) {
                return true;
            }
            if (name.endsWith("ClientAbortException") || name.endsWith("EofException")) {
                return true;
            }
            if (containsIgnoreCase(message, "Broken pipe")
                    || containsIgnoreCase(message, "Connection reset")
                    || containsIgnoreCase(message, "An established connection was aborted")
                    || containsIgnoreCase(message, "Response not usable after response errors")
                    || containsIgnoreCase(message, "Self-suppression not permitted")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private static boolean containsIgnoreCase(String message, String fragment) {
        return message.toLowerCase().contains(fragment.toLowerCase());
    }
}
