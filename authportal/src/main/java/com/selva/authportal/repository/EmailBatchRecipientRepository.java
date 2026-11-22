package com.selva.authportal.repository;

import com.selva.authportal.model.EmailBatchRecipient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface EmailBatchRecipientRepository extends JpaRepository<EmailBatchRecipient, Long> {

    @EntityGraph(attributePaths = "batch")
    @Query("""
            SELECT r FROM EmailBatchRecipient r
            WHERE (:failedOnly = false OR r.status = 'FAILED')
              AND (:term = '' OR LOCATE(:term, LOWER(r.studentId)) > 0
                OR LOCATE(:term, LOWER(r.email)) > 0
                OR EXISTS (SELECT 1 FROM User u
                    WHERE UPPER(TRIM(SUBSTRING(u.email, 1, LOCATE('@', u.email) - 1))) = UPPER(r.studentId)
                      AND LOCATE(:term, LOWER(u.name)) > 0))
            ORDER BY r.sentAt DESC, r.id DESC
            """)
    Page<EmailBatchRecipient> findHistoryPage(@Param("failedOnly") boolean failedOnly,
                                              @Param("term") String term, Pageable pageable);

    List<EmailBatchRecipient> findByBatchIdOrderByIdAsc(Long batchId);

    List<EmailBatchRecipient> findByBatchIdAndStatus(Long batchId, String status);

    @Query("SELECT COUNT(r) FROM EmailBatchRecipient r WHERE r.sentAt >= :since AND r.status = 'SENT'")
    long countSentSince(@Param("since") Instant since);

    @Query("SELECT COUNT(r) > 0 FROM EmailBatchRecipient r JOIN r.batch b WHERE r.studentId = :studentId AND b.week = :week AND r.status = 'SENT'")
    boolean hasSentReportToStudentForWeek(@Param("studentId") String studentId, @Param("week") String week);
}
