package com.selva.authportal.service;

import com.selva.authportal.service.storage.LocalStorageService;
import com.selva.authportal.util.SubmissionPathUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StorageServiceTest {

    @TempDir
    Path tempDir;

    private LocalStorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new LocalStorageService(tempDir.toString());
        storageService.init();
    }

    @Test
    @DisplayName("Should resolve valid relative storage path following week/sec/studentId structure")
    void shouldResolveValidSubmissionPath() {
        String path = SubmissionPathUtils.resolveRelativeStoragePath(1, 2, "N210001");

        assertThat(path).isEqualTo("submissions/week-1/sec-2/N210001");
    }

    @Test
    @DisplayName("Should normalize lowercase student ID to uppercase in relative path")
    void shouldNormalizeStudentIdToUppercase() {
        String path = SubmissionPathUtils.resolveRelativeStoragePath(12, 6, "n210921");
        assertThat(path).endsWith("N210921");
    }

    @Test
    @DisplayName("Should reject invalid week numbers (<1 or >12)")
    void shouldRejectInvalidWeek() {
        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(0, 1, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid week");

        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(13, 1, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid week");
    }

    @Test
    @DisplayName("Should reject invalid section numbers (<1 or >6)")
    void shouldRejectInvalidSection() {
        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(1, 0, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid section");

        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(1, 7, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid section");
    }

    @Test
    @DisplayName("Should reject student ID with path traversal characters")
    void shouldRejectPathTraversalInStudentId() {
        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(1, 1, "../hack"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(1, 1, "..\\hack"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> SubmissionPathUtils.resolveRelativeStoragePath(1, 1, "id/sub"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should sanitize clean filename correctly")
    void shouldSanitizeCleanFilename() {
        assertThat(SubmissionPathUtils.sanitizeFilename("main.c")).isEqualTo("main.c");
        assertThat(SubmissionPathUtils.sanitizeFilename("report.pdf")).isEqualTo("report.pdf");
        assertThat(SubmissionPathUtils.sanitizeFilename("nested/path/program.c")).isEqualTo("program.c");
        assertThat(SubmissionPathUtils.sanitizeFilename("C:\\windows\\path\\program.c")).isEqualTo("program.c");
    }

    @Test
    @DisplayName("Should reject dangerous characters or traversal in filename")
    void shouldRejectDangerousFilename() {
        assertThatThrownBy(() -> SubmissionPathUtils.sanitizeFilename("../escape.c"))
                .isInstanceOf(SecurityException.class);

        assertThatThrownBy(() -> SubmissionPathUtils.sanitizeFilename("null\0byte.c"))
                .isInstanceOf(SecurityException.class);

        assertThatThrownBy(() -> SubmissionPathUtils.sanitizeFilename(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should build canonical storage key correctly")
    void shouldBuildStorageKey() {
        String key = SubmissionPathUtils.buildStorageKey("submissions/week-1/sec-2/N210001", "main.c");
        assertThat(key).isEqualTo("submissions/week-1/sec-2/N210001/main.c");
    }

    @Test
    @DisplayName("Should store file, check existence, open stream, and clean up directory prefix on replace")
    void shouldStoreFileAndCleanUpOnReplace() throws IOException {
        String relPath = SubmissionPathUtils.resolveRelativeStoragePath(2, 3, "N210045");
        String storageKey = SubmissionPathUtils.buildStorageKey(relPath, "test.c");

        byte[] content = "int main() { return 0; }".getBytes(StandardCharsets.UTF_8);
        storageService.storeFile(new ByteArrayInputStream(content), storageKey, "text/x-c", content.length);

        assertThat(storageService.fileExists(storageKey)).isTrue();

        try (InputStream is = storageService.openStream(storageKey)) {
            String readContent = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(readContent).isEqualTo("int main() { return 0; }");
        }

        // Clean up prefix (simulating replace/update)
        storageService.deletePrefix(relPath);
        assertThat(storageService.fileExists(storageKey)).isFalse();
    }

    @Test
    @DisplayName("Should throw FileNotFoundException when opening non-existent file stream")
    void shouldThrowWhenFileNotFound() {
        assertThatThrownBy(() -> storageService.openStream("submissions/week-1/sec-1/N210001/missing.c"))
                .isInstanceOf(FileNotFoundException.class);
    }

    @Test
    @DisplayName("Should reject path traversal attempts in LocalStorageService")
    void shouldRejectPathTraversalInStorageService() {
        assertThatThrownBy(() -> storageService.openStream("../secret.txt"))
                .isInstanceOf(SecurityException.class);

        assertThatThrownBy(() -> storageService.deletePrefix("../../etc"))
                .isInstanceOf(SecurityException.class);
    }
}
