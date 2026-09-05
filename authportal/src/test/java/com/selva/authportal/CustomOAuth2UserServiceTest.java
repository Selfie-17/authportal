package com.selva.authportal;

import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.oauth2.CustomOAuth2UserService;
import com.selva.authportal.security.oauth2.OAuth2UserPrincipal;
import com.selva.authportal.service.EmailRoleResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomOAuth2UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailRoleResolver emailRoleResolver;

    @Mock
    private OAuth2User mockOAuth2User;

    @InjectMocks
    private CustomOAuth2UserService customOAuth2UserService;

    @BeforeEach
    void setUp() {
    }

    @Test
    @DisplayName("Should provision new student user when valid Google student account authenticates")
    void testProcessNewStudentGoogleUser() {
        when(mockOAuth2User.getAttribute("email")).thenReturn("n210921@rguktn.ac.in");
        when(mockOAuth2User.getAttribute("sub")).thenReturn("google-id-12345");
        when(mockOAuth2User.getAttribute("name")).thenReturn("Selva");
        when(mockOAuth2User.getAttribute("picture")).thenReturn("https://google.com/pic.jpg");

        when(emailRoleResolver.isInstitutionalDomain("n210921@rguktn.ac.in")).thenReturn(true);
        when(userRepository.findByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.empty());
        when(emailRoleResolver.resolveRole("n210921@rguktn.ac.in")).thenReturn(Role.STUDENT);

        User savedUser = User.builder()
                .id(10L)
                .email("n210921@rguktn.ac.in")
                .name("Selva")
                .googleId("google-id-12345")
                .profilePicture("https://google.com/pic.jpg")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.GOOGLE)
                .enabled(true)
                .build();

        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        OAuth2User result = customOAuth2UserService.processOAuth2User(mockOAuth2User);

        assertNotNull(result);
        assertTrue(result instanceof OAuth2UserPrincipal);
        OAuth2UserPrincipal principal = (OAuth2UserPrincipal) result;
        assertEquals(Role.STUDENT, principal.getUser().getRole());
        assertEquals("google-id-12345", principal.getUser().getGoogleId());
        assertEquals(AuthProvider.GOOGLE, principal.getUser().getAuthProvider());
    }

    @Test
    @DisplayName("Should strictly reject non-institutional domain Google account")
    void testRejectNonInstitutionalGoogleAccount() {
        when(mockOAuth2User.getAttribute("email")).thenReturn("student@gmail.com");
        when(emailRoleResolver.isInstitutionalDomain("student@gmail.com")).thenReturn(false);

        assertThrows(
                OAuth2AuthenticationException.class,
                () -> customOAuth2UserService.processOAuth2User(mockOAuth2User)
        );
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("CRITICAL: Existing ADMIN user must NEVER be downgraded during Google OAuth login")
    void testPreserveExistingAdminRole() {
        when(mockOAuth2User.getAttribute("email")).thenReturn("admin@rguktn.ac.in");
        when(mockOAuth2User.getAttribute("sub")).thenReturn("google-admin-sub");
        when(mockOAuth2User.getAttribute("name")).thenReturn("Admin Boss");
        when(mockOAuth2User.getAttribute("picture")).thenReturn(null);

        when(emailRoleResolver.isInstitutionalDomain("admin@rguktn.ac.in")).thenReturn(true);

        User existingAdmin = User.builder()
                .id(1L)
                .email("admin@rguktn.ac.in")
                .name("Admin Boss")
                .role(Role.ADMIN) // EXISTING ADMIN ROLE
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        when(userRepository.findByEmail("admin@rguktn.ac.in")).thenReturn(Optional.of(existingAdmin));
        when(userRepository.save(existingAdmin)).thenReturn(existingAdmin);

        OAuth2User result = customOAuth2UserService.processOAuth2User(mockOAuth2User);

        assertNotNull(result);
        OAuth2UserPrincipal principal = (OAuth2UserPrincipal) result;
        assertEquals(Role.ADMIN, principal.getUser().getRole(), "ADMIN role must be preserved!");
        assertEquals("google-admin-sub", principal.getUser().getGoogleId());
        // Verify role resolver was NEVER invoked for existing admin (no downgrade to student/teacher)
        verify(emailRoleResolver, never()).resolveRole(any());
    }

    @Test
    @DisplayName("Should safely link Google ID to existing LOCAL account")
    void testSafeAccountLinking() {
        when(mockOAuth2User.getAttribute("email")).thenReturn("n210921@rguktn.ac.in");
        when(mockOAuth2User.getAttribute("sub")).thenReturn("new-google-sub-999");
        when(mockOAuth2User.getAttribute("name")).thenReturn("Selva");
        when(mockOAuth2User.getAttribute("picture")).thenReturn("https://avatar.png");

        when(emailRoleResolver.isInstitutionalDomain("n210921@rguktn.ac.in")).thenReturn(true);

        User existingLocalUser = User.builder()
                .id(5L)
                .email("n210921@rguktn.ac.in")
                .password("$2a$10$existingHash")
                .name("Selva")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .googleId(null)
                .enabled(true)
                .build();

        when(userRepository.findByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(existingLocalUser));
        when(userRepository.save(existingLocalUser)).thenReturn(existingLocalUser);

        OAuth2User result = customOAuth2UserService.processOAuth2User(mockOAuth2User);

        assertNotNull(result);
        assertEquals("new-google-sub-999", existingLocalUser.getGoogleId());
        assertEquals("https://avatar.png", existingLocalUser.getProfilePicture());
        assertEquals(Role.STUDENT, existingLocalUser.getRole());
    }
}
