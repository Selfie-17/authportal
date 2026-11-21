package com.selva.authportal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles({"test", "performance"})
class PerformanceProfileDiagnosticsTest {

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
    @DisplayName("In performance profile, GET /actuator/health returns 200 and details")
    void testHealthInPerformanceProfile() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("status")));
    }

    @Test
    @DisplayName("In performance profile, GET /actuator/metrics returns 200 and metric names")
    void testMetricsInPerformanceProfile() throws Exception {
        mockMvc.perform(get("/actuator/metrics"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("names")));
    }

    @Test
    @DisplayName("In performance profile, GET /actuator/prometheus returns 200 and Prometheus scraped metrics")
    void testPrometheusInPerformanceProfile() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("# TYPE jvm_")));
    }

    @Test
    @DisplayName("In performance profile, GET /actuator/threaddump returns 200 and active thread states")
    void testThreadDumpInPerformanceProfile() throws Exception {
        mockMvc.perform(get("/actuator/threaddump"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("threads")));
    }

    @Test
    @DisplayName("In performance profile, sensitive endpoints like /actuator/env remain strictly unexposed (404)")
    void testSensitiveEndpointRemainsUnexposed() throws Exception {
        mockMvc.perform(get("/actuator/env"))
                .andExpect(status().isNotFound());
    }
}
