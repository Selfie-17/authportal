package com.selva.authportal.service;

import com.selva.authportal.dto.*;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.exception.UserAlreadyExistsException;
import com.selva.authportal.model.*;
import com.selva.authportal.repository.SubmissionRepository;
import com.selva.authportal.repository.SubmissionSpecification;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.repository.UserSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service managing administrative operations (user provisioning, role management,
 * status toggling, submission oversight, and physical deletion).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final StorageService storageService;
    private final PasswordEncoder passwordEncoder;

    /**
     * Lists all system users matching optional search query and role filter.
     */
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers(String query, Role role) {
        return userRepository.findAll(UserSpecification.withFilters(query, role)).stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(UserResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves an individual user by ID.
     */
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        return UserResponse.fromEntity(user);
    }

    /**
     * Creates a new user with an administrator-specified role.
     */
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new UserAlreadyExistsException("An account with email " + normalizedEmail + " already exists.");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = User.builder()
                .name(request.getName().trim())
                .email(normalizedEmail)
                .password(hashedPassword)
                .role(request.getRole())
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        User saved = userRepository.save(user);
        log.info("Admin created new user {} with role {}", normalizedEmail, request.getRole());
        return UserResponse.fromEntity(saved);
    }

    /**
     * Updates a user's system role.
     * Prevents demoting the final remaining administrator in the database.
     */
    @Transactional
    public UserResponse updateUserRole(Long userId, Role newRole, User currentAdmin) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getRole() == Role.ADMIN && newRole != Role.ADMIN) {
            long adminCount = userRepository.countByRole(Role.ADMIN);
            if (adminCount <= 1) {
                throw new InvalidSubmissionException("Cannot change role: this is the final remaining administrator in the system.");
            }
        }

        user.setRole(newRole);
        User updated = userRepository.save(user);
        log.info("Admin {} updated role of user {} to {}", currentAdmin.getEmail(), user.getEmail(), newRole);
        return UserResponse.fromEntity(updated);
    }

    /**
     * Enables or disables a user account.
     * Prevents an administrator from disabling their own account or disabling the final administrator.
     */
    @Transactional
    public UserResponse toggleUserStatus(Long userId, boolean enabled, User currentAdmin) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (user.getId().equals(currentAdmin.getId()) && !enabled) {
            throw new InvalidSubmissionException("Administrators cannot disable their own active account.");
        }

        if (user.getRole() == Role.ADMIN && !enabled) {
            long adminCount = userRepository.countByRole(Role.ADMIN);
            if (adminCount <= 1) {
                throw new InvalidSubmissionException("Cannot disable the final remaining administrator in the system.");
            }
        }

        user.setEnabled(enabled);
        User updated = userRepository.save(user);
        log.info("Admin {} changed enabled status of user {} to {}", currentAdmin.getEmail(), user.getEmail(), enabled);
        return UserResponse.fromEntity(updated);
    }

    /**
     * Fetches all submissions across all students with optional filters for admin oversight.
     */
    @Transactional(readOnly = true)
    public List<SubmissionResponse> getAllSubmissions(Integer week, YearLevel year, Integer section, String studentId) {
        return submissionRepository.findAll(SubmissionSpecification.withFilters(week, year, section, studentId)).stream()
                .sorted(Comparator.comparing(Submission::getCreatedAt).reversed())
                .map(SubmissionResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Deletes a submission from the database and cleans up its physical directory on disk.
     */
    @Transactional
    public void deleteSubmission(Long submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found with id: " + submissionId));

        // Clean up files on disk
        try {
            Path submissionDir = storageService.resolveSubmissionDirectory(
                    submission.getWeek(),
                    submission.getSection(),
                    submission.getStudentId()
            );
            storageService.deleteDirectoryContents(submissionDir);
            Files.deleteIfExists(submissionDir);
        } catch (IOException e) {
            log.warn("Failed to clean up submission directory for id {}: {}", submissionId, e.getMessage());
        }

        submissionRepository.delete(submission);
        log.info("Deleted submission id {} for student {}", submissionId, submission.getStudentId());
    }

    /**
     * Aggregates key system metrics for the administrative dashboard.
     */
    @Transactional(readOnly = true)
    public AdminStatsResponse getSystemStats() {
        return AdminStatsResponse.builder()
                .totalUsers(userRepository.count())
                .studentCount(userRepository.countByRole(Role.STUDENT))
                .teacherCount(userRepository.countByRole(Role.TEACHER))
                .adminCount(userRepository.countByRole(Role.ADMIN))
                .totalSubmissions(submissionRepository.count())
                .build();
    }
}
