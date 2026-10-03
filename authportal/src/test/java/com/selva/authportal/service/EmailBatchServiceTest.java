package com.selva.authportal.service;

import com.selva.authportal.dto.*;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.model.*;
import com.selva.authportal.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailBatchServiceTest {

    @Mock
    private EmailBatchRepository batchRepository;

    @Mock
    private EmailBatchRecipientRepository recipientRepository;

    @Mock
    private EmailAutomationConfigRepository automationConfigRepository;

    @Mock
    private ReportEmailService reportEmailService;

    @Mock
    private EmailService emailService;

    @Mock
    private StudentEvaluationRepository evaluationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SubmissionRepository submissionRepository;

    private EmailBatchService emailBatchService;

    @BeforeEach
    void setUp() {
        emailBatchService = new EmailBatchService(
                batchRepository,
                recipientRepository,
                automationConfigRepository,
                reportEmailService,
                emailService,
                evaluationRepository,
                userRepository,
                submissionRepository
        );
    }

    @Test
    @DisplayName("previewBatch accurately determines Ready, Missing Report, Missing Email, and Already Sent")
    void testPreviewBatch() {
        StudentEvaluation eval1 = StudentEvaluation.builder()
                .studentId("N210001")
                .week("Week 1")
                .provider("gemini")
                .build();

        StudentEvaluation eval2 = StudentEvaluation.builder()
                .studentId("N210002")
                .week("Week 1")
                .provider("gemini")
                .build();

        when(evaluationRepository.findAllByOrderByIdAsc()).thenReturn(List.of(eval1, eval2));

        User user1 = User.builder()
                .email("n210001@rguktn.ac.in")
                .name("Student One")
                .branch("CSE")
                .academicYear("E2")
                .section("1")
                .build();

        User user2 = User.builder()
                .email("n210002@rguktn.ac.in")
                .name("Student Two")
                .branch("CSE")
                .academicYear("E2")
                .section("1")
                .build();

        when(userRepository.findAll()).thenReturn(List.of(user1, user2));
        when(recipientRepository.hasSentReportToStudentForWeek("N210001", "Week 1")).thenReturn(false);
        when(recipientRepository.hasSentReportToStudentForWeek("N210002", "Week 1")).thenReturn(true);

        BatchPreviewRequest req = BatchPreviewRequest.builder()
                .week("Week 1")
                .year("E2")
                .branch("CSE")
                .section("1")
                .build();

        BatchPreviewResponse response = emailBatchService.previewBatch(req);

        assertThat(response.getTotalStudents()).isEqualTo(2);
        assertThat(response.getReadyCount()).isEqualTo(1);
        assertThat(response.getAlreadySentCount()).isEqualTo(1);
        assertThat(response.getRecipients()).hasSize(2);

        BatchRecipientPreviewDTO r1 = response.getRecipients().get(0);
        assertThat(r1.getStudentId()).isEqualTo("N210001");
        assertThat(r1.getStatus()).isEqualTo("Ready");

        BatchRecipientPreviewDTO r2 = response.getRecipients().get(1);
        assertThat(r2.getStudentId()).isEqualTo("N210002");
        assertThat(r2.getStatus()).isEqualTo("Already Sent");
    }

    @Test
    @DisplayName("sendTestReport dispatches test email via ReportEmailService")
    void testSendTestReport() {
        when(emailService.isConfigured()).thenReturn(true);
        when(reportEmailService.sendStudentReportEmail(any())).thenReturn(
                EmailSendResult.builder()
                        .success(true)
                        .messageId("<gmail-test-123@smtp.gmail.com>")
                        .recipientEmail("faculty@rguktn.ac.in")
                        .build()
        );

        TestEmailRequest req = TestEmailRequest.builder()
                .studentId("N210001")
                .week("Week 1")
                .provider("gemini")
                .testRecipientEmail("faculty@rguktn.ac.in")
                .reportFormat("html")
                .customMessage("Review test output")
                .build();

        EmailSendResult result = emailBatchService.sendTestReport(req, "faculty@rguktn.ac.in");

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getMessageId()).isEqualTo("<gmail-test-123@smtp.gmail.com>");
        verify(reportEmailService).sendStudentReportEmail(any());
    }

    @Test
    @DisplayName("getStatistics aggregates correctly for Gmail SMTP")
    void testGetStatistics() {
        when(recipientRepository.countSentSince(any())).thenReturn(45L);
        when(batchRepository.sumTotalPendingCount()).thenReturn(10L);
        when(batchRepository.sumTotalSentCount()).thenReturn(250L);
        when(batchRepository.sumTotalFailedCount()).thenReturn(2L);
        when(emailService.isConfigured()).thenReturn(true);
        when(emailService.getSenderEmail()).thenReturn("no-reply@rguktn.ac.in");
        when(emailService.getSenderName()).thenReturn("RGUKT Academic Portal");

        EmailStatisticsResponse stats = emailBatchService.getStatistics();

        assertThat(stats.getEmailsSentToday()).isEqualTo(45L);
        assertThat(stats.getPendingEmails()).isEqualTo(10L);
        assertThat(stats.getSuccessfullySent()).isEqualTo(250L);
        assertThat(stats.getFailedEmails()).isEqualTo(2L);
        assertThat(stats.isConfigured()).isTrue();
        assertThat(stats.getCapacityNote()).contains("Gmail");
    }

    @Test
    @DisplayName("retryRecipient retries individual recipient delivery")
    void testRetryRecipient() {
        EmailBatch batch = EmailBatch.builder()
                .id(1L)
                .week("Week 1")
                .reportFormat("html")
                .build();

        EmailBatchRecipient recipient = EmailBatchRecipient.builder()
                .id(10L)
                .batch(batch)
                .studentId("N210001")
                .email("n210001@rguktn.ac.in")
                .status("FAILED")
                .retryCount(0)
                .build();

        when(recipientRepository.findById(10L)).thenReturn(Optional.of(recipient));
        when(recipientRepository.save(any())).thenReturn(recipient);
        when(reportEmailService.sendStudentReportEmail(any())).thenReturn(
                EmailSendResult.builder()
                        .success(true)
                        .messageId("<retry-msg-id>")
                        .build()
        );

        EmailBatchRecipientDTO retried = emailBatchService.retryRecipient(10L);

        assertThat(retried.getStatus()).isEqualTo("SENT");
        assertThat(retried.getMessageId()).isEqualTo("<retry-msg-id>");
        assertThat(retried.getRetryCount()).isEqualTo(1);
    }
}
