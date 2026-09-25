package com.selva.authportal.service;

import com.selva.authportal.dto.AdminStatsResponse;
import com.selva.authportal.dto.CreateUserRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.UserAlreadyExistsException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.Submission;
import com.selva.authportal.model.User;
import com.selva.authportal.dto.TeacherFeedbackResponse;
import com.selva.authportal.model.TeacherFeedback;
import com.selva.authportal.repository.SubmissionRepository;
import com.selva.authportal.repository.TeacherFeedbackRepository;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SubmissionRepository submissionRepository;

    @Mock
    private TeacherFeedbackRepository feedbackRepository;

    @Mock
    private StorageService storageService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AdminService adminService;

    private User adminUser;
    private User studentUser;

    @BeforeEach
    void setUp() {
        adminService = new AdminService(userRepository, submissionRepository, feedbackRepository, storageService, passwordEncoder);

        adminUser = User.builder()
                .id(1L)
                .name("Admin User")
                .email("admin@rguktn.ac.in")
                .role(Role.ADMIN)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        studentUser = User.builder()
                .id(2L)
                .name("Student User")
                .email("n210001@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("Should create user with admin-specified role and hashed password")
    void shouldCreateUser() {
        CreateUserRequest request = CreateUserRequest.builder()
                .name("New Teacher")
                .email("faculty@rguktn.ac.in")
                .password("Secr3tP@ssword")
                .role(Role.TEACHER)
                .build();

        when(userRepository.existsByEmail("faculty@rguktn.ac.in")).thenReturn(false);
        when(passwordEncoder.encode("Secr3tP@ssword")).thenReturn("hashedPass");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(5L);
            return u;
        });

        UserResponse response = adminService.createUser(request);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(5L);
        assertThat(response.getRole()).isEqualTo(Role.TEACHER);
        assertThat(response.getEmail()).isEqualTo("faculty@rguktn.ac.in");
    }

    @Test
    @DisplayName("Should reject user creation if email already exists")
    void shouldRejectDuplicateUserCreation() {
        CreateUserRequest request = CreateUserRequest.builder()
                .name("Student")
                .email("n210001@rguktn.ac.in")
                .password("Password123!")
                .role(Role.STUDENT)
                .build();

        when(userRepository.existsByEmail("n210001@rguktn.ac.in")).thenReturn(true);

        assertThatThrownBy(() -> adminService.createUser(request))
                .isInstanceOf(UserAlreadyExistsException.class);
    }

    @Test
    @DisplayName("Should update user role successfully")
    void shouldUpdateUserRole() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(studentUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse updated = adminService.updateUserRole(2L, Role.TEACHER, adminUser);

        assertThat(updated.getRole()).isEqualTo(Role.TEACHER);
    }

    @Test
    @DisplayName("Should prevent demoting the final administrator in the system")
    void shouldPreventDemotingLastAdmin() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> adminService.updateUserRole(1L, Role.STUDENT, adminUser))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("final remaining administrator");
    }

    @Test
    @DisplayName("Should prevent administrator from disabling own account")
    void shouldPreventAdminFromDisablingSelf() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(adminUser));

        assertThatThrownBy(() -> adminService.toggleUserStatus(1L, false, adminUser))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("Administrators cannot disable their own active account");
    }

    @TempDir
    Path tempDir;

    @Test
    @DisplayName("Should delete submission and clean up storage")
    void shouldDeleteSubmission() throws IOException {
        Submission sub = Submission.builder()
                .id(10L)
                .studentId("N210001")
                .week(1)
                .section(2)
                .storagePath("submissions/week-1/sec-2/N210001")
                .build();

        when(submissionRepository.findById(10L)).thenReturn(Optional.of(sub));

        adminService.deleteSubmission(10L);

        verify(storageService).deletePrefix("submissions/week-1/sec-2/N210001");
        verify(submissionRepository).delete(sub);
    }


    @Test
    @DisplayName("Should return system stats aggregated correctly")
    void shouldReturnSystemStats() {
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByRole(Role.STUDENT)).thenReturn(85L);
        when(userRepository.countByRole(Role.TEACHER)).thenReturn(12L);
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(3L);
        when(submissionRepository.count()).thenReturn(450L);
        when(feedbackRepository.count()).thenReturn(42L);

        AdminStatsResponse stats = adminService.getSystemStats();

        assertThat(stats.getTotalUsers()).isEqualTo(100L);
        assertThat(stats.getStudentCount()).isEqualTo(85L);
        assertThat(stats.getTeacherCount()).isEqualTo(12L);
        assertThat(stats.getAdminCount()).isEqualTo(3L);
        assertThat(stats.getTotalSubmissions()).isEqualTo(450L);
        assertThat(stats.getTotalFeedbacks()).isEqualTo(42L);
    }

    @Test
    @DisplayName("Should return all feedbacks with optional filters")
    void shouldReturnAllFeedbacksWithFilters() {
        TeacherFeedback fb1 = TeacherFeedback.builder()
                .id(1L)
                .studentId("N210001")
                .week("Week 1")
                .reviewed(true)
                .feedbackText("Excellent implementation")
                .teacherEmail("faculty@rguktn.ac.in")
                .updatedAt(java.time.Instant.now())
                .build();

        TeacherFeedback fb2 = TeacherFeedback.builder()
                .id(2L)
                .studentId("R210002")
                .week("Week 2")
                .reviewed(false)
                .feedbackText("Incomplete code")
                .teacherEmail("dean@rguktrkv.ac.in")
                .updatedAt(java.time.Instant.now())
                .build();

        when(feedbackRepository.findAll()).thenReturn(List.of(fb1, fb2));

        // Unfiltered
        List<TeacherFeedbackResponse> all = adminService.getAllFeedbacks(null, null, null, null, null);
        assertThat(all).hasSize(2);

        // Filter by studentId
        List<TeacherFeedbackResponse> filteredStudent = adminService.getAllFeedbacks("n210001", null, null, null, null);
        assertThat(filteredStudent).hasSize(1);
        assertThat(filteredStudent.get(0).getStudentId()).isEqualTo("N210001");

        // Filter by reviewed
        List<TeacherFeedbackResponse> filteredReviewed = adminService.getAllFeedbacks(null, null, null, true, null);
        assertThat(filteredReviewed).hasSize(1);
        assertThat(filteredReviewed.get(0).isReviewed()).isTrue();

        // Search query
        List<TeacherFeedbackResponse> searched = adminService.getAllFeedbacks(null, null, null, null, "excellent");
        assertThat(searched).hasSize(1);
        assertThat(searched.get(0).getFeedbackText()).contains("Excellent");
    }

    @Test
    @DisplayName("Should delete feedback successfully")
    void shouldDeleteFeedback() {
        TeacherFeedback fb = TeacherFeedback.builder()
                .id(10L)
                .studentId("N210001")
                .week("Week 1")
                .build();

        when(feedbackRepository.findById(10L)).thenReturn(Optional.of(fb));

        adminService.deleteFeedback(10L);

        verify(feedbackRepository).delete(fb);
    }
}
