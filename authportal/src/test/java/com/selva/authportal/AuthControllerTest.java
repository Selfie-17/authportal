package com.selva.authportal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.controller.AuthController;
import com.selva.authportal.dto.*;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @Mock
    private AuthService authService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        AuthController authController = new AuthController(authService);
        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("POST /api/auth/register with valid student data should return 201 Created")
    void testRegisterValid() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .name("Selva")
                .email("n210921@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .token("mocked.jwt.token")
                .tokenType("Bearer")
                .expiresIn(86400)
                .user(UserResponse.builder()
                        .id(1L)
                        .name("Selva")
                        .email("n210921@rguktn.ac.in")
                        .role(Role.STUDENT)
                        .authProvider(AuthProvider.LOCAL)
                        .enabled(true)
                        .build())
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("mocked.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("n210921@rguktn.ac.in"))
                .andExpect(jsonPath("$.user.role").value("STUDENT"));
    }

    @Test
    @DisplayName("POST /api/auth/register with short password should fail with 400 Bad Request")
    void testRegisterInvalidPassword() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .name("Selva")
                .email("n210921@rguktn.ac.in")
                .password("short") // < 8 characters
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    @DisplayName("POST /api/auth/register with invalid email format should fail with 400")
    void testRegisterInvalidEmail() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
                .name("Selva")
                .email("not-an-email")
                .password("StrongPassword123")
                .build();

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors.email").exists());
    }

    @Test
    @DisplayName("POST /api/auth/login with valid data should return 200 OK")
    void testLoginValid() throws Exception {
        LoginRequest request = LoginRequest.builder()
                .email("n210921@rguktn.ac.in")
                .password("StrongPassword123")
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .token("mocked.jwt.token")
                .tokenType("Bearer")
                .expiresIn(86400)
                .user(UserResponse.builder()
                        .id(1L)
                        .name("Selva")
                        .email("n210921@rguktn.ac.in")
                        .role(Role.STUDENT)
                        .authProvider(AuthProvider.LOCAL)
                        .enabled(true)
                        .build())
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mocked.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("n210921@rguktn.ac.in"));
    }

    @Test
    @DisplayName("POST /api/auth/oauth2/exchange with code should return 200 OK")
    void testExchangeOAuthCode() throws Exception {
        OAuth2ExchangeRequest request = OAuth2ExchangeRequest.builder()
                .code("single-use-code-xyz")
                .build();

        AuthResponse authResponse = AuthResponse.builder()
                .token("oauth.jwt.token")
                .tokenType("Bearer")
                .expiresIn(86400)
                .user(UserResponse.builder()
                        .id(1L)
                        .name("Selva")
                        .email("n210921@rguktn.ac.in")
                        .role(Role.STUDENT)
                        .authProvider(AuthProvider.GOOGLE)
                        .enabled(true)
                        .build())
                .build();

        when(authService.exchangeOAuthCode("single-use-code-xyz")).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/oauth2/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("oauth.jwt.token"))
                .andExpect(jsonPath("$.user.email").value("n210921@rguktn.ac.in"));
    }

    @Test
    @DisplayName("POST /api/auth/logout should return 200 OK")
    void testLogout() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
