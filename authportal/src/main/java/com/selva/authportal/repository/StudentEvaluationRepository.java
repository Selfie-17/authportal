package com.selva.authportal.repository;

import com.selva.authportal.model.StudentEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentEvaluationRepository extends JpaRepository<StudentEvaluation, Long> {

    Optional<StudentEvaluation> findByStudentIdAndWeekAndProvider(String studentId, String week, String provider);

    Optional<StudentEvaluation> findByStudentIdAndWeek(String studentId, String week);

    List<StudentEvaluation> findAllByStudentIdAndWeek(String studentId, String week);

    List<StudentEvaluation> findByStudentId(String studentId);

    List<StudentEvaluation> findAllByOrderByIdAsc();

    @Query("SELECT DISTINCT e.studentId FROM StudentEvaluation e ORDER BY e.studentId ASC")
    List<String> findDistinctStudentIds();

    @Query("SELECT DISTINCT e.week FROM StudentEvaluation e ORDER BY e.weekNumber ASC, e.week ASC")
    List<String> findDistinctWeeks();

    @Query("SELECT DISTINCT e.provider FROM StudentEvaluation e WHERE e.studentId = :studentId AND e.week = :week")
    List<String> findDistinctProvidersByStudentIdAndWeek(@Param("studentId") String studentId, @Param("week") String week);

    /**
     * Lightweight projection representing grid evaluation items.
     * Excludes raw_json (LONGTEXT) and assessment (TEXT) to drastically reduce
     * database transfer size and eliminate network latency in cloud deployment.
     */
    interface EvaluationSummaryProjection {
        Long getId();
        String getStudentId();
        String getWeek();
        Integer getWeekNumber();
        String getSectionId();
        String getObjectiveScore();
        String getProblemUnderstandingScore();
        String getLogicScore();
        String getVariablesScore();
        String getObservationScore();
        String getTotalScore();
        String getFinalScore();
        String getProvider();
        String getModelName();
        String getGrade();
        String getStatus();
    }

    @Query("SELECT e.id AS id, e.studentId AS studentId, e.week AS week, e.weekNumber AS weekNumber, " +
           "e.sectionId AS sectionId, e.objectiveScore AS objectiveScore, " +
           "e.problemUnderstandingScore AS problemUnderstandingScore, e.logicScore AS logicScore, " +
           "e.variablesScore AS variablesScore, e.observationScore AS observationScore, " +
           "e.totalScore AS totalScore, e.finalScore AS finalScore, e.provider AS provider, " +
           "e.modelName AS modelName, e.grade AS grade, e.status AS status " +
           "FROM StudentEvaluation e ORDER BY e.id ASC")
    List<EvaluationSummaryProjection> findAllSummaries();
}
