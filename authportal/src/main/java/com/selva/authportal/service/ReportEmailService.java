package com.selva.authportal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.EmailStatusResponse;
import com.selva.authportal.dto.SingleStudentReportResponse;
import com.selva.authportal.dto.StudentReportEmailRequest;
import com.selva.authportal.email.EmailAttachment;
import com.selva.authportal.email.EmailSendRequest;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.model.EmailBatch;
import com.selva.authportal.model.EmailBatchRecipient;
import com.selva.authportal.model.StudentEvaluation;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.EmailBatchRecipientRepository;
import com.selva.authportal.repository.EmailBatchRepository;
import com.selva.authportal.repository.StudentEvaluationRepository;
import com.selva.authportal.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * Service orchestrating evaluation report preparation (HTML generation, Gemini/Ollama JSON extraction)
 * and emailing via Gmail SMTP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportEmailService {

    private final EmailService emailService;
    private final EvaluationService evaluationService;
    private final StudentEvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final EmailBatchRepository batchRepository;
    private final EmailBatchRecipientRepository recipientRepository;
    private final ObjectMapper objectMapper;
    private final EmailReportHtmlTransformer htmlTransformer;

    /**
     * Retrieves current Gmail SMTP integration status.
     */
    public EmailStatusResponse getStatus() {
        boolean configured = emailService.isConfigured();
        return EmailStatusResponse.builder()
                .provider("GMAIL_SMTP")
                .configured(configured)
                .host(emailService.getHost())
                .port(emailService.getPort())
                .sender(emailService.getSenderEmail())
                .senderName(emailService.getSenderName())
                .message(configured
                        ? "Gmail SMTP service is connected and ready to dispatch evaluation reports."
                        : "Gmail SMTP is not configured. Please supply MAIL_USERNAME and MAIL_PASSWORD in your .env file.")
                .build();
    }

    /**
     * Sends an evaluated student report (visual HTML report, Gemini JSON, Ollama JSON, or all)
     * to the student or specified recipient email via Gmail SMTP.
     */
    @Transactional
    public EmailSendResult sendStudentReportEmail(StudentReportEmailRequest request) {
        String studentId = request.getStudentId().trim().toUpperCase();
        EvaluationService.WeekInfo weekInfo = EvaluationService.normalizeWeek(request.getWeek());
        String week = weekInfo.displayName();

        // 1. Duplicate protection check
        boolean alreadySent = recipientRepository.hasSentReportToStudentForWeek(studentId, week);
        if (alreadySent && !request.isForceResend()) {
            throw new IllegalStateException("Report already sent to student " + studentId + " for " + week + ". Enable force resend if you wish to re-dispatch.");
        }

        // 2. Fetch full SingleStudentReportResponse
        SingleStudentReportResponse report = evaluationService.getStudentReport(studentId, week, request.getProvider());

        // 3. Resolve recipient email address
        String recipientEmail = request.getRecipientEmail();
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            recipientEmail = resolveStudentEmail(studentId);
        } else {
            recipientEmail = recipientEmail.trim();
        }

        // 4. Fetch all evaluation records for this student and week (for raw Gemini and Ollama JSONs)
        List<StudentEvaluation> evals = evaluationRepository.findAllByStudentIdAndWeek(studentId, week);

        // 5. Build Attachments according to requested reportFormat
        List<EmailAttachment> attachments = new ArrayList<>();
        String format = (request.getReportFormat() != null) ? request.getReportFormat().toLowerCase().trim() : "html";

        // HTML Standalone Report Attachment
        String htmlFileContent = null;
        if ("html".equals(format) || "all".equals(format)) {
            htmlFileContent = generateStandaloneHtmlReport(report);
            byte[] htmlBytes = htmlFileContent.getBytes(StandardCharsets.UTF_8);
            attachments.add(EmailAttachment.builder()
                    .name("Evaluation_Report_" + studentId + "_" + week.replace(" ", "_") + ".html")
                    .content(htmlBytes)
                    .contentType("text/html; charset=UTF-8")
                    .build());
        }

        // Gemini JSON Attachment
        if ("gemini".equals(format) || "all".equals(format)) {
            evals.stream()
                    .filter(e -> "gemini".equalsIgnoreCase(e.getProvider()) && e.getRawJson() != null && !e.getRawJson().isBlank())
                    .findFirst()
                    .ifPresent(geminiEval -> {
                        byte[] jsonBytes = geminiEval.getRawJson().getBytes(StandardCharsets.UTF_8);
                        attachments.add(EmailAttachment.builder()
                                .name("Gemini_Report_" + studentId + "_" + week.replace(" ", "_") + ".json")
                                .content(jsonBytes)
                                .contentType("application/json; charset=UTF-8")
                                .build());
                    });
        }

        // Ollama JSON Attachment
        if ("ollama".equals(format) || "all".equals(format)) {
            evals.stream()
                    .filter(e -> "ollama".equalsIgnoreCase(e.getProvider()) && e.getRawJson() != null && !e.getRawJson().isBlank())
                    .findFirst()
                    .ifPresent(ollamaEval -> {
                        byte[] jsonBytes = ollamaEval.getRawJson().getBytes(StandardCharsets.UTF_8);
                        attachments.add(EmailAttachment.builder()
                                .name("Ollama_Report_" + studentId + "_" + week.replace(" ", "_") + ".json")
                                .content(jsonBytes)
                                .contentType("application/json; charset=UTF-8")
                                .build());
                    });
        }

        // 6. Generate Email Subject & Rich Academic HTML Body
        String subject = String.format("[RGUKT Lab Portal] %s Evaluation Report - %s", week, studentId);

        // Resolve student name
        String studentName = studentId;
        try {
            Optional<User> uOpt = userRepository.findByEmail(studentId.toLowerCase() + "@rguktn.ac.in");
            if (uOpt.isPresent() && uOpt.get().getName() != null && !uOpt.get().getName().isBlank()) {
                studentName = uOpt.get().getName();
            }
        } catch (Exception ignored) {}

        // When an HTML report exists, render the report directly as the EMAIL BODY using email-safe HTML/CSS
        String emailHtmlBody;
        if (htmlFileContent != null && !htmlFileContent.isBlank()) {
            emailHtmlBody = buildCompleteAcademicReportEmailHtml(studentName, studentId, week, request.getCustomMessage(), htmlFileContent);
        } else {
            emailHtmlBody = buildEmailHtmlBody(report, studentName, request.getCustomMessage());
        }

        // 7. Dispatch via Gmail SMTP
        EmailSendRequest sendReq = EmailSendRequest.builder()
                .to(recipientEmail)
                .toName(studentName)
                .subject(subject)
                .body(emailHtmlBody)
                .html(true)
                .customMessage(request.getCustomMessage())
                .attachments(attachments)
                .build();

        EmailSendResult result;
        try {
            result = emailService.sendEmail(sendReq);

            // 8. Record successful dispatch in history
            recordIndividualSendHistory(studentId, recipientEmail, subject, week, "SENT", result.getMessageId(), null);

            return result;
        } catch (Exception e) {
            log.error("Failed to dispatch student report to {}: {}", recipientEmail, e.getMessage());
            // Record failed dispatch in history
            recordIndividualSendHistory(studentId, recipientEmail, subject, week, "FAILED", null, e.getMessage());
            throw e;
        }
    }

    /**
     * Uploads and emails any arbitrary HTML file or JSON evaluation report directly to any recipient.
     */
    @Transactional
    public EmailSendResult sendCustomReportEmail(
            MultipartFile file,
            String recipientEmail,
            String subject,
            String customMessage
    ) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Attached report file cannot be empty.");
        }
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Recipient email address is required.");
        }

        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            filename = "report_file";
        }

        byte[] bytes = file.getBytes();
        String fileContent = new String(bytes, StandardCharsets.UTF_8);

        // Keep the original HTML/file as an attachment
        List<EmailAttachment> attachments = List.of(
                EmailAttachment.builder()
                        .name(filename)
                        .content(bytes)
                        .contentType(file.getContentType())
                        .build()
        );

        String emailSubject = (subject != null && !subject.isBlank())
                ? subject.trim()
                : "[RGUKT Lab Portal] Lab Evaluation Report: " + filename;

        String body;
        if (htmlTransformer.isHtmlContent(fileContent, filename)) {
            body = buildCompleteAcademicReportEmailHtml("Student", "Student", "Report", customMessage, fileContent);
        } else {
            body = buildCustomFileEmailHtml(filename, customMessage);
        }

        EmailSendRequest sendReq = EmailSendRequest.builder()
                .to(recipientEmail.trim())
                .subject(emailSubject)
                .body(body)
                .html(true)
                .customMessage(customMessage)
                .attachments(attachments)
                .build();

        try {
            EmailSendResult result = emailService.sendEmail(sendReq);
            recordIndividualSendHistory("CUSTOM", recipientEmail.trim(), emailSubject, "Custom", "SENT", result.getMessageId(), null);
            return result;
        } catch (Exception e) {
            recordIndividualSendHistory("CUSTOM", recipientEmail.trim(), emailSubject, "Custom", "FAILED", null, e.getMessage());
            throw e;
        }
    }

    /**
     * Sends raw content (HTML or JSON string) as an attached email document.
     */
    @Transactional
    public EmailSendResult sendRawContentEmail(
            String recipientEmail,
            String subject,
            String filename,
            String content,
            String customMessage
    ) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Report content cannot be empty.");
        }
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            throw new IllegalArgumentException("Recipient email address is required.");
        }

        String safeFilename = (filename != null && !filename.isBlank()) ? filename.trim() : "report.html";
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);

        List<EmailAttachment> attachments = List.of(
                EmailAttachment.builder()
                        .name(safeFilename)
                        .content(bytes)
                        .contentType("text/html; charset=UTF-8")
                        .build()
        );

        String emailSubject = (subject != null && !subject.isBlank())
                ? subject.trim()
                : "[RGUKT Lab Portal] Evaluation Report Content: " + safeFilename;

        String body;
        if (htmlTransformer.isHtmlContent(content, safeFilename)) {
            body = buildCompleteAcademicReportEmailHtml("Student", "Student", "Report", customMessage, content);
        } else {
            body = buildCustomFileEmailHtml(safeFilename, customMessage);
        }

        EmailSendRequest sendReq = EmailSendRequest.builder()
                .to(recipientEmail.trim())
                .subject(emailSubject)
                .body(body)
                .html(true)
                .customMessage(customMessage)
                .attachments(attachments)
                .build();

        try {
            EmailSendResult result = emailService.sendEmail(sendReq);
            recordIndividualSendHistory("RAW", recipientEmail.trim(), emailSubject, "Raw", "SENT", result.getMessageId(), null);
            return result;
        } catch (Exception e) {
            recordIndividualSendHistory("RAW", recipientEmail.trim(), emailSubject, "Raw", "FAILED", null, e.getMessage());
            throw e;
        }
    }

    /**
     * Records an individual report send operation in EmailBatch and EmailBatchRecipient.
     * Guarantees that duplicate protection and history tables capture single as well as batch sends.
     */
    private void recordIndividualSendHistory(
            String studentId,
            String email,
            String subject,
            String week,
            String status,
            String messageId,
            String errorMessage
    ) {
        try {
            EmailBatch batch = EmailBatch.builder()
                    .week(week != null ? week : "Week")
                    .subject(subject)
                    .provider("single")
                    .reportFormat("html")
                    .totalRecipients(1)
                    .sentCount("SENT".equalsIgnoreCase(status) ? 1 : 0)
                    .failedCount("FAILED".equalsIgnoreCase(status) ? 1 : 0)
                    .pendingCount(0)
                    .status("SENT".equalsIgnoreCase(status) ? "COMPLETED" : "FAILED")
                    .createdBy("SYSTEM")
                    .completedAt(Instant.now())
                    .build();

            EmailBatchRecipient rec = EmailBatchRecipient.builder()
                    .batch(batch)
                    .studentId(studentId)
                    .email(email)
                    .status(status)
                    .messageId(messageId)
                    .errorMessage(errorMessage)
                    .sentAt(Instant.now())
                    .retryCount(0)
                    .build();

            batch.setRecipients(List.of(rec));
            batchRepository.save(batch);
        } catch (Exception e) {
            log.warn("Could not save email history record for {}: {}", studentId, e.getMessage());
        }
    }

    /**
     * Resolves student email from database User record or RGUKT institutional pattern.
     */
    public String resolveStudentEmail(String studentId) {
        String email = studentId.toLowerCase() + "@rguktn.ac.in";
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            return userOpt.get().getEmail();
        }
        return email;
    }

    /**
     * Builds the complete academic email conforming strictly to the layout:
     * --------------------------------------------------
     * RGUKT Academic Portal
     * Lab Evaluation Report
     * Dear Student,
     * [Faculty custom message]
     * [REPORT CONTENT]
     * Regards,
     * RGUKT Academic Portal
     * --------------------------------------------------
     */
    private String buildCompleteAcademicReportEmailHtml(
            String studentName,
            String studentId,
            String week,
            String facultyMessage,
            String rawReportHtml
    ) {
        // Transform the inner report into email-safe table and inline styles
        String transformedReport = htmlTransformer.transformToEmailSafeHtml(rawReportHtml, null);

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        sb.append("<title>RGUKT Academic Portal - Evaluation Report</title>\n");
        sb.append("</head>\n");
        sb.append("<body style=\"margin:0; padding:20px; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a;\">\n");

        sb.append("<table align=\"center\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:680px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 2px 8px rgba(0,0,0,0.06);\">\n");

        // 1. Header: RGUKT Academic Portal / Lab Evaluation Report
        sb.append("<tr><td style=\"background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); background-color:#1e3a8a; padding:24px 28px; text-align:left; color:#ffffff;\">\n");
        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>\n");
        sb.append("<td>\n");
        sb.append("<div style=\"font-size:20px; font-weight:800; letter-spacing:-0.01em; margin:0;\">RGUKT Academic Portal</div>\n");
        sb.append("<div style=\"font-size:13px; opacity:0.9; margin-top:4px; font-weight:500;\">Lab Evaluation Report • ").append(escapeHtml(week)).append("</div>\n");
        sb.append("</td>\n");
        sb.append("<td align=\"right\" style=\"font-size:11px; font-weight:600; opacity:0.85;\">Institutional Record</td>\n");
        sb.append("</tr></table>\n");
        sb.append("</td></tr>\n");

        // 2. Salutation & Faculty Message
        sb.append("<tr><td style=\"padding:24px 28px 12px 28px;\">\n");
        sb.append("<p style=\"margin:0 0 14px 0; font-size:15px; color:#1e293b; line-height:1.5;\">Dear <strong>").append(escapeHtml(studentName)).append("</strong>,</p>\n");

        if (facultyMessage != null && !facultyMessage.trim().isEmpty()) {
            sb.append("<div style=\"background-color:#eff6ff; border-left:4px solid #2563eb; border-radius:4px; padding:12px 16px; margin:16px 0 20px 0;\">\n");
            sb.append("<div style=\"font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#1d4ed8; margin-bottom:4px;\">Message from Faculty:</div>\n");
            sb.append("<div style=\"font-size:14px; color:#1e293b; line-height:1.5; white-space:pre-wrap;\">").append(escapeHtml(facultyMessage.trim())).append("</div>\n");
            sb.append("</div>\n");
        } else {
            sb.append("<p style=\"margin:0 0 16px 0; font-size:14px; color:#475569;\">Please find your laboratory evaluation details and performance breakdown below.</p>\n");
        }
        sb.append("</td></tr>\n");

        // 3. Visual Separator
        sb.append("<tr><td style=\"padding:0 28px;\"><hr style=\"border:none; border-top:1px solid #e2e8f0; margin:4px 0 16px 0;\" /></td></tr>\n");

        // 4. [REPORT CONTENT]
        sb.append("<tr><td style=\"padding:0 28px 20px 28px;\">\n");
        sb.append("<div style=\"background-color:#ffffff;\">\n");
        sb.append(transformedReport);
        sb.append("\n</div>\n");
        sb.append("</td></tr>\n");

        // 5. Visual Separator & Academic Sign-off
        sb.append("<tr><td style=\"padding:0 28px;\"><hr style=\"border:none; border-top:1px solid #e2e8f0; margin:10px 0 18px 0;\" /></td></tr>\n");
        sb.append("<tr><td style=\"padding:0 28px 24px 28px; font-size:14px; color:#334155; line-height:1.6;\">\n");
        sb.append("<p style=\"margin:0;\">Regards,<br/><strong>RGUKT Academic Portal</strong><br/><span style=\"font-size:12px; color:#64748b;\">Rajiv Gandhi University of Knowledge Technologies</span></p>\n");
        sb.append("</td></tr>\n");

        // 6. Footer
        sb.append("<tr><td style=\"background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:16px 28px; text-align:center; font-size:11px; color:#64748b;\">\n");
        sb.append("<p style=\"margin:0 0 4px 0;\">Rajiv Gandhi University of Knowledge Technologies (RGUKT) • Academic Evaluation Portal</p>\n");
        sb.append("<p style=\"margin:0; opacity:0.8;\">This is an automated institutional transmission. Standalone report files are attached if requested.</p>\n");
        sb.append("</td></tr>\n");

        sb.append("</table>\n");
        sb.append("</body>\n</html>");

        return sb.toString();
    }

    /**
     * Builds responsive, email-safe HTML body fallback when no raw HTML report was provided.
     */
    private String buildEmailHtmlBody(SingleStudentReportResponse report, String studentName, String teacherNote) {
        String studentId = report.getStudentId() != null ? report.getStudentId() : "Student";
        String week = report.getWeek() != null ? report.getWeek() : "Lab Week";
        String finalScore = report.getFinalScore() != null ? report.getFinalScore() : "N/A";
        String grade = report.getGrade() != null ? report.getGrade() : "-";
        String status = report.getStatus() != null ? report.getStatus() : "Evaluated";
        String provider = report.getProvider() != null ? report.getProvider().toUpperCase() : "AI";
        String modelName = report.getModelName() != null ? " (" + report.getModelName() + ")" : "";
        String assessment = report.getAssessment() != null ? report.getAssessment() : "No assessment summary available.";
        String feedback = report.getFeedbackText() != null ? report.getFeedbackText() : "";

        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html><head><meta charset='utf-8'></head>\n");
        sb.append("<body style=\"margin:0; padding:20px; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0f172a;\">\n");

        sb.append("<table align=\"center\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:680px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1;\">\n");

        // Header
        sb.append("<tr><td style=\"background-color:#1e3a8a; padding:24px 28px; color:#ffffff;\">\n");
        sb.append("<div style=\"font-size:20px; font-weight:800;\">RGUKT Academic Portal</div>\n");
        sb.append("<div style=\"font-size:13px; opacity:0.9; margin-top:4px;\">Lab Evaluation Report • ").append(escapeHtml(week)).append("</div>\n");
        sb.append("</td></tr>\n");

        // Salutation & Note
        sb.append("<tr><td style=\"padding:24px 28px 12px 28px;\">\n");
        sb.append("<p style=\"margin:0 0 14px 0; font-size:15px;\">Dear <strong>").append(escapeHtml(studentName)).append("</strong>,</p>\n");

        if (teacherNote != null && !teacherNote.trim().isEmpty()) {
            sb.append("<div style=\"background-color:#eff6ff; border-left:4px solid #2563eb; padding:12px 16px; margin:14px 0 20px 0; border-radius:4px;\">\n");
            sb.append("<div style=\"font-size:11px; font-weight:700; text-transform:uppercase; color:#1d4ed8;\">Message from Faculty:</div>\n");
            sb.append("<div style=\"font-size:14px; margin-top:4px;\">").append(escapeHtml(teacherNote.trim())).append("</div>\n");
            sb.append("</div>\n");
        }
        sb.append("</td></tr>\n");

        // Report Content Body
        sb.append("<tr><td style=\"padding:0 28px 24px 28px;\">\n");

        // Score summary card
        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:20px;\">\n");
        sb.append("<tr><td align=\"center\">\n");
        sb.append("<div style=\"font-size:12px; font-weight:700; text-transform:uppercase; color:#64748b;\">Awarded Marks</div>\n");
        sb.append("<div style=\"font-size:32px; font-weight:800; color:#2563eb; margin:4px 0;\">").append(escapeHtml(finalScore)).append("</div>\n");
        sb.append("<div>");
        sb.append("<span style=\"background:#dbeafe; color:#1e40af; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; margin-right:6px;\">Grade: ").append(escapeHtml(grade)).append("</span>");
        sb.append("<span style=\"background:#dcfce7; color:#166534; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; margin-right:6px;\">").append(escapeHtml(status)).append("</span>");
        sb.append("<span style=\"background:#f3e8ff; color:#6b21a8; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700;\">").append(escapeHtml(provider)).append(escapeHtml(modelName)).append("</span>");
        sb.append("</div></td></tr></table>\n");

        // Rubric Breakdown
        sb.append("<div style=\"font-size:15px; font-weight:700; color:#0f172a; margin-bottom:8px;\">Criteria Breakdown</div>\n");
        sb.append("<table width=\"100%\" cellpadding=\"6\" cellspacing=\"0\" border=\"0\" style=\"border-collapse:collapse; font-size:13px; margin-bottom:20px;\">\n");
        if (report.getObjectiveScore() != null) sb.append("<tr style=\"border-bottom:1px solid #f1f5f9;\"><td style=\"color:#475569;\">Objective</td><td align=\"right\"><strong>").append(report.getObjectiveScore()).append("</strong></td></tr>\n");
        if (report.getProblemUnderstandingScore() != null) sb.append("<tr style=\"border-bottom:1px solid #f1f5f9;\"><td style=\"color:#475569;\">Problem Understanding</td><td align=\"right\"><strong>").append(report.getProblemUnderstandingScore()).append("</strong></td></tr>\n");
        if (report.getLogicScore() != null) sb.append("<tr style=\"border-bottom:1px solid #f1f5f9;\"><td style=\"color:#475569;\">Logic & Approach</td><td align=\"right\"><strong>").append(report.getLogicScore()).append("</strong></td></tr>\n");
        if (report.getVariablesScore() != null) sb.append("<tr style=\"border-bottom:1px solid #f1f5f9;\"><td style=\"color:#475569;\">Variables & Purpose</td><td align=\"right\"><strong>").append(report.getVariablesScore()).append("</strong></td></tr>\n");
        if (report.getObservationScore() != null) sb.append("<tr style=\"border-bottom:1px solid #f1f5f9;\"><td style=\"color:#475569;\">Observations / Output</td><td align=\"right\"><strong>").append(report.getObservationScore()).append("</strong></td></tr>\n");
        sb.append("</table>\n");

        // Teacher Feedback if present
        if (report.isReviewed() && !feedback.isBlank()) {
            sb.append("<div style=\"font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px;\">Faculty Feedback</div>\n");
            sb.append("<div style=\"background-color:#eff6ff; border-left:4px solid #3b82f6; padding:12px; margin-bottom:20px; font-size:14px; border-radius:0 4px 4px 0;\">").append(escapeHtml(feedback)).append("</div>\n");
        }

        // Assessment
        sb.append("<div style=\"font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px;\">Assessment Summary</div>\n");
        sb.append("<p style=\"font-size:14px; line-height:1.6; color:#334155; margin-bottom:20px;\">").append(escapeHtml(assessment)).append("</p>\n");

        sb.append("<hr style=\"border:none; border-top:1px solid #e2e8f0; margin:20px 0 16px 0;\" />\n");
        sb.append("<p style=\"margin:0; font-size:14px; color:#334155;\">Regards,<br/><strong>RGUKT Academic Portal</strong></p>\n");

        sb.append("</td></tr>\n");

        // Footer
        sb.append("<tr><td style=\"background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:14px 28px; text-align:center; font-size:11px; color:#94a3b8;\">\n");
        sb.append("Rajiv Gandhi University of Knowledge Technologies • Academic Lab Evaluation System\n");
        sb.append("</td></tr></table>\n");
        sb.append("</body></html>");

        return sb.toString();
    }

    private String buildCustomFileEmailHtml(String filename, String customMessage) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html><html><head><meta charset='utf-8'></head>");
        sb.append("<body style=\"margin:0; padding:20px; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1e293b;\">");
        sb.append("<table align=\"center\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;\">");
        sb.append("<tr><td style=\"background-color:#1e3a8a; padding:20px 24px; color:#ffffff;\">");
        sb.append("<h2 style=\"margin:0; font-size:18px;\">RGUKT Academic Portal</h2>");
        sb.append("<p style=\"margin:4px 0 0 0; font-size:12px; opacity:0.9;\">Lab Report Document Dispatch</p>");
        sb.append("</td></tr>");

        sb.append("<tr><td style=\"padding:20px 24px;\">");
        sb.append("<p>Dear Recipient,</p>");
        sb.append("<p>An evaluation report document has been dispatched to you via the RGUKT Lab Portal.</p>");

        sb.append("<div style=\"background-color:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; padding:12px 16px; margin:16px 0;\">");
        sb.append("<strong>Attached File:</strong> ").append(escapeHtml(filename));
        sb.append("</div>");

        if (customMessage != null && !customMessage.isBlank()) {
            sb.append("<div style=\"background-color:#eff6ff; border-left:4px solid #3b82f6; padding:12px 16px; border-radius:0 6px 6px 0; margin:16px 0; font-size:14px;\">");
            sb.append("<strong>Message from Faculty:</strong><br/>");
            sb.append(escapeHtml(customMessage.trim()));
            sb.append("</div>");
        }

        sb.append("<p style=\"font-size:13px; color:#64748b;\">Regards,<br/><strong>RGUKT Academic Portal</strong></p>");
        sb.append("</td></tr>");

        sb.append("<tr><td style=\"background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:14px; text-align:center; font-size:11px; color:#94a3b8;\">");
        sb.append("RGUKT Academic C-Program Lab Portal");
        sb.append("</td></tr>");
        sb.append("</table></body></html>");

        return sb.toString();
    }

    /**
     * Generates a fully self-contained offline HTML report file.
     */
    public String generateStandaloneHtmlReport(SingleStudentReportResponse report) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html lang='en'>\n<head>\n<meta charset='UTF-8'>\n");
        sb.append("<meta name='viewport' content='width=device-width, initial-scale=1.0'>\n");
        sb.append("<title>Evaluation Report - ").append(report.getStudentId()).append(" - ").append(report.getWeek()).append("</title>\n");
        sb.append("<style>\n");
        sb.append(":root { --primary: #2563eb; --primary-dark: #1d4ed8; --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; }\n");
        sb.append("body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem 1rem; }\n");
        sb.append(".report-wrapper { max-width: 900px; margin: 0 auto; background: var(--card); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid var(--border); overflow: hidden; }\n");
        sb.append(".banner { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 2.5rem 2rem; }\n");
        sb.append(".banner h1 { margin: 0; font-size: 1.75rem; font-weight: 800; }\n");
        sb.append(".banner p { margin: 0.5rem 0 0 0; opacity: 0.9; font-size: 0.95rem; }\n");
        sb.append(".body { padding: 2rem; }\n");
        sb.append(".badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }\n");
        sb.append(".badge { padding: 0.35rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; }\n");
        sb.append(".badge-blue { background: #dbeafe; color: #1e40af; }\n");
        sb.append(".badge-green { background: #dcfce7; color: #166534; }\n");
        sb.append(".badge-purple { background: #f3e8ff; color: #6b21a8; }\n");
        sb.append(".score-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 2rem 0; }\n");
        sb.append(".score-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; text-align: center; }\n");
        sb.append(".score-val { font-size: 1.75rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem; }\n");
        sb.append(".score-lbl { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; font-weight: 600; }\n");
        sb.append(".table-wrap { overflow-x: auto; margin: 1.5rem 0; }\n");
        sb.append("table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }\n");
        sb.append("th, td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); text-align: left; }\n");
        sb.append("th { background: #f8fafc; color: var(--muted); font-weight: 600; }\n");
        sb.append(".box-blue { background: #eff6ff; border-left: 4px solid var(--primary); padding: 1rem; border-radius: 0 8px 8px 0; margin: 1rem 0; }\n");
        sb.append("@media print { body { background: white; padding: 0; } .report-wrapper { border: none; box-shadow: none; } }\n");
        sb.append("</style>\n</head>\n<body>\n");

        sb.append("<div class='report-wrapper'>\n");
        sb.append("<div class='banner'>\n");
        sb.append("<h1>RGUKT Academic C-Program Lab Portal</h1>\n");
        sb.append("<p>Laboratory Evaluation Report • ").append(report.getWeek()).append("</p>\n");
        sb.append("<div class='badges'>\n");
        sb.append("<span class='badge badge-blue'>Student: ").append(report.getStudentId()).append("</span>\n");
        if (report.getGrade() != null) sb.append("<span class='badge badge-green'>Grade: ").append(report.getGrade()).append("</span>\n");
        if (report.getProvider() != null) sb.append("<span class='badge badge-purple'>Provider: ").append(report.getProvider().toUpperCase()).append("</span>\n");
        if (report.isReviewed()) sb.append("<span class='badge badge-green'>Reviewed by Faculty ✓</span>\n");
        sb.append("</div>\n</div>\n");

        sb.append("<div class='body'>\n");
        sb.append("<div class='score-grid'>\n");
        sb.append("<div class='score-box'><div class='score-lbl'>Final Score</div><div class='score-val'>").append(report.getFinalScore() != null ? report.getFinalScore() : "-").append("</div></div>\n");
        sb.append("<div class='score-box'><div class='score-lbl'>Grade</div><div class='score-val' style='color:#166534;'>").append(report.getGrade() != null ? report.getGrade() : "-").append("</div></div>\n");
        sb.append("<div class='score-box'><div class='score-lbl'>Status</div><div class='score-val' style='font-size:1.15rem; color:#0f172a; margin-top:0.6rem;'>").append(report.getStatus() != null ? report.getStatus() : "-").append("</div></div>\n");
        sb.append("</div>\n");

        sb.append("<h3>Rubric & Criteria Breakdown</h3>\n");
        sb.append("<div class='table-wrap'><table><thead><tr><th>Criterion</th><th>Awarded Score</th></tr></thead><tbody>\n");
        if (report.getObjectiveScore() != null) sb.append("<tr><td>Objective of the Lab</td><td><strong>").append(report.getObjectiveScore()).append("</strong></td></tr>\n");
        if (report.getProblemUnderstandingScore() != null) sb.append("<tr><td>Problem Understanding</td><td><strong>").append(report.getProblemUnderstandingScore()).append("</strong></td></tr>\n");
        if (report.getLogicScore() != null) sb.append("<tr><td>Logic / Approach Used</td><td><strong>").append(report.getLogicScore()).append("</strong></td></tr>\n");
        if (report.getVariablesScore() != null) sb.append("<tr><td>Important Variables</td><td><strong>").append(report.getVariablesScore()).append("</strong></td></tr>\n");
        if (report.getObservationScore() != null) sb.append("<tr><td>What I Observed</td><td><strong>").append(report.getObservationScore()).append("</strong></td></tr>\n");
        if (report.getTotalScore() != null) sb.append("<tr><td><strong>Total Score</strong></td><td><strong>").append(report.getTotalScore()).append("</strong></td></tr>\n");
        sb.append("</tbody></table></div>\n");

        if (report.isReviewed() && report.getFeedbackText() != null && !report.getFeedbackText().isBlank()) {
            sb.append("<h3>Faculty Feedback</h3>\n");
            sb.append("<div class='box-blue'>").append(escapeHtml(report.getFeedbackText())).append("</div>\n");
        }

        sb.append("<h3>Overall Assessment</h3>\n");
        sb.append("<p style='line-height:1.6;'>").append(escapeHtml(report.getAssessment() != null ? report.getAssessment() : "No assessment provided.")).append("</p>\n");

        if (report.getStrengths() != null && !report.getStrengths().isEmpty()) {
            sb.append("<h3>Strengths</h3><ul>\n");
            for (String s : report.getStrengths()) {
                sb.append("<li>").append(escapeHtml(s)).append("</li>\n");
            }
            sb.append("</ul>\n");
        }

        if (report.getRecommendations() != null && !report.getRecommendations().isEmpty()) {
            sb.append("<h3>Recommendations</h3><ul>\n");
            for (String r : report.getRecommendations()) {
                sb.append("<li>").append(escapeHtml(r)).append("</li>\n");
            }
            sb.append("</ul>\n");
        }

        sb.append("</div>\n</div>\n</body>\n</html>");
        return sb.toString();
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;")
                .replace("\n", "<br/>");
    }
}
