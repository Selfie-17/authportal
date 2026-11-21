package com.selva.authportal.service;

import com.selva.authportal.dto.ChangePasswordRequest;
import com.selva.authportal.dto.UpdateProfileRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.InvalidCredentialsException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.UserCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service managing user profile details and password changes.
 * Enforces security constraints:
 * - Prevents role or email alteration through self-service profile APIs
 * - Strictly forbids local password operations on Google OAuth accounts
 */
@Slf4j
@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private UserCacheService userCacheService;

    public ProfileService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userCacheService = new UserCacheService();
    }

    @Autowired
    public ProfileService(UserRepository userRepository, PasswordEncoder passwordEncoder, UserCacheService userCacheService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.userCacheService = userCacheService != null ? userCacheService : new UserCacheService();
    }

    /**
     * Retrieves current user profile.
     * Uses in-memory user entity directly if already loaded to eliminate redundant remote DB round-trips.
     */
    @Transactional(readOnly = true)
    public UserResponse getProfile(User user) {
        if (user != null && user.getId() != null) {
            return UserResponse.fromEntity(user);
        }
        User fresh = userRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + user.getId()));
        return UserResponse.fromEntity(fresh);
    }

    /**
     * Updates display name and avatar picture.
     * Email and Role remain strictly immutable.
     */
    @Transactional
    public UserResponse updateProfile(User user, UpdateProfileRequest request) {
        User existing = userRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + user.getId()));

        existing.setName(request.getName().trim());
        if (request.getProfilePicture() != null) {
            existing.setProfilePicture(request.getProfilePicture().trim());
        }
        if (request.getBranch() != null) {
            existing.setBranch(request.getBranch().trim());
        }
        if (request.getAcademicYear() != null) {
            existing.setAcademicYear(request.getAcademicYear().trim());
        }
        if (request.getSection() != null) {
            existing.setSection(request.getSection().trim());
        }

        User saved = userRepository.save(existing);
        if (userCacheService != null) {
            userCacheService.evict(saved.getEmail());
        }
        log.info("Profile updated for user: {}", saved.getEmail());
        return UserResponse.fromEntity(saved);
    }

    /**
     * Changes password for local email/password authenticated accounts.
     * Throws an exception if user authenticated via Google OAuth.
     */
    @Transactional
    public void changePassword(User user, ChangePasswordRequest request) {
        User existing = userRepository.findById(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + user.getId()));

        // Google OAuth users cannot perform local password change
        if (existing.getAuthProvider() == AuthProvider.GOOGLE || existing.getPassword() == null) {
            throw new InvalidSubmissionException(
                    "Password cannot be changed for accounts authenticated via Google. Your credentials are managed by Google."
            );
        }

        // Validate current password
        if (!passwordEncoder.matches(request.getCurrentPassword(), existing.getPassword())) {
            throw new InvalidCredentialsException("Current password does not match.");
        }

        // Validate new password confirmation
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new InvalidSubmissionException("New password and confirmation do not match.");
        }

        // Prevent reusing the same password
        if (passwordEncoder.matches(request.getNewPassword(), existing.getPassword())) {
            throw new InvalidSubmissionException("New password cannot be identical to your current password.");
        }

        existing.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(existing);
        if (userCacheService != null) {
            userCacheService.evict(existing.getEmail());
        }
        log.info("Password successfully changed for user: {}", existing.getEmail());
    }
}
