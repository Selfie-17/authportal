package com.selva.authportal.controller;

import com.selva.authportal.dto.TeacherSubmissionPageResponse;
import com.selva.authportal.dto.TeacherSubmissionRecordDTO;
import com.selva.authportal.service.SubmissionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class TeacherSubmissionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private SubmissionService submissionService;

    @BeforeEach
    void setUp() {
        TeacherSubmissionController controller = new TeacherSubmissionController(submissionService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("Should return paginated submissions response with 20 records structure")
    void shouldReturnPaginatedSubmissions() throws Exception {
        TeacherSubmissionRecordDTO record = TeacherSubmissionRecordDTO.builder()
                .id(101L)
                .studentId("N210001")
                .studentName("Deva Selva")
                .studentEmail("n210001@rguktn.ac.in")
                .week(1)
                .weekDisplay("Week 1")
                .section(2)
                .year("E1")
                .version(1)
                .hasPdf(true)
                .pdfFileId(202L)
                .pdfFileName("lab1_report.pdf")
                .reviewed(true)
                .feedbackText("Excellent solution and clear observations.")
                .teacherEmail("teacher@rguktn.ac.in")
                .submittedAt(Instant.now())
                .feedbackUpdatedAt(Instant.now())
                .build();

        TeacherSubmissionPageResponse response = TeacherSubmissionPageResponse.builder()
                .content(List.of(record))
                .currentPage(0)
                .pageSize(20)
                .totalElements(1)
                .totalPages(1)
                .build();

        when(submissionService.getPaginatedSubmissions(eq(0), eq(20), eq("Week 1"), eq("N210001")))
                .thenReturn(response);

        mockMvc.perform(get("/api/teacher/submissions-page")
                        .param("page", "0")
                        .param("size", "20")
                        .param("week", "Week 1")
                        .param("search", "N210001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPage").value(0))
                .andExpect(jsonPath("$.pageSize").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].studentId").value("N210001"))
                .andExpect(jsonPath("$.content[0].studentName").value("Deva Selva"))
                .andExpect(jsonPath("$.content[0].hasPdf").value(true))
                .andExpect(jsonPath("$.content[0].pdfFileId").value(202))
                .andExpect(jsonPath("$.content[0].reviewed").value(true))
                .andExpect(jsonPath("$.content[0].teacherEmail").value("teacher@rguktn.ac.in"))
                .andExpect(jsonPath("$.content[0].feedbackText").value("Excellent solution and clear observations."));
    }
}
