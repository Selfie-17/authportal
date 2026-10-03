package com.selva.authportal.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Encapsulates an email attachment document (HTML report, JSON, PDF, etc.).
 * Supports byte array, Base64 string, or raw string content.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailAttachment {

    private String name;
    private byte[] content;
    private String base64Content;
    private String contentType;
    @Builder.Default
    private boolean inline = false;

    public byte[] getBytes() {
        if (content != null) {
            return content;
        }
        if (base64Content != null && !base64Content.isBlank()) {
            return Base64.getDecoder().decode(base64Content.trim());
        }
        return new byte[0];
    }

    public String getBase64Content() {
        if (base64Content != null) {
            return base64Content;
        }
        if (content != null) {
            return Base64.getEncoder().encodeToString(content);
        }
        return "";
    }

    public static EmailAttachment fromString(String name, String text, String contentType) {
        return EmailAttachment.builder()
                .name(name)
                .content(text != null ? text.getBytes(StandardCharsets.UTF_8) : new byte[0])
                .contentType(contentType)
                .build();
    }
}
