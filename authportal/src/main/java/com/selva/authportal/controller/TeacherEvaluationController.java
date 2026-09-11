package com.selva.authportal.controller;

import com.selva.authportal.dto.*;
import com.selva.authportal.service.EvaluationService;
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
     * Uploads and processes an evaluation JSON file (multipart/form-data).
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EvaluationUploadResponse> uploadEvaluationFile(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        EvaluationUploadResponse response = evaluationService.processJsonUpload(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Directly posts an evaluation JSON string (application/json).
     */
    @PostMapping(value = "/upload-json", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<EvaluationUploadResponse> uploadEvaluationJson(
            @RequestBody String jsonContent
    ) throws IOException {
        EvaluationUploadResponse response = evaluationService.processJsonString(jsonContent);
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
     * Fetches the single-student detailed report for a specific Student ID and Week.
     */
    @GetMapping("/report")
    public ResponseEntity<SingleStudentReportResponse> getStudentReport(
            @RequestParam("studentId") String studentId,
            @RequestParam("week") String week
    ) {
        SingleStudentReportResponse report = evaluationService.getStudentReport(studentId, week);
        return ResponseEntity.ok(report);
    }

    /**
     * Streams the student's uploaded PDF lab report for inline browser viewing.
     * Uses the authoritative mapping: Student + Week + Section -> Submission -> SubmissionFile(PDF_REPORT) -> Backblaze B2.
     */
    @GetMapping("/pdf")
    public ResponseEntity<org.springframework.core.io.Resource> getStudentPdf(
            @RequestParam("studentId") String studentId,
            @RequestParam("week") String week
    ) {
        com.selva.authportal.service.SubmissionService.DownloadableFile downloadable = evaluationService.loadStudentPdf(studentId, week);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(downloadable.contentType()))
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + downloadable.filename() + "\"")
                .body(downloadable.resource());
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
     * Deletes a student's evaluation report for a specific week, or all reports if week is not specified.
     */
    @DeleteMapping("/report")
    public ResponseEntity<ApiResponse> deleteStudentReport(
            @RequestParam("studentId") String studentId,
            @RequestParam(value = "week", required = false) String week
    ) {
        if (week != null && !week.trim().isEmpty()) {
            evaluationService.deleteStudentReport(studentId, week);
            return ResponseEntity.ok(ApiResponse.builder()
                    .success(true)
                    .message("Evaluation report for student " + studentId + " (" + week + ") deleted successfully.")
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
