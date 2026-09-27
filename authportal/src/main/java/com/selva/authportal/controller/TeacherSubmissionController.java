package com.selva.authportal.controller;

import com.selva.authportal.dto.TeacherSubmissionPageResponse;
import com.selva.authportal.service.SubmissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing paginated student submissions combined with PDF details
 * and teacher review feedback for teacher and administrator review consoles.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class TeacherSubmissionController {

    private final SubmissionService submissionService;

    /**
     * Paginated endpoint returning student submissions, PDF file metadata,
     * and human teacher feedback logs.
     * Default page = 0, size = 20.
     */
    @GetMapping("/submissions-page")
    public ResponseEntity<TeacherSubmissionPageResponse> getSubmissionsPage(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "week", required = false) String week,
            @RequestParam(value = "search", required = false) String search
    ) {
        TeacherSubmissionPageResponse response = submissionService.getPaginatedSubmissions(page, size, week, search);
        return ResponseEntity.ok(response);
    }
}
