package com.selva.authportal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.EmailStatusResponse;
import com.selva.authportal.dto.SingleStudentReportResponse;
import com.selva.authportal.dto.StudentReportEmailRequest;
import com.selva.authportal.email.EmailSendRequest;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.model.StudentEvaluation;
import com.selva.authportal.repository.EmailBatchRecipientRepository;
import com.selva.authportal.repository.EmailBatchRepository;
import com.selva.authportal.repository.StudentEvaluationRepository;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportEmailServiceTest {

    @Mock
    private EmailService emailService;

    @Mock
    private EvaluationService evaluationService;

    @Mock
    private StudentEvaluationRepository evaluationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailBatchRepository batchRepository;

    @Mock
    private EmailBatchRecipientRepository recipientRepository;

    private ReportEmailService reportEmailService;
    private ObjectMapper objectMapper;
    private EmailReportHtmlTransformer htmlTransformer;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        htmlTransformer = new EmailReportHtmlTransformer();
        reportEmailService = new ReportEmailService(
                emailService,
                evaluationService,
                evaluationRepository,
                userRepository,
                batchRepository,
                recipientRepository,
                objectMapper,
                htmlTransformer
        );
    }

    @Test
    @DisplayName("getStatus reflects configured status from Gmail EmailService")
    void testGetStatus() {
        when(emailService.isConfigured()).thenReturn(true);
        when(emailService.getSenderEmail()).thenReturn("faculty@rguktn.ac.in");
        when(emailService.getSenderName()).thenReturn("RGUKT Academic Portal");
        when(emailService.getHost()).thenReturn("smtp.gmail.com");
        when(emailService.getPort()).thenReturn(587);

        EmailStatusResponse status = reportEmailService.getStatus();

        assertThat(status.isConfigured()).isTrue();
        assertThat(status.getProvider()).isEqualTo("GMAIL_SMTP");
        assertThat(status.getHost()).isEqualTo("smtp.gmail.com");
        assertThat(status.getPort()).isEqualTo(587);
        assertThat(status.getSender()).isEqualTo("faculty@rguktn.ac.in");
        assertThat(status.getMessage()).contains("connected and ready");
    }

    @Test
    @DisplayName("sendStudentReportEmail builds attachments and sends via Gmail SMTP")
    void testSendStudentReportEmail() {
        SingleStudentReportResponse mockReport = SingleStudentReportResponse.builder()
                .studentId("N210001")
                .week("Week 1")
                .finalScore("28")
                .grade("A")
                .status("Approved")
                .provider("gemini")
                .modelName("gemini-1.5-pro")
                .assessment("Excellent work")
                .reviewed(true)
                .feedbackText("Well done")
                .build();

        when(evaluationService.getStudentReport("N210001", "Week 1", "gemini"))
                .thenReturn(mockReport);

        StudentEvaluation geminiEval = StudentEvaluation.builder()
                .studentId("N210001")
                .week("Week 1")
                .provider("gemini")
                .rawJson("{\"score\": 28}")
                .build();

        when(evaluationRepository.findAllByStudentIdAndWeek("N210001", "Week 1"))
                .thenReturn(List.of(geminiEval));

        when(recipientRepository.hasSentReportToStudentForWeek("N210001", "Week 1")).thenReturn(false);

        when(emailService.sendEmail(any(EmailSendRequest.class)))
                .thenReturn(EmailSendResult.builder()
                        .success(true)
                        .messageId("<gmail-test-123@smtp.gmail.com>")
                        .recipientEmail("n210001@rguktn.ac.in")
                        .subject("[RGUKT Lab Portal] Week 1 Evaluation Report - N210001")
                        .attachedFiles(List.of("Evaluation_Report_N210001_Week_1.html", "Gemini_Report_N210001_Week_1.json"))
                        .build());

        StudentReportEmailRequest request = StudentReportEmailRequest.builder()
                .studentId("N210001")
                .week("Week 1")
                .provider("gemini")
                .reportFormat("all")
                .customMessage("Great job on your submission!")
                .build();

        EmailSendResult result = reportEmailService.sendStudentReportEmail(request);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getMessageId()).isEqualTo("<gmail-test-123@smtp.gmail.com>");

        ArgumentCaptor<EmailSendRequest> captor = ArgumentCaptor.forClass(EmailSendRequest.class);
        verify(emailService).sendEmail(captor.capture());

        EmailSendRequest captured = captor.getValue();
        assertThat(captured.getTo()).isEqualTo("n210001@rguktn.ac.in");
        assertThat(captured.getSubject()).contains("Week 1 Evaluation Report - N210001");
        assertThat(captured.isHtml()).isTrue();
        assertThat(captured.getBody()).contains("RGUKT Academic Portal");
        assertThat(captured.getBody()).contains("Great job on your submission!");
        assertThat(captured.getAttachments()).hasSize(2);
    }

    @Test
    @DisplayName("sendStudentReportEmail rejects duplicate without forceResend")
    void testDuplicateProtection() {
        when(recipientRepository.hasSentReportToStudentForWeek("N210001", "Week 1")).thenReturn(true);

        StudentReportEmailRequest request = StudentReportEmailRequest.builder()
                .studentId("N210001")
                .week("Week 1")
                .forceResend(false)
                .build();

        assertThatThrownBy(() -> reportEmailService.sendStudentReportEmail(request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Report already sent to student N210001");
    }

    @Test
    @DisplayName("sendCustomReportEmail sends uploaded file via Gmail SMTP")
    void testSendCustomReportEmail() throws IOException {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "custom_notes.html",
                "text/html",
                "<html><body><h1>Custom Notes</h1></body></html>".getBytes(StandardCharsets.UTF_8)
        );

        when(emailService.sendEmail(any(EmailSendRequest.class)))
                .thenReturn(EmailSendResult.builder()
                        .success(true)
                        .messageId("<custom-123@smtp.gmail.com>")
                        .recipientEmail("student@rguktn.ac.in")
                        .build());

        EmailSendResult result = reportEmailService.sendCustomReportEmail(
                file,
                "student@rguktn.ac.in",
                "Extra Resources",
                "Please read before next lab."
        );

        assertThat(result.isSuccess()).isTrue();
        ArgumentCaptor<EmailSendRequest> captor = ArgumentCaptor.forClass(EmailSendRequest.class);
        verify(emailService).sendEmail(captor.capture());
        assertThat(captor.getValue().getTo()).isEqualTo("student@rguktn.ac.in");
        assertThat(captor.getValue().getSubject()).isEqualTo("Extra Resources");
    }
}
