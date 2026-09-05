package com.selva.authportal.service;

import com.selva.authportal.dto.ChangePasswordRequest;
import com.selva.authportal.dto.UpdateProfileRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.InvalidCredentialsException;
import com.selva.authportal.exception.InvalidSubmissionException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

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

    private ProfileService profileService;

    private User localUser;
    private User googleUser;

    @BeforeEach
    void setUp() {
        profileService = new ProfileService(userRepository, passwordEncoder);

        localUser = User.builder()
                .id(1L)
                .name("Local Student")
                .email("n210001@rguktn.ac.in")
                .password("encodedOldPassword")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
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
    @DisplayName("Should update user profile name and avatar")
    void shouldUpdateProfile() {
        UpdateProfileRequest request = UpdateProfileRequest.builder()
                .name("Updated Name")
                .profilePicture("https://example.com/avatar.png")
                .build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(localUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserResponse response = profileService.updateProfile(localUser, request);

        assertThat(response.getName()).isEqualTo("Updated Name");
        assertThat(response.getProfilePicture()).isEqualTo("https://example.com/avatar.png");
    }

    @Test
    @DisplayName("Should successfully change password for local user")
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
    @DisplayName("Should reject password change for Google OAuth accounts")
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
    @DisplayName("Should reject password change when current password is incorrect")
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
    @DisplayName("Should reject password change when new password and confirm do not match")
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
    @DisplayName("Should reject password change when new password is identical to old password")
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
