package com.selva.authportal.controller;

import com.selva.authportal.dto.*;
import com.selva.authportal.email.EmailSendRequest;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.service.EmailBatchService;
import com.selva.authportal.service.ReportEmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Controller providing REST endpoints for emailing evaluation reports (individual, batches, tests, custom files)
 * to students and academic faculty via Gmail SMTP.
 */
@Slf4j
@RestController
@RequestMapping("/api/email")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class EmailReportController {

    private final EmailService emailService;
    private final ReportEmailService reportEmailService;
    private final EmailBatchService emailBatchService;
    private final com.selva.authportal.service.ZipReportEmailService zipReportEmailService;
    private final com.selva.authportal.email.GmailRestApiService gmailRestApiService;

    /**
     * Checks if Gmail SMTP is configured and ready to dispatch emails.
     */
    @GetMapping("/status")
    public ResponseEntity<EmailStatusResponse> getStatus() {
        return ResponseEntity.ok(reportEmailService.getStatus());
    }

    /**
     * Generic email send endpoint for single or customized emails.
     */
    @PostMapping("/send")
    public ResponseEntity<EmailSendResult> sendGenericEmail(
            @Valid @RequestBody EmailSendRequest request
    ) {
        EmailSendResult result = emailService.sendEmail(request);
        return ResponseEntity.ok(result);
    }

    /**
     * Sends an evaluated student report (HTML, Gemini JSON, Ollama JSON, or all) to student's email.
     */
    @PostMapping("/send-student-report")
    public ResponseEntity<EmailSendResult> sendStudentReport(
            @Valid @RequestBody StudentReportEmailRequest request
    ) {
        EmailSendResult result = reportEmailService.sendStudentReportEmail(request);
        return ResponseEntity.ok(result);
    }

    /**
     * Triggers asynchronous dispatch of an email batch.
     */
    @PostMapping(path = {"/send-batch", "/batch/send"})
    public ResponseEntity<EmailBatchResponse> sendBatch(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody BatchSendRequest request
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        EmailBatchResponse response = emailBatchService.sendBatch(request, teacherEmail);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    /**
     * Retrieves flat email history (all individual sent, failed, and retrying emails).
     */
    @GetMapping("/history")
    public ResponseEntity<List<EmailHistoryItemDTO>> getHistory() {
        return ResponseEntity.ok(emailBatchService.getEmailHistory());
    }

    /**
     * Retries sending a specific failed email by recipient record ID.
     */
    @PostMapping("/retry/{id}")
    public ResponseEntity<EmailBatchRecipientDTO> retryEmailById(@PathVariable("id") Long id) {
        return ResponseEntity.ok(emailBatchService.retryRecipient(id));
    }

    /**
     * Uploads and emails any arbitrary HTML file or JSON evaluation report directly to any recipient.
     */
    @PostMapping(value = "/send-custom-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EmailSendResult> sendCustomFileReport(
            @RequestParam("file") MultipartFile file,
            @RequestParam("recipientEmail") String recipientEmail,
            @RequestParam(value = "subject", required = false) String subject,
            @RequestParam(value = "message", required = false) String message
    ) throws IOException {
        EmailSendResult result = reportEmailService.sendCustomReportEmail(file, recipientEmail, subject, message);
        return ResponseEntity.status(HttpStatus.OK).body(result);
    }

    /**
     * Sends raw content (HTML or JSON string) as an attached email document.
     */
    @PostMapping(value = "/send-raw", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<EmailSendResult> sendRawReport(
            @RequestBody Map<String, String> payload
    ) {
        String recipientEmail = payload.get("recipientEmail");
        String subject = payload.get("subject");
        String filename = payload.get("filename");
        String content = payload.get("content");
        String message = payload.get("message");

        EmailSendResult result = reportEmailService.sendRawContentEmail(recipientEmail, subject, filename, content, message);
        return ResponseEntity.ok(result);
    }

    /**
     * Sends a real test email via Gmail SMTP to verify configuration and rendering.
     */
    @PostMapping("/test-report")
    public ResponseEntity<EmailSendResult> sendTestReport(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody TestEmailRequest request
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        EmailSendResult result = emailBatchService.sendTestReport(request, teacherEmail);
        return ResponseEntity.ok(result);
    }

    /**
     * Previews candidate recipients for a batch email operation.
     */
    @PostMapping("/batch/preview")
    public ResponseEntity<BatchPreviewResponse> previewBatch(
            @Valid @RequestBody BatchPreviewRequest request
    ) {
        BatchPreviewResponse response = emailBatchService.previewBatch(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Lists all email batches with summary counts and status.
     */
    @GetMapping("/batches")
    public ResponseEntity<List<EmailBatchResponse>> getBatches() {
        return ResponseEntity.ok(emailBatchService.getBatches());
    }

    /**
     * Retrieves detailed information and recipient records for a specific batch.
     */
    @GetMapping("/batches/{batchId}")
    public ResponseEntity<EmailBatchResponse> getBatchDetails(@PathVariable("batchId") Long batchId) {
        return ResponseEntity.ok(emailBatchService.getBatchDetails(batchId));
    }

    /**
     * Retries failed recipient deliveries in a batch.
     */
    @PostMapping("/batches/{batchId}/retry")
    public ResponseEntity<EmailBatchResponse> retryBatchFailed(@PathVariable("batchId") Long batchId) {
        return ResponseEntity.ok(emailBatchService.retryFailed(batchId));
    }

    /**
     * Retrieves dashboard KPI metrics.
     */
    @GetMapping("/statistics")
    public ResponseEntity<EmailStatisticsResponse> getStatistics() {
        return ResponseEntity.ok(emailBatchService.getStatistics());
    }

    /**
     * Retrieves automated report sending configuration.
     */
    @GetMapping("/automation")
    public ResponseEntity<EmailAutomationDTO> getAutomationConfig() {
        return ResponseEntity.ok(emailBatchService.getAutomationConfig());
    }

    /**
     * Saves automated report sending configuration.
     */
    @PostMapping("/automation")
    public ResponseEntity<EmailAutomationDTO> saveAutomationConfig(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody EmailAutomationDTO dto
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        return ResponseEntity.ok(emailBatchService.saveAutomationConfig(dto, teacherEmail));
    }

    /**
     * Analyzes an uploaded ZIP archive or local path containing student HTML evaluation reports,
     * extracts student IDs, detects emails, and returns the parsed report preview.
     */
    @PostMapping(path = "/reports-zip/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ZipReportsParseResponse> parseZipReportsMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "filePath", required = false) String filePath
    ) {
        ZipReportsParseResponse response = zipReportEmailService.parseZipReports(file, filePath);
        return ResponseEntity.ok(response);
    }

    @PostMapping(path = "/reports-zip/parse", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ZipReportsParseResponse> parseZipReportsJson(
            @RequestBody(required = false) Map<String, String> body
    ) {
        String filePath = (body != null) ? body.get("filePath") : null;
        ZipReportsParseResponse response = zipReportEmailService.parseZipReports(null, filePath);
        return ResponseEntity.ok(response);
    }

    /**
     * Sends student HTML reports extracted from a ZIP archive directly via Gmail SMTP.
     * Supports both real student delivery and safe testing mode with a targetOverrideEmail.
     */
    @PostMapping(path = "/reports-zip/send", consumes = {MediaType.MULTIPART_FORM_DATA_VALUE})
    public ResponseEntity<ZipReportsSendResponse> sendZipReports(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "filePath", required = false) String filePath,
            @RequestParam(value = "year", required = false, defaultValue = "E2") String year,
            @RequestParam(value = "week", required = false, defaultValue = "Week 4") String week,
            @RequestParam(value = "section", required = false, defaultValue = "1") String section,
            @RequestParam(value = "facultyMessage", required = false) String facultyMessage,
            @RequestParam(value = "targetOverrideEmail", required = false) String targetOverrideEmail,
            @RequestParam(value = "selectedStudentIds", required = false) List<String> selectedStudentIds
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        ZipReportsSendRequest request = ZipReportsSendRequest.builder()
                .year(year)
                .week(week)
                .section(section)
                .facultyMessage(facultyMessage)
                .targetOverrideEmail(targetOverrideEmail)
                .sourceFilePath(filePath)
                .selectedStudentIds(selectedStudentIds)
                .build();

        ZipReportsSendResponse response = zipReportEmailService.sendZipReports(request, file, filePath, teacherEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Generates the Google OAuth consent URL for connecting a Gmail account via Gmail REST API over HTTPS (Port 443).
     * Bypasses Render's outbound SMTP block completely.
     */
    @GetMapping("/oauth/connect-url")
    public ResponseEntity<Map<String, String>> getOAuthConnectUrl(@RequestParam("redirectUri") String redirectUri) {
        String authUrl = gmailRestApiService.buildAuthorizationUrl(redirectUri);
        return ResponseEntity.ok(Map.of("url", authUrl));
    }

    /**
     * Exchanges a Google OAuth authorization code for a persistent refresh token to enable Gmail REST API dispatching.
     */
    @PostMapping("/oauth/exchange-code")
    public ResponseEntity<Map<String, Object>> exchangeOAuthCode(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body
    ) {
        String code = body.get("code");
        String redirectUri = body.get("redirectUri");
        String adminEmail = (userDetails != null) ? userDetails.getUsername() : null;
        Map<String, Object> result = gmailRestApiService.exchangeAuthorizationCode(code, redirectUri, adminEmail);
        return ResponseEntity.ok(result);
    }

    /**
     * Checks Gmail REST API OAuth authorization status.
     */
    @GetMapping("/oauth/status")
    public ResponseEntity<Map<String, Object>> getOAuthStatus() {
        boolean configured = gmailRestApiService.isConfigured();
        String email = gmailRestApiService.getConnectedEmail();
        return ResponseEntity.ok(Map.of(
                "configured", configured,
                "connectedEmail", email != null ? email : "",
                "transport", configured ? "GMAIL_REST_API" : "GMAIL_SMTP",
                "renderFreeTierCompatible", configured
        ));
    }
}
