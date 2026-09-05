package com.selva.authportal.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StorageServiceTest {

    @TempDir
    Path tempDir;

    private StorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new StorageService(tempDir.toString());
        storageService.init();
    }

    @Test
    @DisplayName("Should resolve valid submission directory following week/sec/studentId structure")
    void shouldResolveValidSubmissionDirectory() {
        Path dir = storageService.resolveSubmissionDirectory(1, 2, "N210001");

        assertThat(dir).isNotNull();
        assertThat(dir.toString()).contains("week-1");
        assertThat(dir.toString()).contains("sec-2");
        assertThat(dir.toString()).endsWith("N210001");
        assertThat(storageService.getRelativeStoragePath(1, 2, "N210001"))
                .isEqualTo("submissions/week-1/sec-2/N210001");
    }

    @Test
    @DisplayName("Should normalize lowercase student ID to uppercase in resolved path")
    void shouldNormalizeStudentIdToUppercase() {
        Path dir = storageService.resolveSubmissionDirectory(12, 6, "n210921");
        assertThat(dir.toString()).endsWith("N210921");
    }

    @Test
    @DisplayName("Should reject invalid week numbers (<1 or >12)")
    void shouldRejectInvalidWeek() {
        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(0, 1, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid week");

        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(13, 1, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid week");
    }

    @Test
    @DisplayName("Should reject invalid section numbers (<1 or >6)")
    void shouldRejectInvalidSection() {
        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(1, 0, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid section");

        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(1, 7, "N210001"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid section");
    }

    @Test
    @DisplayName("Should reject student ID with path traversal characters")
    void shouldRejectPathTraversalInStudentId() {
        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(1, 1, "../hack"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(1, 1, "..\\hack"))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> storageService.resolveSubmissionDirectory(1, 1, "id/sub"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should sanitize clean filename correctly")
    void shouldSanitizeCleanFilename() {
        assertThat(storageService.sanitizeFilename("main.c")).isEqualTo("main.c");
        assertThat(storageService.sanitizeFilename("report.pdf")).isEqualTo("report.pdf");
        assertThat(storageService.sanitizeFilename("nested/path/program.c")).isEqualTo("program.c");
        assertThat(storageService.sanitizeFilename("C:\\windows\\path\\program.c")).isEqualTo("program.c");
    }

    @Test
    @DisplayName("Should reject dangerous characters or traversal in filename")
    void shouldRejectDangerousFilename() {
        assertThatThrownBy(() -> storageService.sanitizeFilename("../escape.c"))
                .isInstanceOf(SecurityException.class);

        assertThatThrownBy(() -> storageService.sanitizeFilename("null\0byte.c"))
                .isInstanceOf(SecurityException.class);

        assertThatThrownBy(() -> storageService.sanitizeFilename(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Should store file and clean up directory contents on replace")
    void shouldStoreFileAndCleanUpOnReplace() throws IOException {
        Path targetDir = storageService.resolveSubmissionDirectory(2, 3, "N210045");
        MockMultipartFile file1 = new MockMultipartFile("file", "test.c", "text/x-c", "int main() { return 0; }".getBytes());

        Path storedPath = storageService.storeFile(file1, targetDir, "test.c");
        assertThat(Files.exists(storedPath)).isTrue();
        assertThat(Files.readString(storedPath)).isEqualTo("int main() { return 0; }");

        // Clean up contents (simulating replace/update)
        storageService.deleteDirectoryContents(targetDir);
        assertThat(Files.exists(storedPath)).isFalse();
        assertThat(Files.exists(targetDir)).isTrue(); // Directory itself is kept
    }
}
