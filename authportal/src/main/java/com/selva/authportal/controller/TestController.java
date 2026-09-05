package com.selva.authportal.controller;

import com.selva.authportal.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller exposing role-based protected test endpoints.
 */
@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/authenticated")
    public ResponseEntity<ApiResponse> authenticatedAccess(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Authenticated access granted for: " + userDetails.getUsername())
                .build());
    }

    @GetMapping("/student")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse> studentOnlyAccess(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Student access verified for: " + userDetails.getUsername())
                .build());
    }

    @GetMapping("/teacher")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<ApiResponse> teacherOnlyAccess(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Teacher access verified for: " + userDetails.getUsername())
                .build());
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> adminOnlyAccess(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Admin access verified for: " + userDetails.getUsername())
                .build());
    }
}
