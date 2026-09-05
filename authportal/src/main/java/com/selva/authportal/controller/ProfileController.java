package com.selva.authportal.controller;

import com.selva.authportal.dto.ApiResponse;
import com.selva.authportal.dto.ChangePasswordRequest;
import com.selva.authportal.dto.UpdateProfileRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Controller exposing self-service user profile operations and credential management.
 */
@Slf4j
@RestController
@RequestMapping("/api/profile")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;
    private final UserRepository userRepository;

    /**
     * Returns the authenticated user's profile details.
     */
    @GetMapping
    public ResponseEntity<UserResponse> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveCurrentUser(userDetails);
        UserResponse response = profileService.getProfile(user);
        return ResponseEntity.ok(response);
    }

    /**
     * Updates editable profile attributes (e.g. display name).
     */
    @PatchMapping
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        User user = resolveCurrentUser(userDetails);
        UserResponse response = profileService.updateProfile(user, request);
        return ResponseEntity.ok(response);
    }

    /**
     * Changes password for local accounts.
     */
    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        User user = resolveCurrentUser(userDetails);
        profileService.changePassword(user, request);
        return ResponseEntity.ok(ApiResponse.builder()
                .success(true)
                .message("Password changed successfully.")
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
