package com.selva.authportal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.ZipReportItemDTO;
import com.selva.authportal.dto.ZipReportsParseResponse;
import com.selva.authportal.dto.ZipReportsSendRequest;
import com.selva.authportal.dto.ZipReportsSendResponse;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.service.EmailBatchService;
import com.selva.authportal.service.ReportEmailService;
import com.selva.authportal.service.ZipReportEmailService;
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

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class EmailReportControllerTest {

    private MockMvc mockMvc;

    @Mock
    private EmailService emailService;

    @Mock
    private ReportEmailService reportEmailService;

    @Mock
    private EmailBatchService emailBatchService;

    @Mock
    private ZipReportEmailService zipReportEmailService;

    @Mock
    private UserDetails userDetails;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        EmailReportController controller = new EmailReportController(
                emailService,
                reportEmailService,
                emailBatchService,
                zipReportEmailService
        );

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
                return userDetails;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(authPrincipalResolver)
                .build();
    }

    @Test
    @DisplayName("POST /api/email/reports-zip/parse with multipart file succeeds")
    void testParseZipReportsMultipart() throws Exception {
        MockMultipartFile zipFile = new MockMultipartFile(
                "file",
                "test_reports.zip",
                "application/zip",
                new byte[]{0x50, 0x4B, 0x05, 0x06}
        );

        ZipReportsParseResponse mockResponse = ZipReportsParseResponse.builder()
                .success(true)
                .totalReports(1)
                .detectedWeek("Week 4")
                .reports(List.of(
                        ZipReportItemDTO.builder()
                                .studentId("N200001")
                                .email("N200001@rguktn.ac.in")
                                .studentName("Student 1")
                                .htmlFileName("N200001.html")
                                .build()
                ))
                .build();

        when(zipReportEmailService.parseZipReports(any(), any())).thenReturn(mockResponse);

        mockMvc.perform(multipart("/api/email/reports-zip/parse").file(zipFile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.totalReports").value(1))
                .andExpect(jsonPath("$.reports[0].studentId").value("N200001"));
    }

    @Test
    @DisplayName("POST /api/email/reports-zip/parse with JSON filePath succeeds")
    void testParseZipReportsJson() throws Exception {
        ZipReportsParseResponse mockResponse = ZipReportsParseResponse.builder()
                .success(true)
                .totalReports(2)
                .detectedWeek("Week 4")
                .reports(Collections.emptyList())
                .build();

        when(zipReportEmailService.parseZipReports(eq(null), eq("C:\\test\\sample.zip"))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/email/reports-zip/parse")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("filePath", "C:\\test\\sample.zip"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.totalReports").value(2));
    }

    @Test
    @DisplayName("POST /api/email/reports-zip/send with multipart parameters succeeds")
    void testSendZipReportsMultipart() throws Exception {
        MockMultipartFile zipFile = new MockMultipartFile(
                "file",
                "reports.zip",
                "application/zip",
                "dummy content".getBytes()
        );

        ZipReportsSendResponse mockResponse = ZipReportsSendResponse.builder()
                .success(true)
                .batchId(99L)
                .totalProcessed(1)
                .successfulCount(1)
                .failedCount(0)
                .build();

        when(userDetails.getUsername()).thenReturn("teacher@rguktn.ac.in");
        when(zipReportEmailService.sendZipReports(any(ZipReportsSendRequest.class), any(), any(), eq("teacher@rguktn.ac.in")))
                .thenReturn(mockResponse);

        mockMvc.perform(multipart("/api/email/reports-zip/send")
                        .file(zipFile)
                        .param("year", "E2")
                        .param("week", "Week 4")
                        .param("section", "1")
                        .param("targetOverrideEmail", "test@rguktn.ac.in")
                        .param("selectedStudentIds", "N200001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.batchId").value(99))
                .andExpect(jsonPath("$.successfulCount").value(1));
    }
}
