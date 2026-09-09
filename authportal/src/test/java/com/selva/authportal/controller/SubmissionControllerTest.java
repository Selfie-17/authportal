package com.selva.authportal.controller;

import com.selva.authportal.dto.SubmissionFileDTO;
import com.selva.authportal.dto.SubmissionResponse;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.FileType;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.SubmissionStatus;
import com.selva.authportal.model.User;
import com.selva.authportal.model.YearLevel;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.SubmissionService;
import com.selva.authportal.service.ZipArchiveService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class SubmissionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private SubmissionService submissionService;

    @Mock
    private ZipArchiveService zipArchiveService;

    @Mock
    private UserRepository userRepository;

    private User studentUser;
    private CustomUserDetails customUserDetails;

    @BeforeEach
    void setUp() {
        studentUser = User.builder()
                .id(1L)
                .name("Student Selva")
                .email("n210921@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        customUserDetails = new CustomUserDetails(studentUser);

        SubmissionController controller = new SubmissionController(submissionService, zipArchiveService, userRepository);

        // Custom argument resolver to inject authenticated principal in standalone setup
        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return customUserDetails;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("Should return derived default student ID for authenticated user")
    void shouldReturnDefaultStudentId() throws Exception {
        when(submissionService.deriveDefaultStudentId("n210921@rguktn.ac.in")).thenReturn("N210921");

        mockMvc.perform(get("/api/submissions/default-student-id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentId").value("N210921"));
    }

    @Test
    @DisplayName("Should upload assignment submission and return 201 Created for version 1")
    void shouldUploadSubmission() throws Exception {
        MockMultipartFile cFile = new MockMultipartFile(
                "files", "lab1.c", "text/x-c", "#include <stdio.h>".getBytes()
        );

        SubmissionResponse mockResponse = SubmissionResponse.builder()
                .id(10L)
                .userId(1L)
                .userName("Student Selva")
                .userEmail("n210921@rguktn.ac.in")
                .studentId("N210921")
                .week(1)
                .year(YearLevel.E2)
                .section(3)
                .status(SubmissionStatus.SUBMITTED)
                .version(1)
                .createdAt(Instant.now())
                .files(List.of(
                        SubmissionFileDTO.builder()
                                .id(101L)
                                .originalFilename("lab1.c")
                                .fileExtension(".c")
                                .fileType(FileType.SOURCE_CODE)
                                .fileSizeBytes((long) cFile.getSize())
                                .build()
                ))
                .build();

        when(submissionService.submitAssignment(any(), any(), any())).thenReturn(mockResponse);

        mockMvc.perform(multipart("/api/submissions")
                        .file(cFile)
                        .param("studentId", "N210921")
                        .param("week", "1")
                        .param("year", "E2")
                        .param("section", "3"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.studentId").value("N210921"))
                .andExpect(jsonPath("$.week").value(1))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.files[0].originalFilename").value("lab1.c"));
    }

    @Test
    @DisplayName("Should return list of student's own submissions")
    void shouldReturnMySubmissions() throws Exception {
        SubmissionResponse sub = SubmissionResponse.builder()
                .id(10L)
                .userId(1L)
                .studentId("N210921")
                .week(1)
                .year(YearLevel.E1)
                .section(1)
                .version(1)
                .status(SubmissionStatus.SUBMITTED)
                .build();

        when(submissionService.getMySubmissions(1L)).thenReturn(List.of(sub));

        mockMvc.perform(get("/api/submissions/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].studentId").value("N210921"));
    }

    @Test
    @DisplayName("Should download individual file from submission")
    void shouldDownloadFile() throws Exception {
        ByteArrayResource resource = new ByteArrayResource("int main() {}".getBytes());
        SubmissionService.DownloadableFile downloadable = new SubmissionService.DownloadableFile(
                resource, "program.c", "text/plain; charset=UTF-8"
        );

        when(submissionService.loadFileForDownload(any(), eq(10L), eq(101L))).thenReturn(downloadable);

        mockMvc.perform(get("/api/submissions/10/files/101"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"program.c\""))
                .andExpect(content().string("int main() {}"));
    }

    @Test
    @DisplayName("Should return filtered submissions for teacher")
    void shouldReturnFilteredSubmissionsForTeacher() throws Exception {
        SubmissionResponse response = SubmissionResponse.builder()
                .id(101L)
                .studentId("N210001")
                .week(1)
                .year(YearLevel.E1)
                .section(2)
                .build();

        when(submissionService.filterSubmissionsForTeacher(1, YearLevel.E1, 2, "N210001"))
                .thenReturn(List.of(response));

        mockMvc.perform(get("/api/submissions/teacher")
                        .param("week", "1")
                        .param("year", "E1")
                        .param("section", "2")
                        .param("studentId", "N210001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentId").value("N210001"))
                .andExpect(jsonPath("$[0].week").value(1));
    }

    @Test
    @DisplayName("Should stream ZIP archive for teacher batch download")
    void shouldStreamZipArchive() throws Exception {
        when(submissionService.getSubmissionsForZip(1, YearLevel.E1, 2)).thenReturn(List.of());
        when(zipArchiveService.getArchiveFilename(1, 2)).thenReturn("week-1-sec-2.zip");

        mockMvc.perform(get("/api/submissions/teacher/download-zip")
                        .param("week", "1")
                        .param("year", "E1")
                        .param("section", "2"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"week-1-sec-2.zip\""))
                .andExpect(header().string("Content-Type", "application/zip"))
                .andExpect(header().exists("Content-Length"));
    }

    @Test
    @DisplayName("Should delete submission and return success response")
    void shouldDeleteSubmission() throws Exception {
        doNothing().when(submissionService).deleteSubmission(any(), eq(10L));

        mockMvc.perform(delete("/api/submissions/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Submission deleted successfully."));
    }
}


