package com.selva.authportal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.selva.authportal.dto.*;
import com.selva.authportal.model.StudentEvaluation;
import com.selva.authportal.repository.StudentEvaluationRepository;
import com.selva.authportal.repository.TeacherFeedbackRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class EvaluationServiceTest {

    @Autowired
    private EvaluationService evaluationService;

    @Autowired
    private StudentEvaluationRepository evaluationRepository;

    @Autowired
    private TeacherFeedbackRepository feedbackRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanUp() {
        evaluationRepository.deleteAll();
        feedbackRepository.deleteAll();
    }

    private static final String SAMPLE_WEEK_1_JSON = """
            {
              "section_id": "SEC1",
              "week_id": "week-01",
              "students": [
                {
                  "student_id": "N210921",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 0 / 2 |\\n| Problem Understanding | 0 / 26 |\\n| Logic / Approach Used | 0 / 26 |\\n| Important Variables and Their Purpose | 0 / 26 |\\n| What I Observed | 0 / 26 |\\n| **Total** | **0 / 106** |\\n| **Final Score** | **0.00 / 10** |\\n\\n### Overall Assessment\\n\\nLimited evidence of understanding."
                },
                {
                  "student_id": "N240046",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 2 / 2 |\\n| Problem Understanding | 16 / 26 |\\n| Logic / Approach Used | 18 / 26 |\\n| Important Variables and Their Purpose | 0 / 26 |\\n| What I Observed | 12 / 26 |\\n| **Total** | **48 / 106** |\\n| **Final Score** | **4.53 / 10** |\\n\\n### Overall Assessment\\n\\nBasic understanding demonstrated."
                },
                {
                  "student_id": "N240081",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 0 / 2 |\\n| Problem Understanding | 3 / 26 |\\n| Logic / Approach Used | 3 / 26 |\\n| Important Variables and Their Purpose | 0 / 26 |\\n| What I Observed | 3 / 26 |\\n| **Total** | **9 / 106** |\\n| **Final Score** | **0.85 / 10** |\\n\\n### Overall Assessment\\n\\nInsufficient evidence."
                }
              ]
            }
            """;

    private static final String SAMPLE_WEEK_2_JSON = """
            {
              "section_id": "SEC1",
              "week_id": "week-02",
              "students": [
                {
                  "student_id": "N210921",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 2 / 2 |\\n| Problem Understanding | 20 / 26 |\\n| Logic / Approach Used | 22 / 26 |\\n| Important Variables and Their Purpose | 10 / 26 |\\n| What I Observed | 15 / 26 |\\n| **Total** | **69 / 106** |\\n| **Final Score** | **6.51 / 10** |\\n\\n### Overall Assessment\\n\\nGood progress shown."
                },
                {
                  "student_id": "N240046",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 2 / 2 |\\n| Problem Understanding | 22 / 26 |\\n| Logic / Approach Used | 24 / 26 |\\n| Important Variables and Their Purpose | 15 / 26 |\\n| What I Observed | 18 / 26 |\\n| **Total** | **81 / 106** |\\n| **Final Score** | **7.64 / 10** |\\n\\n### Overall Assessment\\n\\nSolid report."
                },
                {
                  "student_id": "N240149",
                  "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 1 / 2 |\\n| Problem Understanding | 14 / 26 |\\n| Logic / Approach Used | 16 / 26 |\\n| Important Variables and Their Purpose | 5 / 26 |\\n| What I Observed | 10 / 26 |\\n| **Total** | **46 / 106** |\\n| **Final Score** | **4.34 / 10** |\\n\\n### Overall Assessment\\n\\nSatisfactory work."
                }
              ]
            }
            """;

    @Test
    @DisplayName("Initial JSON upload creates dynamic student rows and week column")
    void testInitialJsonUpload() throws IOException {
        EvaluationUploadResponse uploadResp = evaluationService.processJsonString(SAMPLE_WEEK_1_JSON);
        assertThat(uploadResp.isSuccess()).isTrue();
        assertThat(uploadResp.getProcessedCount()).isEqualTo(3);
        assertThat(uploadResp.getWeeks()).contains("Week 1");

        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();
        assertThat(grid.getWeeks()).containsExactly("Week 1");
        assertThat(grid.getTotalStudents()).isEqualTo(3);
        assertThat(grid.getRows()).hasSize(3);

        // Verify student row contents
        TeacherEvaluationRowDTO row1 = grid.getRows().get(0);
        assertThat(row1.getRNo()).isEqualTo(1);
        assertThat(row1.getStudentId()).isEqualTo("N210921");
        assertThat(row1.getEvaluations()).containsKey("Week 1");

        EvaluationCellDTO cell1 = row1.getEvaluations().get("Week 1");
        assertThat(cell1.getFinalScore()).isEqualTo("0.00 / 10");
        assertThat(cell1.getObjectiveScore()).isEqualTo("0 / 2");
        assertThat(cell1.isReviewed()).isFalse();

        TeacherEvaluationRowDTO row2 = grid.getRows().get(1);
        assertThat(row2.getRNo()).isEqualTo(2);
        assertThat(row2.getStudentId()).isEqualTo("N240046");
        EvaluationCellDTO cell2 = row2.getEvaluations().get("Week 1");
        assertThat(cell2.getFinalScore()).isEqualTo("4.53 / 10");
        assertThat(cell2.getObjectiveScore()).isEqualTo("2 / 2");
        assertThat(cell2.getProblemUnderstandingScore()).isEqualTo("16 / 26");
        assertThat(cell2.getLogicScore()).isEqualTo("18 / 26");
    }

    @Test
    @DisplayName("Multi-week upload dynamically appends columns, populates existing students, and appends new students without row duplicates")
    void testMultiWeekUploadAppendAndPopulate() throws IOException {
        // Upload Week 1 (3 students: N210921, N240046, N240081)
        evaluationService.processJsonString(SAMPLE_WEEK_1_JSON);

        // Upload Week 2 (N210921, N240046, N240149)
        evaluationService.processJsonString(SAMPLE_WEEK_2_JSON);

        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();

        // 1. Dynamic week columns
        assertThat(grid.getWeeks()).containsExactly("Week 1", "Week 2");

        // 2. Exactly 4 unique students (N210921, N240046, N240081, N240149) - NO DUPLICATE ROWS
        assertThat(grid.getTotalStudents()).isEqualTo(4);
        assertThat(grid.getRows()).hasSize(4);

        // Student 1: has both Week 1 and Week 2
        TeacherEvaluationRowDTO row1 = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N210921"))
                .findFirst().orElseThrow();
        assertThat(row1.getEvaluations()).containsKey("Week 1");
        assertThat(row1.getEvaluations()).containsKey("Week 2");
        assertThat(row1.getEvaluations().get("Week 1").getFinalScore()).isEqualTo("0.00 / 10");
        assertThat(row1.getEvaluations().get("Week 2").getFinalScore()).isEqualTo("6.51 / 10");

        // Student 3 (N240081): has Week 1 only
        TeacherEvaluationRowDTO row3 = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N240081"))
                .findFirst().orElseThrow();
        assertThat(row3.getEvaluations()).containsKey("Week 1");
        assertThat(row3.getEvaluations()).doesNotContainKey("Week 2");

        // Student 4 (N240149 - newly appended): has Week 2 only
        TeacherEvaluationRowDTO row4 = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N240149"))
                .findFirst().orElseThrow();
        assertThat(row4.getEvaluations()).doesNotContainKey("Week 1");
        assertThat(row4.getEvaluations()).containsKey("Week 2");
        assertThat(row4.getEvaluations().get("Week 2").getFinalScore()).isEqualTo("4.34 / 10");
    }

    @Test
    @DisplayName("CASE 3: Re-uploading existing (Student ID + Week) replaces evaluation without duplicating row or column")
    void testExistingStudentAndWeekReplacesEvaluation() throws IOException {
        // Upload initial Week 1
        evaluationService.processJsonString(SAMPLE_WEEK_1_JSON);

        // Upload updated Week 1 for N210921 with improved score
        String updatedWeek1Json = """
                {
                  "week_id": "week-01",
                  "students": [
                    {
                      "student_id": "N210921",
                      "evaluation": "## 📊 Final Score\\n\\n### Overall Evaluation\\n\\n| Criterion | Score |\\n|---|---:|\\n| Objective of the Lab | 2 / 2 |\\n| Problem Understanding | 24 / 26 |\\n| Logic / Approach Used | 26 / 26 |\\n| Important Variables and Their Purpose | 20 / 26 |\\n| What I Observed | 20 / 26 |\\n| **Total** | **92 / 106** |\\n| **Final Score** | **9.20 / 10** |\\n\\n### Overall Assessment\\n\\nResubmission verified with excellent improvement."
                    }
                  ]
                }
                """;

        evaluationService.processJsonString(updatedWeek1Json);

        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();

        // Still only 3 students and 1 week column
        assertThat(grid.getTotalStudents()).isEqualTo(3);
        assertThat(grid.getWeeks()).containsExactly("Week 1");

        TeacherEvaluationRowDTO row1 = grid.getRows().get(0);
        assertThat(row1.getStudentId()).isEqualTo("N210921");
        EvaluationCellDTO cell = row1.getEvaluations().get("Week 1");
        assertThat(cell.getFinalScore()).isEqualTo("9.20 / 10");
        assertThat(cell.getObjectiveScore()).isEqualTo("2 / 2");
        assertThat(cell.getTotalScore()).isEqualTo("92 / 106");
    }

    @Test
    @DisplayName("Teacher Feedback is saved per (Student ID + Week) and does NOT modify AI evaluations")
    void testTeacherFeedbackIndependenceAndPersistence() throws IOException {
        evaluationService.processJsonString(SAMPLE_WEEK_1_JSON);
        evaluationService.processJsonString(SAMPLE_WEEK_2_JSON);

        // 1. Save feedback for N210921 + Week 1: Reviewed=Yes, text="Good explanation."
        TeacherFeedbackResponse fb1 = evaluationService.saveFeedback(
                TeacherFeedbackRequest.builder()
                        .studentId("N210921")
                        .week("Week 1")
                        .reviewed(true)
                        .feedbackText("Good explanation.")
                        .build(),
                "teacher@rguktn.ac.in"
        );
        assertThat(fb1.isReviewed()).isTrue();
        assertThat(fb1.getFeedbackText()).isEqualTo("Good explanation.");

        // 2. Save feedback for N210921 + Week 2: Reviewed=No, text="Improve observations."
        TeacherFeedbackResponse fb2 = evaluationService.saveFeedback(
                TeacherFeedbackRequest.builder()
                        .studentId("N210921")
                        .week("Week 2")
                        .reviewed(false)
                        .feedbackText("Improve observations.")
                        .build(),
                "teacher@rguktn.ac.in"
        );
        assertThat(fb2.isReviewed()).isFalse();
        assertThat(fb2.getFeedbackText()).isEqualTo("Improve observations.");

        // 3. Verify single student report retrieves correct separate feedback
        SingleStudentReportResponse reportWeek1 = evaluationService.getStudentReport("N210921", "Week 1");
        assertThat(reportWeek1.isReviewed()).isTrue();
        assertThat(reportWeek1.getFeedbackText()).isEqualTo("Good explanation.");
        assertThat(reportWeek1.getFinalScore()).isEqualTo("0.00 / 10"); // AI evaluation intact

        SingleStudentReportResponse reportWeek2 = evaluationService.getStudentReport("N210921", "Week 2");
        assertThat(reportWeek2.isReviewed()).isFalse();
        assertThat(reportWeek2.getFeedbackText()).isEqualTo("Improve observations.");
        assertThat(reportWeek2.getFinalScore()).isEqualTo("6.51 / 10"); // AI evaluation intact

        // 4. Verify Grid reflects review status
        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();
        TeacherEvaluationRowDTO row = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N210921"))
                .findFirst().orElseThrow();

        assertThat(row.getEvaluations().get("Week 1").isReviewed()).isTrue();
        assertThat(row.getEvaluations().get("Week 2").isReviewed()).isFalse();

        // 5. Update feedback for Week 1
        evaluationService.saveFeedback(
                TeacherFeedbackRequest.builder()
                        .studentId("N210921")
                        .week("Week 1")
                        .reviewed(true)
                        .feedbackText("Updated note after discussion.")
                        .build(),
                "teacher@rguktn.ac.in"
        );

        SingleStudentReportResponse reloaded = evaluationService.getStudentReport("N210921", "Week 1");
        assertThat(reloaded.getFeedbackText()).isEqualTo("Updated note after discussion.");
        // Verify AI score was NEVER altered
        assertThat(reloaded.getFinalScore()).isEqualTo("0.00 / 10");
    }

    @Test
    @DisplayName("Process real sample week-01 JSON with 5 students and verify all scores and section breakdown")
    void testRealSampleWeek01Json() throws Exception {
        var resource = new org.springframework.core.io.ClassPathResource("sample-week-01.json");
        String json = new String(resource.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);

        EvaluationUploadResponse resp = evaluationService.processJsonString(json);
        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getProcessedCount()).isEqualTo(5);
        assertThat(resp.getWeeks()).containsExactly("Week 1");

        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();
        assertThat(grid.getTotalStudents()).isEqualTo(5);
        assertThat(grid.getWeeks()).containsExactly("Week 1");

        // Verify N240046
        TeacherEvaluationRowDTO rowN240046 = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N240046"))
                .findFirst().orElseThrow();
        EvaluationCellDTO cell = rowN240046.getEvaluations().get("Week 1");
        assertThat(cell.getFinalScore()).isEqualTo("4.53 / 10");
        assertThat(cell.getObjectiveScore()).isEqualTo("2 / 2");
        assertThat(cell.getProblemUnderstandingScore()).isEqualTo("16 / 26");
        assertThat(cell.getLogicScore()).isEqualTo("18 / 26");
        assertThat(cell.getVariablesScore()).isEqualTo("0 / 26");
        assertThat(cell.getObservationScore()).isEqualTo("12 / 26");
        assertThat(cell.getTotalScore()).isEqualTo("48 / 106");

        // Verify single student report for N240046
        SingleStudentReportResponse report = evaluationService.getStudentReport("N240046", "Week 1");
        assertThat(report.getAssessment()).contains("Basic understanding demonstrated");
        assertThat(report.getSectionId()).isEqualTo("SEC1");
    }

    @Test
    @DisplayName("Delete student report for specific week and all reports for student")
    void testDeleteStudentReportAndAllReports() throws IOException {
        evaluationService.processJsonString(SAMPLE_WEEK_1_JSON);
        evaluationService.processJsonString(SAMPLE_WEEK_2_JSON);

        // Add feedback for N210921 Week 1
        evaluationService.saveFeedback(
                TeacherFeedbackRequest.builder()
                        .studentId("N210921")
                        .week("Week 1")
                        .reviewed(true)
                        .feedbackText("Initial feedback.")
                        .build(),
                "teacher@rguktn.ac.in"
        );

        // Both weeks should exist
        assertThat(evaluationService.getStudentReport("N210921", "Week 1")).isNotNull();
        assertThat(evaluationService.getStudentReport("N210921", "Week 2")).isNotNull();

        // 1. Delete Week 1 report
        evaluationService.deleteStudentReport("N210921", "Week 1");

        // Week 1 should now throw ResourceNotFoundException
        org.junit.jupiter.api.Assertions.assertThrows(
                com.selva.authportal.exception.ResourceNotFoundException.class,
                () -> evaluationService.getStudentReport("N210921", "Week 1")
        );

        // Week 2 remains intact
        SingleStudentReportResponse week2Report = evaluationService.getStudentReport("N210921", "Week 2");
        assertThat(week2Report).isNotNull();
        assertThat(week2Report.getFinalScore()).isEqualTo("6.51 / 10");

        // Grid should show null for Week 1, but Week 2 remains
        TeacherEvaluationGridResponse grid = evaluationService.getEvaluationGrid();
        TeacherEvaluationRowDTO row = grid.getRows().stream()
                .filter(r -> r.getStudentId().equals("N210921"))
                .findFirst().orElseThrow();
        assertThat(row.getEvaluations().get("Week 1")).isNull();
        assertThat(row.getEvaluations().get("Week 2")).isNotNull();

        // 2. Delete all reports for student N210921
        evaluationService.deleteAllReportsForStudent("N210921");

        // Grid should no longer have N210921
        TeacherEvaluationGridResponse updatedGrid = evaluationService.getEvaluationGrid();
        boolean studentPresent = updatedGrid.getRows().stream()
                .anyMatch(r -> r.getStudentId().equals("N210921"));
        assertThat(studentPresent).isFalse();
    }
}
