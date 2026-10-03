package com.selva.authportal.service;

import com.selva.authportal.dto.EmailBatchRecipientDTO;
import com.selva.authportal.dto.ZipReportItemDTO;
import com.selva.authportal.dto.ZipReportsParseResponse;
import com.selva.authportal.dto.ZipReportsSendRequest;
import com.selva.authportal.dto.ZipReportsSendResponse;
import com.selva.authportal.email.EmailAttachment;
import com.selva.authportal.email.EmailSendRequest;
import com.selva.authportal.email.EmailSendResult;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.model.EmailBatch;
import com.selva.authportal.model.EmailBatchRecipient;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.EmailBatchRecipientRepository;
import com.selva.authportal.repository.EmailBatchRepository;
import com.selva.authportal.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Service responsible for analyzing ZIP archives containing evaluated student HTML reports
 * (such as lab_notebook_reports.zip), extracting student IDs, resolving emails,
 * and dispatching them via Gmail SMTP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ZipReportEmailService {

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final EmailReportHtmlTransformer htmlTransformer;
    private final EmailBatchRepository batchRepository;
    private final EmailBatchRecipientRepository recipientRepository;

    private static final Pattern STUDENT_ID_PATTERN = Pattern.compile("([A-Za-z]\\d{6})", Pattern.CASE_INSENSITIVE);
    private static final Pattern TITLE_ID_PATTERN = Pattern.compile("([A-Za-z]\\d{6})", Pattern.CASE_INSENSITIVE);

    /**
     * Represents an in-memory entry extracted from a ZIP file.
     */
    private record ExtractedEntry(String filename, byte[] bytes) {}

    /**
     * Reads all entries from either a MultipartFile or a local filesystem path into memory.
     */
    private List<ExtractedEntry> extractZipEntries(MultipartFile file, String localPath) throws IOException {
        InputStream is = null;
        if (file != null && !file.isEmpty()) {
            is = file.getInputStream();
        } else if (localPath != null && !localPath.isBlank()) {
            File f = new File(localPath.trim());
            if (!f.exists() || !f.isFile()) {
                throw new FileNotFoundException("Local ZIP file not found at path: " + localPath);
            }
            is = new FileInputStream(f);
        } else {
            throw new IllegalArgumentException("No ZIP file provided. Supply an uploaded file or valid local file path.");
        }

        List<ExtractedEntry> entries = new ArrayList<>();
        try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(is))) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                if (ze.isDirectory()) {
                    continue;
                }
                String name = ze.getName();
                // Normalize file path separators to extract plain filename
                if (name.contains("/")) {
                    name = name.substring(name.lastIndexOf('/') + 1);
                }
                if (name.contains("\\")) {
                    name = name.substring(name.lastIndexOf('\\') + 1);
                }
                if (name.isBlank() || name.startsWith(".")) {
                    continue;
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int len;
                while ((len = zis.read(buffer)) > 0) {
                    baos.write(buffer, 0, len);
                }
                entries.add(new ExtractedEntry(name, baos.toByteArray()));
            }
        }
        return entries;
    }

    /**
     * Analyzes an uploaded ZIP archive and extracts all student HTML reports with companion files.
     */
    public ZipReportsParseResponse parseZipReports(MultipartFile file, String localPath) {
        try {
            List<ExtractedEntry> entries = extractZipEntries(file, localPath);
            if (entries.isEmpty()) {
                return ZipReportsParseResponse.builder()
                        .success(false)
                        .totalReports(0)
                        .message("The ZIP archive is empty or contains no valid files.")
                        .build();
            }

            // Group entries: find all HTML reports and map companion files
            Map<String, ExtractedEntry> htmlEntriesByStudentId = new LinkedHashMap<>();
            Map<String, List<String>> companionsByStudentId = new LinkedHashMap<>();

            for (ExtractedEntry entry : entries) {
                String name = entry.filename();
                String lowerName = name.toLowerCase();

                Matcher m = STUDENT_ID_PATTERN.matcher(name);
                String studentId = null;
                if (m.find()) {
                    studentId = m.group(1).toUpperCase();
                }

                if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
                    if (studentId == null) {
                        // Attempt to extract student ID from HTML title or content
                        String text = new String(entry.bytes(), StandardCharsets.UTF_8);
                        Matcher tm = TITLE_ID_PATTERN.matcher(text);
                        if (tm.find()) {
                            studentId = tm.group(1).toUpperCase();
                        } else {
                            studentId = "UNKNOWN_" + Math.abs(name.hashCode());
                        }
                    }
                    htmlEntriesByStudentId.put(studentId, entry);
                } else if (studentId != null) {
                    // Companion file (e.g. N240035_analysis.json)
                    companionsByStudentId.computeIfAbsent(studentId, k -> new ArrayList<>()).add(name);
                }
            }

            if (htmlEntriesByStudentId.isEmpty()) {
                return ZipReportsParseResponse.builder()
                        .success(false)
                        .totalReports(0)
                        .message("No HTML evaluation reports were found in the uploaded ZIP file.")
                        .build();
            }

            List<ZipReportItemDTO> reportList = new ArrayList<>();
            for (Map.Entry<String, ExtractedEntry> mapEntry : htmlEntriesByStudentId.entrySet()) {
                String studentId = mapEntry.getKey();
                ExtractedEntry entry = mapEntry.getValue();
                String htmlText = new String(entry.bytes(), StandardCharsets.UTF_8);

                String email = resolveStudentEmail(studentId);
                String studentName = resolveStudentName(studentId, email);

                List<String> companions = companionsByStudentId.getOrDefault(studentId, Collections.emptyList());

                reportList.add(ZipReportItemDTO.builder()
                        .studentId(studentId)
                        .email(email)
                        .studentName(studentName)
                        .htmlFileName(entry.filename())
                        .htmlSize(entry.bytes().length)
                        .htmlContent(htmlText)
                        .companionFiles(companions)
                        .build());
            }

            // Sort reportList by student ID
            reportList.sort(Comparator.comparing(ZipReportItemDTO::getStudentId));

            String sourceName = (file != null && !file.isEmpty()) ? file.getOriginalFilename() : localPath;

            return ZipReportsParseResponse.builder()
                    .success(true)
                    .totalReports(reportList.size())
                    .reports(reportList)
                    .sourceName(sourceName)
                    .detectedWeek("Week 4")
                    .detectedYear("E2")
                    .detectedSection("1")
                    .message("Successfully analyzed ZIP archive. Detected " + reportList.size() + " HTML evaluation reports.")
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse ZIP reports: {}", e.getMessage(), e);
            return ZipReportsParseResponse.builder()
                    .success(false)
                    .totalReports(0)
                    .errorMessage("Failed to analyze ZIP archive: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Dispatches HTML reports extracted from a ZIP archive.
     * Supports both real student delivery and safe testing mode (targetOverrideEmail).
     */
    @Transactional
    public ZipReportsSendResponse sendZipReports(
            ZipReportsSendRequest request,
            MultipartFile file,
            String localPath,
            String senderUsername
    ) {
        try {
            List<ExtractedEntry> entries = extractZipEntries(file, localPath != null ? localPath : request.getSourceFilePath());
            if (entries.isEmpty()) {
                throw new IllegalArgumentException("The ZIP archive is empty or could not be read.");
            }

            // Group entries into HTML files and companions
            Map<String, ExtractedEntry> htmlEntries = new LinkedHashMap<>();
            Map<String, List<ExtractedEntry>> companions = new LinkedHashMap<>();

            for (ExtractedEntry entry : entries) {
                String name = entry.filename();
                String lowerName = name.toLowerCase();

                Matcher m = STUDENT_ID_PATTERN.matcher(name);
                String studentId = null;
                if (m.find()) {
                    studentId = m.group(1).toUpperCase();
                }

                if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) {
                    if (studentId == null) {
                        String text = new String(entry.bytes(), StandardCharsets.UTF_8);
                        Matcher tm = TITLE_ID_PATTERN.matcher(text);
                        if (tm.find()) {
                            studentId = tm.group(1).toUpperCase();
                        } else {
                            studentId = "UNKNOWN_" + Math.abs(name.hashCode());
                        }
                    }
                    htmlEntries.put(studentId, entry);
                } else if (studentId != null) {
                    companions.computeIfAbsent(studentId, k -> new ArrayList<>()).add(entry);
                }
            }

            // Filter if selectedStudentIds is provided
            Set<String> selectedFilter = (request.getSelectedStudentIds() != null && !request.getSelectedStudentIds().isEmpty())
                    ? new HashSet<>(request.getSelectedStudentIds())
                    : null;

            List<String> targetStudentIds = new ArrayList<>();
            for (String sId : htmlEntries.keySet()) {
                if (selectedFilter == null || selectedFilter.contains(sId)) {
                    targetStudentIds.add(sId);
                }
            }

            if (targetStudentIds.isEmpty()) {
                throw new IllegalArgumentException("No matching student reports selected for transmission.");
            }

            boolean isTestMode = request.getTargetOverrideEmail() != null && !request.getTargetOverrideEmail().trim().isEmpty();
            String testEmail = isTestMode ? request.getTargetOverrideEmail().trim() : null;

            String weekDisplay = (request.getWeek() != null && !request.getWeek().isBlank())
                    ? (request.getWeek().toLowerCase().startsWith("week") ? request.getWeek() : "Week " + request.getWeek())
                    : "Lab Evaluation";

            // Create Batch Entity in Database for audit and tracking
            EmailBatch batch = EmailBatch.builder()
                    .subject("ZIP HTML Reports - " + weekDisplay + (isTestMode ? " [TEST: " + testEmail + "]" : ""))
                    .week(request.getWeek() != null ? request.getWeek() : "Week 4")
                    .academicYear(request.getYear() != null ? request.getYear() : "E2")
                    .section(request.getSection() != null ? request.getSection() : "1")
                    .reportFormat("html")
                    .customMessage(request.getFacultyMessage())
                    .totalRecipients(targetStudentIds.size())
                    .sentCount(0)
                    .failedCount(0)
                    .pendingCount(targetStudentIds.size())
                    .status("IN_PROGRESS")
                    .createdBy(senderUsername != null ? senderUsername : "SYSTEM")
                    .createdAt(Instant.now())
                    .build();

            batch = batchRepository.save(batch);

            List<EmailBatchRecipient> batchRecipients = new ArrayList<>();
            List<EmailBatchRecipientDTO> resultDTOs = new ArrayList<>();
            int successCount = 0;
            int failedCount = 0;

            for (String studentId : targetStudentIds) {
                ExtractedEntry htmlEntry = htmlEntries.get(studentId);
                String rawHtml = new String(htmlEntry.bytes(), StandardCharsets.UTF_8);

                String destinationEmail = isTestMode ? testEmail : resolveStudentEmail(studentId);

                // Build subject
                String subject;
                if (isTestMode) {
                    subject = "[TEST REPORT - " + studentId + "] " + weekDisplay + " Evaluation Report";
                } else {
                    subject = "RGUKT Academic Portal - " + weekDisplay + " Evaluation Report (" + studentId + ")";
                }

                // Transform HTML report for email compatibility with faculty message banner
                String emailBody = htmlTransformer.transformToEmailSafeHtml(rawHtml, request.getFacultyMessage());

                // Build attachments: original HTML + companion JSONs
                List<EmailAttachment> attachments = new ArrayList<>();
                attachments.add(EmailAttachment.builder()
                        .name(htmlEntry.filename())
                        .content(htmlEntry.bytes())
                        .contentType("text/html; charset=UTF-8")
                        .build());

                List<ExtractedEntry> compList = companions.getOrDefault(studentId, Collections.emptyList());
                for (ExtractedEntry comp : compList) {
                    attachments.add(EmailAttachment.builder()
                            .name(comp.filename())
                            .content(comp.bytes())
                            .contentType("application/json; charset=UTF-8")
                            .build());
                }

                EmailSendRequest sendReq = EmailSendRequest.builder()
                        .to(destinationEmail)
                        .subject(subject)
                        .body(emailBody)
                        .html(true)
                        .attachments(attachments)
                        .build();

                EmailSendResult sendResult = emailService.sendEmail(sendReq);

                String status = sendResult.isSuccess() ? "SENT" : "FAILED";
                if (sendResult.isSuccess()) {
                    successCount++;
                } else {
                    failedCount++;
                }

                EmailBatchRecipient recipientRecord = EmailBatchRecipient.builder()
                        .batch(batch)
                        .studentId(studentId)
                        .email(destinationEmail)
                        .status(status)
                        .messageId(sendResult.getMessageId())
                        .errorMessage(sendResult.getErrorMessage())
                        .sentAt(Instant.now())
                        .retryCount(0)
                        .build();

                batchRecipients.add(recipientRecord);

                resultDTOs.add(EmailBatchRecipientDTO.builder()
                        .studentId(studentId)
                        .email(destinationEmail)
                        .status(status)
                        .messageId(sendResult.getMessageId())
                        .errorMessage(sendResult.getErrorMessage())
                        .sentAt(Instant.now())
                        .retryCount(0)
                        .build());
            }

            recipientRepository.saveAll(batchRecipients);

            batch.setSentCount(successCount);
            batch.setFailedCount(failedCount);
            batch.setPendingCount(0);
            batch.setStatus(failedCount == 0 ? "COMPLETED" : (successCount > 0 ? "PARTIALLY_FAILED" : "FAILED"));
            batch.setCompletedAt(Instant.now());
            batchRepository.save(batch);

            String summaryMessage = isTestMode
                    ? String.format("Test dispatch complete: %d report(s) sent to %s (%d successful, %d failed).",
                    targetStudentIds.size(), testEmail, successCount, failedCount)
                    : String.format("Report distribution complete: %d of %d emails sent successfully via Gmail SMTP.",
                    successCount, targetStudentIds.size());

            return ZipReportsSendResponse.builder()
                    .success(successCount > 0)
                    .batchId(batch.getId())
                    .totalProcessed(targetStudentIds.size())
                    .successfulCount(successCount)
                    .failedCount(failedCount)
                    .targetOverrideEmail(testEmail)
                    .results(resultDTOs)
                    .message(summaryMessage)
                    .build();

        } catch (Exception e) {
            log.error("Failed to execute ZIP reports dispatch: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to send ZIP reports: " + e.getMessage(), e);
        }
    }

    /**
     * Resolves student email from database User record or standard RGUKT institutional pattern.
     */
    public String resolveStudentEmail(String studentId) {
        if (studentId == null || studentId.isBlank()) {
            return "student@rguktn.ac.in";
        }
        String cleanId = studentId.trim().toLowerCase();
        return userRepository.findByEmail(cleanId + "@rguktn.ac.in")
                .map(User::getEmail)
                .orElse(cleanId + "@rguktn.ac.in");
    }

    /**
     * Resolves student display name from database User record if available.
     */
    public String resolveStudentName(String studentId, String email) {
        Optional<User> uOpt = userRepository.findByEmail(email);
        if (uOpt.isPresent() && uOpt.get().getName() != null && !uOpt.get().getName().isBlank()) {
            return uOpt.get().getName();
        }
        return studentId.toUpperCase();
    }
}
