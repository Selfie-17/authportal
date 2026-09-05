package com.selva.authportal.service;

import com.selva.authportal.dto.SubmissionRequest;
import com.selva.authportal.dto.SubmissionResponse;
import com.selva.authportal.exception.FileValidationException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.model.*;
import com.selva.authportal.repository.SubmissionFileRepository;
import com.selva.authportal.repository.SubmissionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubmissionServiceTest {

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private SubmissionFileRepository submissionFileRepository;

    private StorageService storageService;
    private SubmissionService submissionService;

    @TempDir
    Path tempDir;

    private User studentUser;
    private User teacherUser;

    @BeforeEach
    void setUp() {
        storageService = new StorageService(tempDir.toString());
        storageService.init();

        submissionService = new SubmissionService(submissionRepository, submissionFileRepository, storageService);
        ReflectionTestUtils.setField(submissionService, "studentPatternRegex", "^[Nn](\\d{6})@rguktn\\.ac\\.in$");

        studentUser = User.builder()
                .id(1L)
                .name("Student User")
                .email("n210001@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        teacherUser = User.builder()
                .id(2L)
                .name("Teacher User")
                .email("faculty@rguktn.ac.in")
                .role(Role.TEACHER)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("Should derive student ID correctly from institutional email")
    void shouldDeriveStudentIdFromEmail() {
        assertThat(submissionService.deriveDefaultStudentId("n210001@rguktn.ac.in")).isEqualTo("N210001");
        assertThat(submissionService.deriveDefaultStudentId("N220999@rguktn.ac.in")).isEqualTo("N220999");
        assertThat(submissionService.deriveDefaultStudentId("faculty@rguktn.ac.in")).isEqualTo("");
        assertThat(submissionService.deriveDefaultStudentId("")).isEqualTo("");
    }

    @Test
    @DisplayName("Should validate and normalize student ID")
    void shouldValidateAndNormalizeStudentId() {
        assertThat(submissionService.validateAndNormalizeStudentId("n210001")).isEqualTo("N210001");
        assertThat(submissionService.validateAndNormalizeStudentId("N210001")).isEqualTo("N210001");

        assertThatThrownBy(() -> submissionService.validateAndNormalizeStudentId("invalid"))
                .isInstanceOf(InvalidSubmissionException.class);
        assertThatThrownBy(() -> submissionService.validateAndNormalizeStudentId("N123"))
                .isInstanceOf(InvalidSubmissionException.class);
    }

    @Test
    @DisplayName("Should reject non-student role from submitting")
    void shouldRejectNonStudentSubmission() {
        SubmissionRequest request = SubmissionRequest.builder()
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E1)
                .section(1)
                .build();

        MockMultipartFile cFile = new MockMultipartFile("files", "main.c", "text/x-c", "#include <stdio.h>".getBytes());

        assertThatThrownBy(() -> submissionService.submitAssignment(teacherUser, request, List.of(cFile)))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only students");
    }

    @Test
    @DisplayName("Should reject disallowed file extensions")
    void shouldRejectDisallowedExtensions() {
        MockMultipartFile exeFile = new MockMultipartFile("files", "malware.exe", "application/octet-stream", "dummy".getBytes());
        MockMultipartFile txtFile = new MockMultipartFile("files", "readme.txt", "text/plain", "hello".getBytes());

        assertThatThrownBy(() -> submissionService.validateFiles(List.of(exeFile)))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Only .c and .pdf files are accepted");

        assertThatThrownBy(() -> submissionService.validateFiles(List.of(txtFile)))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Only .c and .pdf files are accepted");
    }

    @Test
    @DisplayName("Should reject Windows executable binary disguised as .c file")
    void shouldRejectDisguisedWindowsExecutable() {
        byte[] mzHeader = new byte[]{'M', 'Z', 0, 0, 0, 0, 0, 0};
        MockMultipartFile fakeCFile = new MockMultipartFile("files", "exploit.c", "text/x-c", mzHeader);

        assertThatThrownBy(() -> submissionService.validateFiles(List.of(fakeCFile)))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Executable Windows binary");
    }

    @Test
    @DisplayName("Should reject Linux ELF binary disguised as .c file")
    void shouldRejectDisguisedLinuxExecutable() {
        byte[] elfHeader = new byte[]{0x7F, 'E', 'L', 'F', 0, 0, 0, 0};
        MockMultipartFile fakeCFile = new MockMultipartFile("files", "exploit.c", "text/x-c", elfHeader);

        assertThatThrownBy(() -> submissionService.validateFiles(List.of(fakeCFile)))
                .isInstanceOf(FileValidationException.class)
                .hasMessageContaining("Executable Linux binary");
    }

    @Test
    @DisplayName("Should create initial submission with version 1")
    void shouldCreateInitialSubmission() {
        SubmissionRequest request = SubmissionRequest.builder()
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E2)
                .section(2)
                .build();

        MockMultipartFile cFile = new MockMultipartFile("files", "main.c", "text/x-c", "int main() {}".getBytes());
        MockMultipartFile pdfFile = new MockMultipartFile("files", "report.pdf", "application/pdf", "%PDF-1.4 dummy".getBytes());

        when(submissionRepository.findByUserIdAndWeekAndYearAndSection(1L, 1, YearLevel.E2, 2))
                .thenReturn(Optional.empty());
        when(submissionRepository.save(any(Submission.class))).thenAnswer(inv -> {
            Submission s = inv.getArgument(0);
            s.setId(10L);
            return s;
        });

        SubmissionResponse response = submissionService.submitAssignment(studentUser, request, List.of(cFile, pdfFile));

        assertThat(response).isNotNull();
        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
        assertThat(response.getStudentId()).isEqualTo("N210001");
        assertThat(response.getFiles()).hasSize(2);
    }

    @Test
    @DisplayName("Should increment revision counter and replace files on duplicate submission")
    void shouldIncrementRevisionOnDuplicateSubmission() {
        SubmissionRequest request = SubmissionRequest.builder()
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E1)
                .section(1)
                .build();

        Submission existingSubmission = Submission.builder()
                .id(5L)
                .user(studentUser)
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E1)
                .section(1)
                .storagePath("submissions/week-1/sec-1/N210001")
                .version(1)
                .status(SubmissionStatus.SUBMITTED)
                .files(new ArrayList<>())
                .build();

        when(submissionRepository.findByUserIdAndWeekAndYearAndSection(1L, 1, YearLevel.E1, 1))
                .thenReturn(Optional.of(existingSubmission));
        when(submissionRepository.save(any(Submission.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile updatedCFile = new MockMultipartFile("files", "solution.c", "text/x-c", "int main() { return 1; }".getBytes());

        SubmissionResponse response = submissionService.submitAssignment(studentUser, request, List.of(updatedCFile));

        assertThat(response.getVersion()).isEqualTo(2); // Revision incremented
        assertThat(response.getStatus()).isEqualTo(SubmissionStatus.UPDATED);
        assertThat(response.getFiles()).hasSize(1);
        assertThat(response.getFiles().get(0).getOriginalFilename()).isEqualTo("solution.c");
    }

    @Test
    @DisplayName("Should prevent student from downloading another student's submission files")
    void shouldPreventStudentFromDownloadingOthersFiles() {
        User otherStudent = User.builder().id(99L).role(Role.STUDENT).build();
        Submission submission = Submission.builder()
                .id(10L)
                .user(studentUser) // owned by studentUser (id=1)
                .build();

        when(submissionRepository.findById(10L)).thenReturn(Optional.of(submission));

        assertThatThrownBy(() -> submissionService.loadFileForDownload(otherStudent, 10L, 1L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("You do not have permission");
    }
}
