package com.selva.authportal.controller;

import com.selva.authportal.dto.*;
import com.selva.authportal.service.EvaluationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.selva.authportal.web.StreamingFileResponses;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Controller exposing endpoints for Teacher Evaluation Spreadsheet Table,
 * JSON upload processing, detailed student reports, and teacher feedback.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/evaluations")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherEvaluationController {

    private final EvaluationService evaluationService;

    /**
     * Uploads and processes an evaluation JSON file (multipart/form-data) with optional provider.
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvaluationUploadResponse> uploadEvaluationFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "provider", required = false) String provider
    ) throws IOException {
        EvaluationUploadResponse response = evaluationService.processJsonUpload(file, provider);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Directly posts an evaluation JSON string (application/json) with optional provider.
     */
    @PostMapping(value = "/upload-json", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<EvaluationUploadResponse> uploadEvaluationJson(
            @RequestBody String jsonContent,
            @RequestParam(value = "provider", required = false) String provider
    ) throws IOException {
        EvaluationUploadResponse response = evaluationService.processJsonString(jsonContent, provider);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Fetches the dynamic evaluation table grid (all dynamic weeks, all dynamic students, and cells).
     */
    @GetMapping("/grid")
    public ResponseEntity<TeacherEvaluationGridResponse> getEvaluationGrid() {
        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();
        return ResponseEntity.ok(grid);
    }

    /**
     * Fetches the single-student detailed report for a specific Student ID, Week, and optional Provider.
     */
    @GetMapping("/report")
    public ResponseEntity<SingleStudentReportResponse> getStudentReport(
            @RequestParam("studentId") String studentId,
            @RequestParam("week") String week,
            @RequestParam(value = "provider", required = false) String provider
    ) {
        SingleStudentReportResponse report = evaluationService.getStudentReport(studentId, week, provider);
        return ResponseEntity.ok(report);
    }

    /**
     * Streams the student's uploaded PDF lab report for inline browser viewing.
     * Uses the authoritative mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT) -> Backblaze B2.
     */
    @GetMapping("/pdf")
    public ResponseEntity<StreamingResponseBody> getStudentPdf(
            @RequestParam("studentId") String studentId,
            @RequestParam("week") String week
    ) {
        com.selva.authportal.service.SubmissionService.DownloadableFile downloadable = evaluationService.loadStudentPdf(studentId, week);
        return StreamingFileResponses.from(downloadable, false);
    }

    /**
     * Saves or updates teacher feedback (Reviewed: Yes/No, feedback text) for a Student ID and Week.
     */
    @PostMapping("/feedback")
    public ResponseEntity<TeacherFeedbackResponse> saveTeacherFeedback(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody TeacherFeedbackRequest request
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        TeacherFeedbackResponse response = evaluationService.saveFeedback(request, teacherEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Updates the awarded marks/score for a student evaluation report.
     * Accessible by TEACHER and ADMIN roles.
     */
    @PatchMapping("/score")
    public ResponseEntity<SingleStudentReportResponse> updateScore(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ScoreUpdateRequest request
    ) {
        String teacherEmail = (userDetails != null) ? userDetails.getUsername() : "teacher@rguktn.ac.in";
        SingleStudentReportResponse response = evaluationService.updateScore(request, teacherEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * Deletes a student's evaluation report for a specific week (optionally provider-scoped), or all reports if week is not specified.
     */
    @DeleteMapping("/report")
    public ResponseEntity<ApiResponse> deleteStudentReport(
            @RequestParam("studentId") String studentId,
            @RequestParam(value = "week", required = false) String week,
            @RequestParam(value = "provider", required = false) String provider
    ) {
        if (week != null && !week.trim().isEmpty()) {
            evaluationService.deleteStudentReport(studentId, week, provider);
            String msg = "Evaluation report for student " + studentId + " (" + week +
                    (provider != null ? " - " + provider : "") + ") deleted successfully.";
            return ResponseEntity.ok(ApiResponse.builder()
                    .success(true)
                    .message(msg)
                    .build());
        } else {
            evaluationService.deleteAllReportsForStudent(studentId);
            return ResponseEntity.ok(ApiResponse.builder()
                    .success(true)
                    .message("All evaluation reports for student " + studentId + " deleted successfully.")
                    .build());
        }
    }
}
