package com.selva.authportal.service;

import com.selva.authportal.dto.*;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.*;
import com.selva.authportal.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailBatchService {

    private final EmailBatchRepository batchRepository;
    private final EmailBatchRecipientRepository recipientRepository;
    private final EmailAutomationConfigRepository automationConfigRepository;
    private final ReportEmailService reportEmailService;
    private final EmailService emailService;
    private final StudentEvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;

    /**
     * Previews recipients for a batch email operation, calculating ready, missing, and duplicate-send counts.
     */
    @Transactional(readOnly = true)
    public BatchPreviewResponse previewBatch(BatchPreviewRequest request) {
        String normalizedWeek = EvaluationService.normalizeWeek(request.getWeek()).displayName();
        String targetYear = (request.getYear() != null && !request.getYear().equalsIgnoreCase("ALL")) ? request.getYear().trim() : null;
        String targetBranch = (request.getBranch() != null && !request.getBranch().equalsIgnoreCase("ALL")) ? request.getBranch().trim() : null;
        String targetSection = (request.getSection() != null && !request.getSection().equalsIgnoreCase("ALL")) ? request.getSection().trim() : null;

        // Gather candidate student evaluations for this week
        List<StudentEvaluation> evals = evaluationRepository.findAllByOrderByIdAsc().stream()
                .filter(e -> normalizedWeek.equalsIgnoreCase(EvaluationService.normalizeWeek(e.getWeek()).displayName()))
                .collect(Collectors.toList());

        // Pre-load all registered users to correlate metadata
        Map<String, User> userMap = new HashMap<>();
        for (User u : userRepository.findAll()) {
            if (u.getEmail() != null && u.getEmail().contains("@")) {
                String local = u.getEmail().split("@")[0].trim().toUpperCase();
                userMap.put(local, u);
            }
        }

        // Distinct student IDs across evaluations and submissions
        Set<String> studentIds = new LinkedHashSet<>();
        evals.forEach(e -> studentIds.add(e.getStudentId().toUpperCase()));

        // Also check submissions matching week/section/year if available
        if (targetSection != null || targetYear != null || targetBranch != null) {
            try {
                EvaluationService.WeekInfo wInfo = EvaluationService.normalizeWeek(request.getWeek());
                List<Submission> subs = submissionRepository.findByWeek(wInfo.weekNumber());
                for (Submission s : subs) {
                    if (s.getStudentId() != null) {
                        studentIds.add(s.getStudentId().toUpperCase());
                    }
                }
            } catch (Exception ignored) {}
        }

        List<BatchRecipientPreviewDTO> recipientList = new ArrayList<>();
        int readyCount = 0;
        int missingReportsCount = 0;
        int missingEmailsCount = 0;
        int alreadySentCount = 0;

        for (String sId : studentIds) {
            User user = userMap.get(sId);
            String uBranch = (user != null && user.getBranch() != null) ? user.getBranch() : "CSE";
            String uYear = (user != null && user.getAcademicYear() != null) ? user.getAcademicYear() : "E2";
            String uSection = (user != null && user.getSection() != null) ? user.getSection() : "1";
            String uName = (user != null && user.getName() != null) ? user.getName() : sId;
            String email = (user != null && user.getEmail() != null) ? user.getEmail() : (sId.toLowerCase() + "@rguktn.ac.in");

            // Filter checks
            if (targetBranch != null && !targetBranch.equalsIgnoreCase(uBranch)) continue;
            if (targetYear != null && !targetYear.equalsIgnoreCase(uYear)) continue;
            if (targetSection != null && !targetSection.equalsIgnoreCase(uSection)) continue;

            // Check report availability
            boolean hasReport = evals.stream().anyMatch(e -> sId.equalsIgnoreCase(e.getStudentId()));
            boolean hasEmail = email != null && email.contains("@") && email.contains(".");
            boolean alreadySent = recipientRepository.hasSentReportToStudentForWeek(sId, normalizedWeek);

            String status;
            boolean eligible;

            if (!hasReport) {
                status = "Missing Report";
                eligible = false;
                missingReportsCount++;
            } else if (!hasEmail) {
                status = "Missing Email";
                eligible = false;
                missingEmailsCount++;
            } else if (alreadySent) {
                status = "Already Sent";
                eligible = true; // Can resend if forceResend is enabled
                alreadySentCount++;
            } else {
                status = "Ready";
                eligible = true;
                readyCount++;
            }

            recipientList.add(BatchRecipientPreviewDTO.builder()
                    .studentId(sId)
                    .name(uName)
                    .email(email)
                    .year(uYear)
                    .branch(uBranch)
                    .section(uSection)
                    .hasReport(hasReport)
                    .hasEmail(hasEmail)
                    .alreadySent(alreadySent)
                    .status(status)
                    .eligible(eligible)
                    .build());
        }

        recipientList.sort(Comparator.comparing(BatchRecipientPreviewDTO::getStudentId));

        return BatchPreviewResponse.builder()
                .totalStudents(recipientList.size())
                .readyCount(readyCount)
                .missingReportsCount(missingReportsCount)
                .missingEmailsCount(missingEmailsCount)
                .alreadySentCount(alreadySentCount)
                .recipients(recipientList)
                .build();
    }

    /**
     * Creates and triggers a batch email send operation in the background.
     */
    @Transactional
    public EmailBatchResponse sendBatch(BatchSendRequest request, String teacherEmail) {
        if (!emailService.isConfigured()) {
            throw new IllegalStateException("Gmail SMTP credentials are not configured in .env. Cannot dispatch email batch.");
        }

        BatchPreviewRequest previewReq = BatchPreviewRequest.builder()
                .year(request.getYear())
                .branch(request.getBranch())
                .section(request.getSection())
                .week(request.getWeek())
                .provider(request.getProvider())
                .reportFormat(request.getReportFormat())
                .build();

        BatchPreviewResponse preview = previewBatch(previewReq);

        List<BatchRecipientPreviewDTO> eligible = preview.getRecipients().stream()
                .filter(BatchRecipientPreviewDTO::isHasReport)
                .filter(BatchRecipientPreviewDTO::isHasEmail)
                .filter(r -> {
                    if (request.getSelectedStudentIds() != null && !request.getSelectedStudentIds().isEmpty()) {
                        return request.getSelectedStudentIds().contains(r.getStudentId());
                    }
                    if (!request.isForceResend() && r.isAlreadySent()) {
                        return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        if (eligible.isEmpty()) {
            throw new IllegalArgumentException("No eligible recipients found to dispatch. Ensure students have valid reports and emails.");
        }

        String normalizedWeek = EvaluationService.normalizeWeek(request.getWeek()).displayName();
        String subject = (request.getSubject() != null && !request.getSubject().isBlank())
                ? request.getSubject().trim()
                : String.format("[RGUKT Lab Portal] %s Evaluation Report", normalizedWeek);

        EmailBatch batch = EmailBatch.builder()
                .academicYear(request.getYear())
                .branch(request.getBranch())
                .section(request.getSection())
                .week(normalizedWeek)
                .subject(subject)
                .provider(request.getProvider() != null ? request.getProvider() : "all")
                .reportFormat(request.getReportFormat() != null ? request.getReportFormat() : "html")
                .customMessage(request.getCustomMessage())
                .totalRecipients(eligible.size())
                .pendingCount(eligible.size())
                .sentCount(0)
                .failedCount(0)
                .status("PROCESSING")
                .createdBy(teacherEmail)
                .build();

        List<EmailBatchRecipient> recipients = new ArrayList<>();
        for (BatchRecipientPreviewDTO r : eligible) {
            recipients.add(EmailBatchRecipient.builder()
                    .batch(batch)
                    .studentId(r.getStudentId())
                    .email(r.getEmail())
                    .status("PENDING")
                    .build());
        }
        batch.setRecipients(recipients);

        EmailBatch savedBatch = batchRepository.save(batch);

        // Dispatch background processing asynchronously
        processBatchAsync(savedBatch.getId());

        return mapToBatchResponse(savedBatch, false);
    }

    /**
     * Asynchronously executes email dispatching for an email batch via Gmail SMTP.
     */
    @Async("emailBatchExecutor")
    public void processBatchAsync(Long batchId) {
        log.info("Starting background processing for Email Batch #{} via Gmail SMTP", batchId);

        Optional<EmailBatch> opt = batchRepository.findById(batchId);
        if (opt.isEmpty()) return;
        EmailBatch batch = opt.get();

        List<EmailBatchRecipient> pendingRecipients = recipientRepository.findByBatchIdAndStatus(batchId, "PENDING");

        for (EmailBatchRecipient rec : pendingRecipients) {
            try {
                StudentReportEmailRequest emailReq = StudentReportEmailRequest.builder()
                        .studentId(rec.getStudentId())
                        .week(batch.getWeek())
                        .provider(batch.getProvider().equalsIgnoreCase("all") ? null : batch.getProvider())
                        .recipientEmail(rec.getEmail())
                        .reportFormat(batch.getReportFormat())
                        .customMessage(batch.getCustomMessage())
                        .forceResend(true) // Explicitly allowed in batch context
                        .build();

                EmailSendResult result = reportEmailService.sendStudentReportEmail(emailReq);

                rec.setStatus("SENT");
                rec.setSentAt(Instant.now());
                rec.setMessageId(result.getMessageId());
                rec.setErrorMessage(null);

                batch.setSentCount(batch.getSentCount() + 1);
                batch.setPendingCount(Math.max(0, batch.getPendingCount() - 1));
            } catch (Exception e) {
                log.error("Failed to email report to student {} in batch #{}: {}", rec.getStudentId(), batchId, e.getMessage());
                rec.setStatus("FAILED");
                rec.setErrorMessage(e.getMessage());

                batch.setFailedCount(batch.getFailedCount() + 1);
                batch.setPendingCount(Math.max(0, batch.getPendingCount() - 1));
            }

            recipientRepository.save(rec);
            batchRepository.save(batch);

            // Polite throttle to respect Gmail SMTP sending rate
            try {
                Thread.sleep(250);
            } catch (InterruptedException ignored) {}
        }

        // Finalize batch status
        if (batch.getFailedCount() == 0) {
            batch.setStatus("COMPLETED");
        } else if (batch.getSentCount() == 0) {
            batch.setStatus("FAILED");
        } else {
            batch.setStatus("PARTIALLY_FAILED");
        }
        batch.setCompletedAt(Instant.now());
        batchRepository.save(batch);

        log.info("Completed Email Batch #{}. Total: {}, Sent: {}, Failed: {}",
                batchId, batch.getTotalRecipients(), batch.getSentCount(), batch.getFailedCount());
    }

    /**
     * Retries sending all failed recipients in a batch.
     */
    @Transactional
    public EmailBatchResponse retryFailed(Long batchId) {
        EmailBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Email batch not found: " + batchId));

        List<EmailBatchRecipient> failed = recipientRepository.findByBatchIdAndStatus(batchId, "FAILED");
        if (failed.isEmpty()) {
            throw new IllegalArgumentException("Batch #" + batchId + " has no failed recipients to retry.");
        }

        for (EmailBatchRecipient r : failed) {
            r.setStatus("PENDING");
            r.setRetryCount(r.getRetryCount() + 1);
            recipientRepository.save(r);
        }

        batch.setPendingCount(batch.getPendingCount() + failed.size());
        batch.setFailedCount(Math.max(0, batch.getFailedCount() - failed.size()));
        batch.setStatus("PROCESSING");
        EmailBatch saved = batchRepository.save(batch);

        processBatchAsync(saved.getId());

        return mapToBatchResponse(saved, true);
    }

    /**
     * Retries sending a specific failed recipient by its record ID.
     */
    @Transactional
    public EmailBatchRecipientDTO retryRecipient(Long recipientId) {
        EmailBatchRecipient rec = recipientRepository.findById(recipientId)
                .orElseThrow(() -> new ResourceNotFoundException("Email recipient record not found: " + recipientId));

        rec.setStatus("RETRYING");
        rec.setRetryCount(rec.getRetryCount() + 1);
        recipientRepository.save(rec);

        EmailBatch batch = rec.getBatch();
        String week = (batch != null && batch.getWeek() != null) ? batch.getWeek() : "Week 1";
        String customMsg = (batch != null) ? batch.getCustomMessage() : null;

        try {
            StudentReportEmailRequest emailReq = StudentReportEmailRequest.builder()
                    .studentId(rec.getStudentId())
                    .week(week)
                    .recipientEmail(rec.getEmail())
                    .reportFormat(batch != null ? batch.getReportFormat() : "html")
                    .customMessage(customMsg)
                    .forceResend(true)
                    .build();

            EmailSendResult result = reportEmailService.sendStudentReportEmail(emailReq);
            rec.setStatus("SENT");
            rec.setMessageId(result.getMessageId());
            rec.setErrorMessage(null);
            rec.setSentAt(Instant.now());

            if (batch != null) {
                batch.setSentCount(batch.getSentCount() + 1);
                batch.setFailedCount(Math.max(0, batch.getFailedCount() - 1));
                batchRepository.save(batch);
            }
        } catch (Exception e) {
            log.error("Retry failed for recipient #{}: {}", recipientId, e.getMessage());
            rec.setStatus("FAILED");
            rec.setErrorMessage(e.getMessage());
        }

        EmailBatchRecipient saved = recipientRepository.save(rec);
        return EmailBatchRecipientDTO.builder()
                .id(saved.getId())
                .studentId(saved.getStudentId())
                .email(saved.getEmail())
                .status(saved.getStatus())
                .messageId(saved.getMessageId())
                .errorMessage(saved.getErrorMessage())
                .sentAt(saved.getSentAt())
                .retryCount(saved.getRetryCount())
                .build();
    }

    /**
     * Retrieves flat email history listing all sent, failed, and retrying email dispatches.
     */
    @Transactional(readOnly = true)
    public List<EmailHistoryItemDTO> getEmailHistory() {
        List<EmailBatchRecipient> allRecipients = recipientRepository.findAll();
        // Sort descending by sentAt or ID
        allRecipients.sort((a, b) -> {
            if (a.getSentAt() != null && b.getSentAt() != null) {
                return b.getSentAt().compareTo(a.getSentAt());
            }
            return b.getId().compareTo(a.getId());
        });

        // Resolve names where possible
        Map<String, String> nameCache = new HashMap<>();
        for (User u : userRepository.findAll()) {
            if (u.getEmail() != null && u.getEmail().contains("@")) {
                String local = u.getEmail().split("@")[0].trim().toUpperCase();
                nameCache.put(local, u.getName());
            }
        }

        List<EmailHistoryItemDTO> items = new ArrayList<>();
        for (EmailBatchRecipient r : allRecipients) {
            String subject = (r.getBatch() != null && r.getBatch().getSubject() != null)
                    ? r.getBatch().getSubject()
                    : "Lab Evaluation Report";
            String studentName = nameCache.getOrDefault(r.getStudentId().toUpperCase(), r.getStudentId());

            items.add(EmailHistoryItemDTO.builder()
                    .id(r.getId())
                    .batchId(r.getBatch() != null ? r.getBatch().getId() : null)
                    .studentId(r.getStudentId())
                    .studentName(studentName)
                    .email(r.getEmail())
                    .subject(subject)
                    .status(r.getStatus())
                    .messageId(r.getMessageId())
                    .errorMessage(r.getErrorMessage())
                    .sentAt(r.getSentAt())
                    .retryCount(r.getRetryCount())
                    .build());
        }

        return items;
    }

    /**
     * Sends a test email to a specific destination using the real Gmail SMTP implementation.
     */
    public EmailSendResult sendTestReport(TestEmailRequest request, String teacherEmail) {
        if (!emailService.isConfigured()) {
            throw new IllegalStateException("Gmail SMTP is not configured. Please supply MAIL_USERNAME and MAIL_PASSWORD in your .env file.");
        }

        String targetStudentId = (request.getStudentId() != null && !request.getStudentId().isBlank())
                ? request.getStudentId().trim().toUpperCase()
                : "N210001";

        String normalizedWeek = EvaluationService.normalizeWeek(request.getWeek()).displayName();

        StudentReportEmailRequest studentReq = StudentReportEmailRequest.builder()
                .studentId(targetStudentId)
                .week(normalizedWeek)
                .provider(request.getProvider().equalsIgnoreCase("all") ? null : request.getProvider())
                .recipientEmail(request.getTestRecipientEmail())
                .reportFormat(request.getReportFormat())
                .customMessage("[TEST DISPATCH by " + teacherEmail + "] " + (request.getCustomMessage() != null ? request.getCustomMessage() : ""))
                .forceResend(true)
                .build();

        return reportEmailService.sendStudentReportEmail(studentReq);
    }

    /**
     * Aggregates dashboard KPI metrics.
     */
    @Transactional(readOnly = true)
    public EmailStatisticsResponse getStatistics() {
        LocalDate today = LocalDate.now();
        Instant startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant();

        long sentToday = recipientRepository.countSentSince(startOfDay);
        long pending = batchRepository.sumTotalPendingCount();
        long success = batchRepository.sumTotalSentCount();
        long failed = batchRepository.sumTotalFailedCount();

        boolean configured = emailService.isConfigured();

        return EmailStatisticsResponse.builder()
                .emailsSentToday(sentToday)
                .pendingEmails(pending)
                .successfullySent(success)
                .failedEmails(failed)
                .todayLocallyTrackedCount(sentToday)
                .capacityNote("Standard Gmail accounts allow ~500 emails/day; Google Workspace accounts allow up to 2,000 emails/day.")
                .configured(configured)
                .senderEmail(emailService.getSenderEmail())
                .senderName(emailService.getSenderName())
                .build();
    }

    /**
     * Lists all batches in reverse chronological order.
     */
    @Transactional(readOnly = true)
    public List<EmailBatchResponse> getBatches() {
        return batchRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(b -> mapToBatchResponse(b, false))
                .collect(Collectors.toList());
    }

    /**
     * Gets full detail of a specific batch including recipient statuses.
     */
    @Transactional(readOnly = true)
    public EmailBatchResponse getBatchDetails(Long batchId) {
        EmailBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Email batch not found: " + batchId));
        return mapToBatchResponse(batch, true);
    }

    /**
     * Gets current email automation config.
     */
    @Transactional(readOnly = true)
    public EmailAutomationDTO getAutomationConfig() {
        EmailAutomationConfig config = automationConfigRepository.findFirstByOrderByIdAsc()
                .orElse(EmailAutomationConfig.builder().enabled(false).build());

        return EmailAutomationDTO.builder()
                .id(config.getId())
                .enabled(config.getEnabled())
                .triggerType(config.getTriggerType())
                .academicYear(config.getAcademicYear())
                .branch(config.getBranch())
                .section(config.getSection())
                .week(config.getWeek())
                .reportFormat(config.getReportFormat())
                .provider(config.getProvider())
                .updatedBy(config.getUpdatedBy())
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    /**
     * Saves email automation configuration.
     */
    @Transactional
    public EmailAutomationDTO saveAutomationConfig(EmailAutomationDTO dto, String teacherEmail) {
        EmailAutomationConfig config = automationConfigRepository.findFirstByOrderByIdAsc()
                .orElse(new EmailAutomationConfig());

        config.setEnabled(dto.getEnabled() != null ? dto.getEnabled() : false);
        config.setTriggerType(dto.getTriggerType() != null ? dto.getTriggerType() : "ON_FEEDBACK_SAVED");
        config.setAcademicYear(dto.getAcademicYear());
        config.setBranch(dto.getBranch());
        config.setSection(dto.getSection());
        config.setWeek(dto.getWeek());
        config.setReportFormat(dto.getReportFormat() != null ? dto.getReportFormat() : "html");
        config.setProvider(dto.getProvider() != null ? dto.getProvider() : "all");
        config.setUpdatedBy(teacherEmail);

        EmailAutomationConfig saved = automationConfigRepository.save(config);

        return EmailAutomationDTO.builder()
                .id(saved.getId())
                .enabled(saved.getEnabled())
                .triggerType(saved.getTriggerType())
                .academicYear(saved.getAcademicYear())
                .branch(saved.getBranch())
                .section(saved.getSection())
                .week(saved.getWeek())
                .reportFormat(saved.getReportFormat())
                .provider(saved.getProvider())
                .updatedBy(saved.getUpdatedBy())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    @org.springframework.context.event.EventListener
    public void onFeedbackSaved(com.selva.authportal.event.FeedbackSavedEvent event) {
        checkAndTriggerAutomation(event.studentId(), event.week());
    }

    /**
     * Checks if automated report delivery is triggered for a student and week.
     */
    public void checkAndTriggerAutomation(String studentId, String week) {
        try {
            Optional<EmailAutomationConfig> opt = automationConfigRepository.findFirstByOrderByIdAsc();
            if (opt.isEmpty() || !Boolean.TRUE.equals(opt.get().getEnabled())) {
                return;
            }
            EmailAutomationConfig cfg = opt.get();
            if ("ON_FEEDBACK_SAVED".equalsIgnoreCase(cfg.getTriggerType())) {
                String normalizedWeek = EvaluationService.normalizeWeek(week).displayName();
                if (cfg.getWeek() == null || cfg.getWeek().equalsIgnoreCase("ALL") || normalizedWeek.equalsIgnoreCase(EvaluationService.normalizeWeek(cfg.getWeek()).displayName())) {
                    log.info("Automation triggered: Dispatching report for student {} (week {})", studentId, week);
                    StudentReportEmailRequest req = StudentReportEmailRequest.builder()
                            .studentId(studentId)
                            .week(normalizedWeek)
                            .provider(cfg.getProvider().equalsIgnoreCase("all") ? null : cfg.getProvider())
                            .reportFormat(cfg.getReportFormat())
                            .customMessage("Automated notification: Your evaluation report has been finalized by faculty.")
                            .build();
                    reportEmailService.sendStudentReportEmail(req);
                }
            }
        } catch (Exception e) {
            log.warn("Automated email dispatch failed for student {}: {}", studentId, e.getMessage());
        }
    }

    private EmailBatchResponse mapToBatchResponse(EmailBatch b, boolean includeRecipients) {
        List<EmailBatchRecipientDTO> recDTOs = new ArrayList<>();
        if (includeRecipients) {
            List<EmailBatchRecipient> recs = recipientRepository.findByBatchIdOrderByIdAsc(b.getId());
            for (EmailBatchRecipient r : recs) {
                recDTOs.add(EmailBatchRecipientDTO.builder()
                        .id(r.getId())
                        .studentId(r.getStudentId())
                        .email(r.getEmail())
                        .status(r.getStatus())
                        .messageId(r.getMessageId())
                        .errorMessage(r.getErrorMessage())
                        .sentAt(r.getSentAt())
                        .retryCount(r.getRetryCount())
                        .build());
            }
        }

        return EmailBatchResponse.builder()
                .id(b.getId())
                .academicYear(b.getAcademicYear())
                .branch(b.getBranch())
                .section(b.getSection())
                .week(b.getWeek())
                .subject(b.getSubject())
                .provider(b.getProvider())
                .reportFormat(b.getReportFormat())
                .customMessage(b.getCustomMessage())
                .totalRecipients(b.getTotalRecipients())
                .sentCount(b.getSentCount())
                .failedCount(b.getFailedCount())
                .pendingCount(b.getPendingCount())
                .status(b.getStatus())
                .createdBy(b.getCreatedBy())
                .createdAt(b.getCreatedAt())
                .completedAt(b.getCompletedAt())
                .recipients(recDTOs)
                .build();
    }
}
