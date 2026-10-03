package com.selva.authportal.repository;

import com.selva.authportal.model.EmailBatchRecipient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface EmailBatchRecipientRepository extends JpaRepository<EmailBatchRecipient, Long> {

    List<EmailBatchRecipient> findByBatchIdOrderByIdAsc(Long batchId);

    List<EmailBatchRecipient> findByBatchIdAndStatus(Long batchId, String status);

    @Query("SELECT COUNT(r) FROM EmailBatchRecipient r WHERE r.sentAt >= :since AND r.status = 'SENT'")
    long countSentSince(@Param("since") Instant since);

    @Query("SELECT COUNT(r) > 0 FROM EmailBatchRecipient r JOIN r.batch b WHERE r.studentId = :studentId AND b.week = :week AND r.status = 'SENT'")
    boolean hasSentReportToStudentForWeek(@Param("studentId") String studentId, @Param("week") String week);
}
