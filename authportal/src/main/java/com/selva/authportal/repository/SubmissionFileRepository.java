package com.selva.authportal.repository;

import com.selva.authportal.model.SubmissionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for SubmissionFile entity.
 */
@Repository
public interface SubmissionFileRepository extends JpaRepository<SubmissionFile, Long> {

    List<SubmissionFile> findBySubmissionId(Long submissionId);

    Optional<SubmissionFile> findByIdAndSubmissionId(Long id, Long submissionId);
}
