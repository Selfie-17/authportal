package com.selva.authportal.repository;

import com.selva.authportal.model.StudentEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentEvaluationRepository extends JpaRepository<StudentEvaluation, Long> {

    Optional<StudentEvaluation> findByStudentIdAndWeek(String studentId, String week);

    List<StudentEvaluation> findByStudentId(String studentId);

    List<StudentEvaluation> findAllByOrderByIdAsc();

    @Query("SELECT DISTINCT e.studentId FROM StudentEvaluation e ORDER BY e.studentId ASC")
    List<String> findDistinctStudentIds();

    @Query("SELECT DISTINCT e.week FROM StudentEvaluation e ORDER BY e.weekNumber ASC, e.week ASC")
    List<String> findDistinctWeeks();
}
