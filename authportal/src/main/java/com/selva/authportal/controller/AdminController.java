package com.selva.authportal.controller;

import com.selva.authportal.dto.*;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.model.YearLevel;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller exposing role-protected administrative endpoints.
 * Requires ROLE_ADMIN authority for all operations.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final UserRepository userRepository;

    /**
     * Aggregates metrics and counts for the admin dashboard.
     */
    @GetMapping("/stats")
    public ResponseEntity<AdminStatsResponse> getStats() {
        AdminStatsResponse stats = adminService.getSystemStats();
        return ResponseEntity.ok(stats);
    }

    /**
     * Lists system users with optional search query and role filter.
     */
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> listUsers(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "role", required = false) Role role
    ) {
        List<UserResponse> users = adminService.getAllUsers(query, role);
        return ResponseEntity.ok(users);
    }

    /**
     * Retrieves an individual user's profile.
     */
    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable("id") Long id) {
        UserResponse user = adminService.getUserById(id);
        return ResponseEntity.ok(user);
    }

    /**
     * Provisions a new user directly with an administrative role assignment.
     */
    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse created = adminService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Updates a user's role. Protects against demoting the final administrator.
     */
    @PatchMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateUserRole(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateRoleRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User currentAdmin = resolveCurrentUser(userDetails);
        UserResponse updated = adminService.updateUserRole(id, request.getRole(), currentAdmin);
        return ResponseEntity.ok(updated);
    }

    /**
     * Enables or disables a user account.
     */
    @PatchMapping("/users/{id}/status")
    public ResponseEntity<UserResponse> updateUserStatus(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateUserStatusRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User currentAdmin = resolveCurrentUser(userDetails);
        UserResponse updated = adminService.toggleUserStatus(id, request.getEnabled(), currentAdmin);
        return ResponseEntity.ok(updated);
    }

    /**
     * Lists all submissions across the portal with optional filters.
     */
    @GetMapping("/submissions")
    public ResponseEntity<List<SubmissionResponse>> listSubmissions(
            @RequestParam(value = "week", required = false) Integer week,
            @RequestParam(value = "year", required = false) YearLevel year,
            @RequestParam(value = "section", required = false) Integer section,
            @RequestParam(value = "studentId", required = false) String studentId
    ) {
        List<SubmissionResponse> submissions = adminService.getAllSubmissions(week, year, section, studentId);
        return ResponseEntity.ok(submissions);
    }

    /**
     * Deletes a submission record and purges its stored files on disk.
     */
    @DeleteMapping("/submissions/{id}")
    public ResponseEntity<ApiResponse> deleteSubmission(@PathVariable("id") Long id) {
        adminService.deleteSubmission(id);
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Submission deleted successfully.")
                .build());
    }

    private User resolveCurrentUser(UserDetails userDetails) {
        if (userDetails instanceof CustomUserDetails customUserDetails) {
            return customUserDetails.getUser();
        }
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userDetails.getUsername()));
    }
}
