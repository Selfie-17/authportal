package com.selva.authportal.repository;

import com.selva.authportal.model.Submission;
import com.selva.authportal.model.YearLevel;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for Submission entity.
 * Supports student history queries, duplicate checks, and dynamic teacher filtering.
 */
@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long>, JpaSpecificationExecutor<Submission> {

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByUserIdOrderByWeekAscCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"files"})
    Optional<Submission> findByIdAndUserId(Long id, Long userId);

    @EntityGraph(attributePaths = {"files"})
    Optional<Submission> findByUserIdAndWeekAndYearAndSection(Long userId, Integer week, YearLevel year, Integer section);

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByWeek(Integer week);

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByWeekAndSectionOrderByStudentIdAsc(Integer week, Integer section);

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByWeekAndYearAndSectionOrderByStudentIdAsc(Integer week, YearLevel year, Integer section);

    boolean existsByUserIdAndWeekAndYearAndSection(Long userId, Integer week, YearLevel year, Integer section);

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByStudentIdIgnoreCaseAndWeekOrderByVersionDescUpdatedAtDesc(String studentId, Integer week);

    @EntityGraph(attributePaths = {"files"})
    List<Submission> findByStudentIdIgnoreCaseAndWeekAndSectionOrderByVersionDescUpdatedAtDesc(String studentId, Integer week, Integer section);
}
