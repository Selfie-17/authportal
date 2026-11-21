package com.selva.authportal.service;

import com.selva.authportal.dto.ChangePasswordRequest;
import com.selva.authportal.dto.UpdateProfileRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.InvalidCredentialsException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.UserCacheService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private ProfileDatabaseLookupService profileDatabaseLookupService;

    @Mock
    private UserCacheService userCacheService;

    private ProfileService profileService;

    private User localUser;
    private User googleUser;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(userRepository, passwordEncoder, profileDatabaseLookupService, userCacheService);

        localUser = User.builder()
                .id(1L)
                .name("Local Student")
                .email("n210001@rguktn.ac.in")
                .password("encodedOldPassword")
                .role(Role.STUDENT)
                .branch("CSE")
                .academicYear("E3")
                .section("Section A")
                .authProvider(AuthProvider.LOCAL)
                .profilePicture("https://example.com/avatar.png")
                .enabled(true)
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .build();

        googleUser = User.builder()
                .id(2L)
                .name("Google Student")
                .email("n210002@rguktn.ac.in")
                .password(null)
                .role(Role.STUDENT)
                .authProvider(AuthProvider.GOOGLE)
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("1. Memory-only mapping path returns profile without DB interaction")
    void shouldReturnProfileFromInMemoryUser() {
        UserResponse response = profileService.getProfile(localUser);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getName()).isEqualTo("Local Student");
        assertThat(response.getEmail()).isEqualTo("n210001@rguktn.ac.in");
        assertThat(response.getRole()).isEqualTo(Role.STUDENT);
        assertThat(response.getBranch()).isEqualTo("CSE");
        assertThat(response.getAcademicYear()).isEqualTo("E3");
        assertThat(response.getSection()).isEqualTo("Section A");
        assertThat(response.getAuthProvider()).isEqualTo(AuthProvider.LOCAL);
        assertThat(response.getProfilePicture()).isEqualTo("https://example.com/avatar.png");
        assertThat(response.isEnabled()).isTrue();
        assertThat(response.getCreatedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));

        // Verify zero database fallback or repository calls
        verifyNoInteractions(profileDatabaseLookupService);
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("2. ProfileService.getProfile is transaction-free (no @Transactional on method or class)")
    void shouldVerifyGetProfileMethodIsNotTransactional() throws NoSuchMethodException {
        // Assert ProfileService class itself does NOT declare @Transactional
        assertThat(ProfileService.class.isAnnotationPresent(Transactional.class)).isFalse();

        // Assert getProfile method does NOT declare @Transactional
        Method getProfileMethod = ProfileService.class.getMethod("getProfile", User.class);
        assertThat(getProfileMethod.isAnnotationPresent(Transactional.class)).isFalse();

        // Execute in-memory path and verify no active transaction
        UserResponse response = profileService.getProfile(localUser);
        assertThat(response).isNotNull();
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();

        verifyNoInteractions(profileDatabaseLookupService);
    }

    @Test
    @DisplayName("3. Incomplete user falls back to transactional database lookup")
    void shouldFallbackToDatabaseWhenUserIsIncomplete() {
        User incompleteUser = User.builder()
                .id(1L)
                .name("Incomplete")
                .email(null) // missing email triggers fallback
                .build();

        when(profileDatabaseLookupService.fetchUserById(1L)).thenReturn(localUser);

        UserResponse response = profileService.getProfile(incompleteUser);

        assertThat(response).isNotNull();
        assertThat(response.getEmail()).isEqualTo("n210001@rguktn.ac.in");
        assertThat(response.getName()).isEqualTo("Local Student");

        verify(profileDatabaseLookupService, times(1)).fetchUserById(1L);
    }

    @Test
    @DisplayName("4. ProfileDatabaseLookupService declares @Transactional(readOnly = true)")
    void shouldVerifyFallbackMethodIsTransactionalReadOnly() throws NoSuchMethodException {
        Method fetchMethod = ProfileDatabaseLookupService.class.getMethod("fetchUserById", Long.class);
        Transactional tx = fetchMethod.getAnnotation(Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.readOnly()).isTrue();
    }

    @Test
    @DisplayName("5. Missing or null user throws ResourceNotFoundException")
    void shouldThrowWhenUserOrIdIsNull() {
        assertThatThrownBy(() -> profileService.getProfile(null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with id: null");

        User userWithoutId = User.builder().name("No ID").email("no-id@rguktn.ac.in").build();
        assertThatThrownBy(() -> profileService.getProfile(userWithoutId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with id: null");

        verifyNoInteractions(profileDatabaseLookupService);
    }

    @Test
    @DisplayName("6. ProfileDatabaseLookupService directly handles nonexistent users")
    void shouldHandleNonexistentUserInFallbackService() {
        ProfileDatabaseLookupService directService = new ProfileDatabaseLookupService(userRepository);
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> directService.fetchUserById(999L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with id: 999");

        assertThatThrownBy(() -> directService.fetchUserById(null))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with id: null");
    }

    @Test
    @DisplayName("7. Should update user profile name, avatar, branch, academicYear, and section")
    void shouldUpdateProfile() {
        UpdateProfileRequest request = UpdateProfileRequest.builder()
                .name("Updated Name")
                .profilePicture("https://example.com/avatar.png")
                .branch("CSE")
                .academicYear("E1")
                .section("Section 1")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = profileService.updateProfile(localUser, request);

        assertThat(response.getName()).isEqualTo("Updated Name");
        assertThat(response.getProfilePicture()).isEqualTo("https://example.com/avatar.png");
        assertThat(response.getBranch()).isEqualTo("CSE");
        assertThat(response.getAcademicYear()).isEqualTo("E1");
        assertThat(response.getSection()).isEqualTo("Section 1");
    }

    @Test
    @DisplayName("8. Should successfully change password for local user")
    void shouldChangePasswordSuccessfully() {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("oldPass123!")
                .newPassword("newPass456!")
                .confirmPassword("newPass456!")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("oldPass123!", "encodedOldPassword")).thenReturn(true);
        when(passwordEncoder.matches("newPass456!", "encodedOldPassword")).thenReturn(false);
        when(passwordEncoder.encode("newPass456!")).thenReturn("encodedNewPassword");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        profileService.changePassword(localUser, request);

        verify(userRepository).save(localUser);
        assertThat(localUser.getPassword()).isEqualTo("encodedNewPassword");
    }

    @Test
    @DisplayName("9. Should reject password change for Google OAuth accounts")
    void shouldRejectPasswordChangeForGoogleUser() {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("any")
                .newPassword("newPass123!")
                .confirmPassword("newPass123!")
                .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(googleUser));

        assertThatThrownBy(() -> profileService.changePassword(googleUser, request))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("accounts authenticated via Google");
    }

    @Test
    @DisplayName("10. Should reject password change when current password is incorrect")
    void shouldRejectIncorrectCurrentPassword() {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("wrongPassword")
                .newPassword("newPass123!")
                .confirmPassword("newPass123!")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("wrongPassword", "encodedOldPassword")).thenReturn(false);

        assertThatThrownBy(() -> profileService.changePassword(localUser, request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Current password does not match");
    }

    @Test
    @DisplayName("11. Should reject password change when new password and confirm do not match")
    void shouldRejectMismatchedConfirmation() {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("oldPass123!")
                .newPassword("newPass123!")
                .confirmPassword("mismatched!")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("oldPass123!", "encodedOldPassword")).thenReturn(true);

        assertThatThrownBy(() -> profileService.changePassword(localUser, request))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("New password and confirmation do not match");
    }

    @Test
    @DisplayName("12. Should reject password change when new password is identical to old password")
    void shouldRejectIdenticalNewPassword() {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("oldPass123!")
                .newPassword("oldPass123!")
                .confirmPassword("oldPass123!")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(passwordEncoder.matches("oldPass123!", "encodedOldPassword")).thenReturn(true);

        assertThatThrownBy(() -> profileService.changePassword(localUser, request))
                .isInstanceOf(InvalidSubmissionException.class)
                .hasMessageContaining("cannot be identical");
    }
}
