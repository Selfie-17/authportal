package com.selva.authportal.repository;

import com.selva.authportal.model.EmailBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface EmailBatchRepository extends JpaRepository<EmailBatch, Long> {

    List<EmailBatch> findAllByOrderByCreatedAtDesc();

    @Query("SELECT COUNT(b) FROM EmailBatch b WHERE b.createdAt >= :since")
    long countBatchesCreatedSince(@Param("since") Instant since);

    @Query("SELECT COALESCE(SUM(b.sentCount), 0) FROM EmailBatch b")
    long sumTotalSentCount();

    @Query("SELECT COALESCE(SUM(b.failedCount), 0) FROM EmailBatch b")
    long sumTotalFailedCount();

    @Query("SELECT COALESCE(SUM(b.pendingCount), 0) FROM EmailBatch b WHERE b.status IN ('PENDING', 'PROCESSING')")
    long sumTotalPendingCount();
}
