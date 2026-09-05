package com.selva.authportal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.*;
import com.selva.authportal.exception.GlobalExceptionHandler;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.service.AdminService;
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

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @Mock
    private AdminService adminService;

    @Mock
    private UserRepository userRepository;

    private User adminUser;
    private CustomUserDetails customUserDetails;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        adminUser = User.builder()
                .id(1L)
                .name("Admin User")
                .email("admin@rguktn.ac.in")
                .role(Role.ADMIN)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();

        customUserDetails = new CustomUserDetails(adminUser);

        AdminController controller = new AdminController(adminService, userRepository);

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
    @DisplayName("Should return system stats successfully")
    void shouldReturnStats() throws Exception {
        AdminStatsResponse stats = AdminStatsResponse.builder()
                .totalUsers(50)
                .studentCount(40)
                .teacherCount(8)
                .adminCount(2)
                .totalSubmissions(120)
                .build();

        when(adminService.getSystemStats()).thenReturn(stats);

        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(50))
                .andExpect(jsonPath("$.studentCount").value(40))
                .andExpect(jsonPath("$.totalSubmissions").value(120));
    }

    @Test
    @DisplayName("Should list system users with search and role filter")
    void shouldListUsers() throws Exception {
        UserResponse user = UserResponse.builder()
                .id(2L)
                .name("Student User")
                .email("n210001@rguktn.ac.in")
                .role(Role.STUDENT)
                .enabled(true)
                .createdAt(Instant.now())
                .build();

        when(adminService.getAllUsers("n21", Role.STUDENT)).thenReturn(List.of(user));

        mockMvc.perform(get("/api/admin/users")
                        .param("query", "n21")
                        .param("role", "STUDENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("n210001@rguktn.ac.in"))
                .andExpect(jsonPath("$[0].role").value("STUDENT"));
    }

    @Test
    @DisplayName("Should create new user and return 201 Created")
    void shouldCreateUser() throws Exception {
        CreateUserRequest request = CreateUserRequest.builder()
                .name("Faculty Member")
                .email("faculty@rguktn.ac.in")
                .password("Secr3tPassword!")
                .role(Role.TEACHER)
                .build();

        UserResponse created = UserResponse.builder()
                .id(3L)
                .name("Faculty Member")
                .email("faculty@rguktn.ac.in")
                .role(Role.TEACHER)
                .enabled(true)
                .build();

        when(adminService.createUser(any(CreateUserRequest.class))).thenReturn(created);

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.role").value("TEACHER"));
    }

    @Test
    @DisplayName("Should update user role")
    void shouldUpdateUserRole() throws Exception {
        UpdateRoleRequest request = new UpdateRoleRequest(Role.TEACHER);
        UserResponse updated = UserResponse.builder()
                .id(2L)
                .email("n210001@rguktn.ac.in")
                .role(Role.TEACHER)
                .build();

        when(adminService.updateUserRole(eq(2L), eq(Role.TEACHER), any())).thenReturn(updated);

        mockMvc.perform(patch("/api/admin/users/2/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("TEACHER"));
    }

    @Test
    @DisplayName("Should delete submission and return success message")
    void shouldDeleteSubmission() throws Exception {
        doNothing().when(adminService).deleteSubmission(10L);

        mockMvc.perform(delete("/api/admin/submissions/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Submission deleted successfully."));
    }
}
