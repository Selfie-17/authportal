package com.selva.authportal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.*;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.service.EvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class TeacherEvaluationControllerTest {

    private MockMvc mockMvc;

    @Mock
    private EvaluationService evaluationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        TeacherEvaluationController controller = new TeacherEvaluationController(evaluationService);

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter,
                                          ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest,
                                          WebDataBinderFactory binderFactory) {
                return org.springframework.security.core.userdetails.User
                        .withUsername("teacher@rguktn.ac.in")
                        .password("password")
                        .roles("TEACHER")
                        .build();
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(authPrincipalResolver)
                .build();
    }

    @Test
    @DisplayName("POST /api/teacher/evaluations/upload processes file upload")
    void testUploadFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "eval.json", "application/json", "{}".getBytes()
        );

        when(evaluationService.processJsonUpload(any())).thenReturn(
                EvaluationUploadResponse.builder()
                        .success(true)
                        .processedCount(5)
                        .weeks(List.of("Week 1"))
                        .build()
        );

        mockMvc.perform(multipart("/api/teacher/evaluations/upload").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.processedCount").value(5))
                .andExpect(jsonPath("$.weeks[0]").value("Week 1"));
    }

    @Test
    @DisplayName("GET /api/teacher/evaluations/grid returns table structure")
    void testGetGrid() throws Exception {
        TeacherEvaluationGridResponse grid = TeacherEvaluationGridResponse.builder()
                .weeks(List.of("Week 1", "Week 2"))
                .rows(List.of(
                        TeacherEvaluationRowDTO.builder()
                                .rNo(1)
                                .studentId("N210921")
                                .evaluations(Map.of(
                                        "Week 1", EvaluationCellDTO.builder()
                                                .studentId("N210921")
                                                .week("Week 1")
                                                .finalScore("8/10")
                                                .reviewed(true)
                                                .build()
                                ))
                                .build()
                ))
                .totalStudents(1)
                .build();

        when(evaluationService.getEvaluationGrid()).thenReturn(grid);

        mockMvc.perform(get("/api/teacher/evaluations/grid"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weeks[0]").value("Week 1"))
                .andExpect(jsonPath("$.weeks[1]").value("Week 2"))
                .andExpect(jsonPath("$.rows[0].studentId").value("N210921"))
                .andExpect(jsonPath("$.rows[0].evaluations['Week 1'].finalScore").value("8/10"))
                .andExpect(jsonPath("$.rows[0].evaluations['Week 1'].reviewed").value(true));
    }

    @Test
    @DisplayName("GET /api/teacher/evaluations/report returns single-student report")
    void testGetReport() throws Exception {
        SingleStudentReportResponse report = SingleStudentReportResponse.builder()
                .studentId("N210921")
                .week("Week 1")
                .finalScore("8/10")
                .assessment("Good job")
                .objectiveScore("2/2")
                .reviewed(true)
                .feedbackText("Well done")
                .build();

        when(evaluationService.getStudentReport(eq("N210921"), eq("Week 1"))).thenReturn(report);

        mockMvc.perform(get("/api/teacher/evaluations/report")
                        .param("studentId", "N210921")
                        .param("week", "Week 1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentId").value("N210921"))
                .andExpect(jsonPath("$.week").value("Week 1"))
                .andExpect(jsonPath("$.finalScore").value("8/10"))
                .andExpect(jsonPath("$.feedbackText").value("Well done"));
    }

    @Test
    @DisplayName("POST /api/teacher/evaluations/feedback saves teacher feedback")
    void testSaveFeedback() throws Exception {
        TeacherFeedbackRequest request = TeacherFeedbackRequest.builder()
                .studentId("N210921")
                .week("Week 1")
                .reviewed(true)
                .feedbackText("Excellent clarity.")
                .build();

        when(evaluationService.saveFeedback(any(TeacherFeedbackRequest.class), eq("teacher@rguktn.ac.in")))
                .thenReturn(TeacherFeedbackResponse.builder()
                        .studentId("N210921")
                        .week("Week 1")
                        .reviewed(true)
                        .feedbackText("Excellent clarity.")
                        .build()
                );

        mockMvc.perform(post("/api/teacher/evaluations/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentId").value("N210921"))
                .andExpect(jsonPath("$.week").value("Week 1"))
                .andExpect(jsonPath("$.reviewed").value(true))
                .andExpect(jsonPath("$.feedbackText").value("Excellent clarity."));
    }

    @Test
    @DisplayName("GET /api/teacher/evaluations/pdf streams student PDF inline")
    void testGetStudentPdf() throws Exception {
        org.springframework.core.io.Resource dummyResource = new org.springframework.core.io.ByteArrayResource("%PDF-1.4 test".getBytes());
        com.selva.authportal.service.SubmissionService.DownloadableFile downloadable =
                new com.selva.authportal.service.SubmissionService.DownloadableFile(dummyResource, "observation_report.pdf", "application/pdf");

        when(evaluationService.loadStudentPdf(eq("N241003"), eq("Week 4"))).thenReturn(downloadable);

        mockMvc.perform(get("/api/teacher/evaluations/pdf")
                        .param("studentId", "N241003")
                        .param("week", "Week 4"))
                .andExpect(status().isOk())
                .andExpect(header().string(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"observation_report.pdf\""))
                .andExpect(header().string(org.springframework.http.HttpHeaders.CONTENT_TYPE, "application/pdf"))
                .andExpect(content().bytes("%PDF-1.4 test".getBytes()));
    }
}
