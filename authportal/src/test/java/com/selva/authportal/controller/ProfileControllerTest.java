package com.selva.authportal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.ChangePasswordRequest;
import com.selva.authportal.dto.UpdateProfileRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.ProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProfileControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private ProfileService profileService;

    @Mock
    private UserRepository userRepository;

    private User studentUser;
    private CustomUserDetails customUserDetails;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        studentUser = User.builder()
                .id(1L)
                .name("Student User")
                .email("n210001@rguktn.ac.in")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        customUserDetails = new CustomUserDetails(studentUser);

        ProfileController controller = new ProfileController(profileService, userRepository);

        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return customUserDetails;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("Should return authenticated user profile")
    void shouldReturnProfile() throws Exception {
        UserResponse response = UserResponse.builder()
                .id(1L)
                .name("Student User")
                .email("n210001@rguktn.ac.in")
                .role(Role.STUDENT)
                .build();

        when(profileService.getProfile(any())).thenReturn(response);

        mockMvc.perform(get("/api/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("n210001@rguktn.ac.in"))
                .andExpect(jsonPath("$.name").value("Student User"));
    }

    @Test
    @DisplayName("Should update user profile")
    void shouldUpdateProfile() throws Exception {
        UpdateProfileRequest request = UpdateProfileRequest.builder()
                .name("New Name")
                .profilePicture("https://example.com/pic.jpg")
                .build();

        UserResponse response = UserResponse.builder()
                .id(1L)
                .name("New Name")
                .email("n210001@rguktn.ac.in")
                .profilePicture("https://example.com/pic.jpg")
                .role(Role.STUDENT)
                .build();

        when(profileService.updateProfile(any(), any(UpdateProfileRequest.class))).thenReturn(response);

        mockMvc.perform(patch("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Name"));
    }

    @Test
    @DisplayName("Should change user password successfully")
    void shouldChangePassword() throws Exception {
        ChangePasswordRequest request = ChangePasswordRequest.builder()
                .currentPassword("oldPass123!")
                .newPassword("newPass456!")
                .confirmPassword("newPass456!")
                .build();

        doNothing().when(profileService).changePassword(any(), any(ChangePasswordRequest.class));

        mockMvc.perform(post("/api/profile/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Password changed successfully."));
    }
}
