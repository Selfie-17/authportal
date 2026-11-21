package com.selva.authportal;

import com.selva.authportal.dto.AuthResponse;
import com.selva.authportal.dto.LoginRequest;
import com.selva.authportal.dto.RegisterRequest;
import com.selva.authportal.exception.InvalidCredentialsException;
import com.selva.authportal.exception.UserAlreadyExistsException;
import com.selva.authportal.exception.UserDisabledException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.JwtService;
import com.selva.authportal.security.UserDatabaseLookupService;
import com.selva.authportal.security.oauth2.OAuth2ExchangeCodeStore;
import com.selva.authportal.service.AuthService;
import com.selva.authportal.service.EmailRoleResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private EmailRoleResolver emailRoleResolver;

    @Mock
    private JwtService jwtService;

    @Mock
    private OAuth2ExchangeCodeStore exchangeCodeStore;

    @Mock
    private UserDatabaseLookupService userDatabaseLookupService;

    @InjectMocks
    private AuthService authService;

    private User sampleUser;
    private User disabledUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(1L)
                .name("Selva")
                .email("n210921@rguktn.ac.in")
                .password("$2a$10$hashedPasswordHere")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        disabledUser = User.builder()
                .id(2L)
                .name("Disabled Student")
                .email("disabled@rguktn.ac.in")
                .password("$2a$10$disabledHashedPassword")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(false)
                .build();
    }

    @Test
    @DisplayName("Should register new student with hashed password and server-side resolved role")
    void testRegisterSuccess() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Selva")
                .email("N210921@rguktn.ac.in") // uppercase N to test normalization
                .password("StrongPassword123")
                .build();

        when(emailRoleResolver.resolveRole("n210921@rguktn.ac.in")).thenReturn(Role.STUDENT);
        when(userRepository.existsByEmail("n210921@rguktn.ac.in")).thenReturn(false);
        when(passwordEncoder.encode("StrongPassword123")).thenReturn("$2a$10$hashedPasswordHere");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtService.generateToken(any(User.class))).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals("n210921@rguktn.ac.in", response.getUser().getEmail());
        assertEquals(Role.STUDENT, response.getUser().getRole());
        assertEquals(AuthProvider.LOCAL, response.getUser().getAuthProvider());

        verify(passwordEncoder).encode("StrongPassword123");
        verify(userRepository).save(argThat(user ->
                user.getEmail().equals("n210921@rguktn.ac.in") &&
                user.getRole() == Role.STUDENT &&
                user.getPassword().equals("$2a$10$hashedPasswordHere")
        ));
    }

    @Test
    @DisplayName("Should throw UserAlreadyExistsException when registering duplicate email")
    void testRegisterDuplicateEmail() {
        RegisterRequest request = RegisterRequest.builder()
                .name("Selva")
                .email("n210921@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        when(emailRoleResolver.resolveRole("n210921@rguktn.ac.in")).thenReturn(Role.STUDENT);
        when(userRepository.existsByEmail("n210921@rguktn.ac.in")).thenReturn(true);

        assertThrows(UserAlreadyExistsException.class, () -> authService.register(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should login successfully with correct password")
    void testLoginSuccess() {
        LoginRequest request = LoginRequest.builder()
                .email("n210921@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        when(userDatabaseLookupService.findUserByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("StrongPassword123", sampleUser.getPassword())).thenReturn(true);
        when(jwtService.generateToken(sampleUser)).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getToken());
        assertEquals("n210921@rguktn.ac.in", response.getUser().getEmail());
    }

    @Test
    @DisplayName("Should throw InvalidCredentialsException for wrong password without exposing user details")
    void testLoginWrongPassword() {
        LoginRequest request = LoginRequest.builder()
                .email("n210921@rguktn.ac.in")
                .password("WrongPassword")
                .build();

        when(userDatabaseLookupService.findUserByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("WrongPassword", sampleUser.getPassword())).thenReturn(false);

        InvalidCredentialsException ex = assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        assertEquals("Invalid email or password.", ex.getMessage());
    }

    @Test
    @DisplayName("Should throw InvalidCredentialsException for unknown email")
    void testLoginUnknownEmail() {
        LoginRequest request = LoginRequest.builder()
                .email("nonexistent@rguktn.ac.in")
                .password("AnyPassword")
                .build();

        when(userDatabaseLookupService.findUserByEmail("nonexistent@rguktn.ac.in")).thenReturn(Optional.empty());

        InvalidCredentialsException ex = assertThrows(InvalidCredentialsException.class, () -> authService.login(request));
        assertEquals("Invalid email or password.", ex.getMessage());
    }

    @Test
    @DisplayName("Should normalize email during login (trim and lowercase)")
    void testLoginEmailNormalization() {
        LoginRequest request = LoginRequest.builder()
                .email("  N210921@RGUKTN.AC.IN  ")
                .password("StrongPassword123")
                .build();

        when(userDatabaseLookupService.findUserByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("StrongPassword123", sampleUser.getPassword())).thenReturn(true);
        when(jwtService.generateToken(sampleUser)).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        verify(userDatabaseLookupService).findUserByEmail("n210921@rguktn.ac.in");
    }

    @Test
    @DisplayName("DB lookup transaction completes before BCrypt verification begins")
    void testDbLookupCompletesBeforeBcryptVerification() {
        LoginRequest request = LoginRequest.builder()
                .email("n210921@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        when(userDatabaseLookupService.findUserByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("StrongPassword123", sampleUser.getPassword())).thenReturn(true);
        when(jwtService.generateToken(sampleUser)).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(86400000L);

        authService.login(request);

        // Verify strict chronological sequence: DB lookup completed BEFORE passwordEncoder.matches began
        InOrder inOrder = inOrder(userDatabaseLookupService, passwordEncoder, jwtService);
        inOrder.verify(userDatabaseLookupService).findUserByEmail("n210921@rguktn.ac.in");
        inOrder.verify(passwordEncoder).matches("StrongPassword123", sampleUser.getPassword());
        inOrder.verify(jwtService).generateToken(sampleUser);
    }

    @Test
    @DisplayName("AuthService.login is transaction-free (no @Transactional on method or class)")
    void testLoginMethodIsNotTransactional() throws NoSuchMethodException {
        assertThat(AuthService.class.isAnnotationPresent(Transactional.class)).isFalse();

        Method loginMethod = AuthService.class.getMethod("login", LoginRequest.class);
        assertThat(loginMethod.isAnnotationPresent(Transactional.class)).isFalse();
    }

    @Test
    @DisplayName("UserDatabaseLookupService.findUserByEmail declares @Transactional(readOnly = true)")
    void testFindUserByEmailDeclaresTransactionalReadOnly() throws NoSuchMethodException {
        Method findMethod = UserDatabaseLookupService.class.getMethod("findUserByEmail", String.class);
        Transactional tx = findMethod.getAnnotation(Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.readOnly()).isTrue();
    }

    @Test
    @DisplayName("Should throw UserDisabledException when user account is disabled")
    void testLoginDisabledAccount() {
        LoginRequest request = LoginRequest.builder()
                .email("disabled@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        when(userDatabaseLookupService.findUserByEmail("disabled@rguktn.ac.in")).thenReturn(Optional.of(disabledUser));
        when(passwordEncoder.matches("StrongPassword123", disabledUser.getPassword())).thenReturn(true);

        UserDisabledException ex = assertThrows(UserDisabledException.class, () -> authService.login(request));
        assertEquals("Your account is disabled. Please contact administration.", ex.getMessage());
    }

    @Test
    @DisplayName("Should exchange valid OAuth2 one-time code for JWT")
    void testExchangeOAuthCodeSuccess() {
        String testCode = "valid-exchange-code-123";
        when(exchangeCodeStore.consumeCode(testCode)).thenReturn(Optional.of("n210921@rguktn.ac.in"));
        when(userRepository.findByEmail("n210921@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));
        when(jwtService.generateToken(sampleUser)).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(86400000L);

        AuthResponse response = authService.exchangeOAuthCode(testCode);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals("n210921@rguktn.ac.in", response.getUser().getEmail());
        verify(exchangeCodeStore).consumeCode(testCode);
    }

    @Test
    @DisplayName("Should throw InvalidCredentialsException for invalid or expired OAuth2 exchange code")
    void testExchangeOAuthCodeInvalid() {
        String testCode = "invalid-code";
        when(exchangeCodeStore.consumeCode(testCode)).thenReturn(Optional.empty());

        InvalidCredentialsException ex = assertThrows(InvalidCredentialsException.class, () ->
                authService.exchangeOAuthCode(testCode));
        assertEquals("Invalid or expired OAuth authorization code.", ex.getMessage());
        verify(exchangeCodeStore).consumeCode(testCode);
        verifyNoInteractions(userRepository);
    }
}
