package com.selva.authportal.service;

import com.selva.authportal.model.FileType;
import com.selva.authportal.model.Submission;
import com.selva.authportal.model.SubmissionFile;
import com.selva.authportal.model.YearLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class ZipArchiveServiceTest {

    @TempDir
    Path tempDir;

    private StorageService storageService;
    private ZipArchiveService zipArchiveService;

    @BeforeEach
    void setUp() {
        storageService = new StorageService(tempDir.toString());
        storageService.init();
        zipArchiveService = new ZipArchiveService(storageService);
    }

    @Test
    @DisplayName("Should generate valid ZIP with notice when submissions list is empty")
    void shouldGenerateNoticeZipWhenEmpty() throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        zipArchiveService.generateSubmissionsZip(List.of(), 1, 2, baos);

        byte[] zipBytes = baos.toByteArray();
        assertThat(zipBytes).isNotEmpty();

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry = zis.getNextEntry();
            assertThat(entry).isNotNull();
            assertThat(entry.getName()).isEqualTo("README.txt");
        }
    }

    @Test
    @DisplayName("Should preserve week-w-sec-s/{studentId}/ hierarchy in ZIP archive")
    void shouldPreserveStudentFolderHierarchyInZip() throws IOException {
        // Setup mock file on disk
        Path studentDir = storageService.resolveSubmissionDirectory(1, 2, "N210001");
        MockMultipartFile cFile = new MockMultipartFile("file", "main.c", "text/x-c", "int main() {}".getBytes());
        MockMultipartFile pdfFile = new MockMultipartFile("file", "report.pdf", "application/pdf", "%PDF-1.4".getBytes());
        storageService.storeFile(cFile, studentDir, "main.c");
        storageService.storeFile(pdfFile, studentDir, "report.pdf");

        Submission submission = Submission.builder()
                .id(1L)
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E1)
                .section(2)
                .files(List.of(
                        SubmissionFile.builder().originalFilename("main.c").storedFilename("main.c").createdAt(Instant.now()).fileType(FileType.SOURCE_CODE).fileExtension(".c").fileSizeBytes(13L).build(),
                        SubmissionFile.builder().originalFilename("report.pdf").storedFilename("report.pdf").createdAt(Instant.now()).fileType(FileType.PDF_REPORT).fileExtension(".pdf").fileSizeBytes(8L).build()
                ))
                .build();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        zipArchiveService.generateSubmissionsZip(List.of(submission), 1, 2, baos);

        List<String> entryNames = new ArrayList<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(baos.toByteArray()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entryNames.add(entry.getName());
            }
        }

        assertThat(entryNames).containsExactlyInAnyOrder(
                "week-1-sec-2/N210001/main.c",
                "week-1-sec-2/N210001/report.pdf"
        );
    }

    @Test
    @DisplayName("Should preserve week-w/sec-s/{studentId}/ hierarchy in whole-week ZIP archive when section is null")
    void shouldPreserveWholeWeekHierarchyInZip() throws IOException {
        // Setup mock files for two students across two sections
        Path s1Dir = storageService.resolveSubmissionDirectory(1, 1, "N210001");
        Path s2Dir = storageService.resolveSubmissionDirectory(1, 2, "N210002");

        MockMultipartFile file1 = new MockMultipartFile("file", "lab1.c", "text/x-c", "int main() {}".getBytes());
        MockMultipartFile file2 = new MockMultipartFile("file", "lab2.c", "text/x-c", "int main() { return 0; }".getBytes());

        storageService.storeFile(file1, s1Dir, "lab1.c");
        storageService.storeFile(file2, s2Dir, "lab2.c");

        Submission sub1 = Submission.builder()
                .id(1L).studentId("N210001").week(1).year(YearLevel.E1).section(1)
                .files(List.of(SubmissionFile.builder().originalFilename("lab1.c").storedFilename("lab1.c").createdAt(Instant.now()).fileType(FileType.SOURCE_CODE).fileExtension(".c").fileSizeBytes(13L).build()))
                .build();

        Submission sub2 = Submission.builder()
                .id(2L).studentId("N210002").week(1).year(YearLevel.E1).section(2)
                .files(List.of(SubmissionFile.builder().originalFilename("lab2.c").storedFilename("lab2.c").createdAt(Instant.now()).fileType(FileType.SOURCE_CODE).fileExtension(".c").fileSizeBytes(24L).build()))
                .build();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        zipArchiveService.generateSubmissionsZip(List.of(sub1, sub2), 1, null, baos);

        List<String> entryNames = new ArrayList<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(baos.toByteArray()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                entryNames.add(entry.getName());
            }
        }

        assertThat(entryNames).containsExactlyInAnyOrder(
                "week-1/sec-1/N210001/lab1.c",
                "week-1/sec-2/N210002/lab2.c"
        );
    }

    @Test
    @DisplayName("Should generate valid ZIP with notice when submissions exist but files are missing on disk")
    void shouldGenerateNoticeZipWhenFilesMissingOnDisk() throws IOException {
        Submission sub = Submission.builder()
                .id(10L)
                .studentId("N210750")
                .week(1)
                .year(YearLevel.E1)
                .section(1)
                .files(List.of(
                        SubmissionFile.builder().originalFilename("report.pdf").storedFilename("missing_report.pdf").createdAt(Instant.now()).fileType(FileType.PDF_REPORT).build()
                ))
                .build();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        zipArchiveService.generateSubmissionsZip(List.of(sub), 1, 1, baos);

        byte[] zipBytes = baos.toByteArray();
        assertThat(zipBytes).isNotEmpty();

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry = zis.getNextEntry();
            assertThat(entry).isNotNull();
            assertThat(entry.getName()).isEqualTo("README.txt");
            String content = new String(zis.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            assertThat(content).contains("No physical submission files were found");
            assertThat(content).contains("N210750");
        }
    }

    @Test
    @DisplayName("Should format archive filenames correctly")
    void shouldFormatArchiveFilenames() {
        assertThat(zipArchiveService.getArchiveFilename(1, 2)).isEqualTo("week-1-sec-2.zip");
        assertThat(zipArchiveService.getArchiveFilename(3, null)).isEqualTo("week-3.zip");
    }
}

