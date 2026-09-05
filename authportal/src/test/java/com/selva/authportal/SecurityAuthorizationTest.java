package com.selva.authportal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class SecurityAuthorizationTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
    }

    @Test
    @DisplayName("GET /api/test/authenticated without token should return 401 Unauthorized")
    void testUnauthenticatedAccess() throws Exception {
        mockMvc.perform(get("/api/test/authenticated"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "n210921@rguktn.ac.in", roles = {"STUDENT"})
    @DisplayName("GET /api/test/student with STUDENT role should return 200 OK")
    void testStudentAccessGranted() throws Exception {
        mockMvc.perform(get("/api/test/student"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "teacher@rguktn.ac.in", roles = {"TEACHER"})
    @DisplayName("GET /api/test/student with TEACHER role should return 403 Forbidden")
    void testStudentEndpointForbiddenForTeacher() throws Exception {
        mockMvc.perform(get("/api/test/student"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@rguktn.ac.in", roles = {"TEACHER"})
    @DisplayName("GET /api/test/teacher with TEACHER role should return 200 OK")
    void testTeacherAccessGranted() throws Exception {
        mockMvc.perform(get("/api/test/teacher"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "n210921@rguktn.ac.in", roles = {"STUDENT"})
    @DisplayName("GET /api/test/teacher with STUDENT role should return 403 Forbidden")
    void testTeacherEndpointForbiddenForStudent() throws Exception {
        mockMvc.perform(get("/api/test/teacher"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin@rguktn.ac.in", roles = {"ADMIN"})
    @DisplayName("GET /api/test/admin with ADMIN role should return 200 OK")
    void testAdminAccessGranted() throws Exception {
        mockMvc.perform(get("/api/test/admin"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "n210921@rguktn.ac.in", roles = {"STUDENT"})
    @DisplayName("GET /api/test/admin with STUDENT role should return 403 Forbidden")
    void testAdminEndpointForbiddenForStudent() throws Exception {
        mockMvc.perform(get("/api/test/admin"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "teacher@rguktn.ac.in", roles = {"TEACHER"})
    @DisplayName("GET /api/test/admin with TEACHER role should return 403 Forbidden")
    void testAdminEndpointForbiddenForTeacher() throws Exception {
        mockMvc.perform(get("/api/test/admin"))
                .andExpect(status().isForbidden());
    }
}
