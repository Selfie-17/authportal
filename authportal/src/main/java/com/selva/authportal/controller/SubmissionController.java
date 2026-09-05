package com.selva.authportal.controller;

import com.selva.authportal.dto.SubmissionRequest;
import com.selva.authportal.dto.SubmissionResponse;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.SubmissionService;
import com.selva.authportal.service.ZipArchiveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.util.List;
import java.util.Map;

/**
 * Controller exposing student submission endpoints and secure file downloads.
 */
@Slf4j
@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;
    private final ZipArchiveService zipArchiveService;
    private final UserRepository userRepository;

    /**
     * Pre-populates the editable student ID from the authenticated user's institutional email.
     * Example: n210001@rguktn.ac.in -> N210001
     */
    @GetMapping("/default-student-id")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<Map<String, String>> getDefaultStudentId(@AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = resolveCurrentUser(userDetails);
        String defaultId = submissionService.deriveDefaultStudentId(currentUser.getEmail());
        return ResponseEntity.ok(Map.of("studentId", defaultId));
    }

    /**
     * Uploads an assignment submission containing one or more .c files and PDF report(s).
     * Binds the submission strictly to the authenticated User entity.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<SubmissionResponse> submitAssignment(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @ModelAttribute SubmissionRequest request,
            @RequestParam("files") List<MultipartFile> files
    ) {
        User currentUser = resolveCurrentUser(userDetails);
        SubmissionResponse response = submissionService.submitAssignment(currentUser, request, files);
        HttpStatus status = (response.getVersion() == 1) ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(response);
    }

    /**
     * Lists all submissions made by the currently authenticated student.
     */
    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<List<SubmissionResponse>> getMySubmissions(@AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = resolveCurrentUser(userDetails);
        List<SubmissionResponse> responses = submissionService.getMySubmissions(currentUser.getId());
        return ResponseEntity.ok(responses);
    }

    /**
     * Fetches details of a specific submission owned by the student.
     */
    @GetMapping("/my/{id}")
    @PreAuthorize("hasAnyRole('STUDENT', 'ADMIN')")
    public ResponseEntity<SubmissionResponse> getMySubmission(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable("id") Long id
    ) {
        User currentUser = resolveCurrentUser(userDetails);
        SubmissionResponse response = submissionService.getMySubmissionById(currentUser.getId(), id);
        return ResponseEntity.ok(response);
    }

    /**
     * Downloads an individual file from a submission.
     * Access is restricted to the owning student, or any authorized teacher / admin.
     */
    @GetMapping("/{submissionId}/files/{fileId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> downloadFile(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable("submissionId") Long submissionId,
            @PathVariable("fileId") Long fileId
    ) throws MalformedURLException {
        User currentUser = resolveCurrentUser(userDetails);
        SubmissionService.DownloadableFile downloadable = submissionService.loadFileForDownload(
                currentUser, submissionId, fileId
        );

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(downloadable.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + downloadable.filename() + "\"")
                .body(downloadable.resource());
    }

    /**
     * Teacher endpoint: Search & filter lab submissions across Week (1–12), Year (E1–E4), Section (1–6), and Student ID.
     */
    @GetMapping("/teacher")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<SubmissionResponse>> filterTeacherSubmissions(
            @RequestParam(value = "week", required = false) Integer week,
            @RequestParam(value = "year", required = false) com.selva.authportal.model.YearLevel year,
            @RequestParam(value = "section", required = false) Integer section,
            @RequestParam(value = "studentId", required = false) String studentId
    ) {
        List<SubmissionResponse> responses = submissionService.filterSubmissionsForTeacher(week, year, section, studentId);
        return ResponseEntity.ok(responses);
    }

    /**
     * Teacher endpoint: Batch downloads submissions for a Week/Section as a structured ZIP archive.
     * Preserves directory hierarchy: week-{w}-sec-{s}/{studentId}/[files]
     */
    @GetMapping("/teacher/download-zip")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> downloadSubmissionsZip(
            @RequestParam("week") Integer week,
            @RequestParam(value = "year", required = false) com.selva.authportal.model.YearLevel year,
            @RequestParam(value = "section", required = false) Integer section
    ) {
        List<com.selva.authportal.model.Submission> submissions = submissionService.getSubmissionsForZip(week, year, section);
        String zipFilename = zipArchiveService.getArchiveFilename(week, section);

        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody responseBody = outputStream -> {
            zipArchiveService.generateSubmissionsZip(submissions, week, section, outputStream);
        };

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + zipFilename + "\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(responseBody);
    }


    private User resolveCurrentUser(UserDetails userDetails) {
        if (userDetails instanceof CustomUserDetails customUserDetails) {
            return customUserDetails.getUser();
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userDetails.getUsername()));
    }
}
