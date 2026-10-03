package com.selva.authportal.repository;

import com.selva.authportal.model.EmailAutomationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmailAutomationConfigRepository extends JpaRepository<EmailAutomationConfig, Long> {

    Optional<EmailAutomationConfig> findFirstByOrderByIdAsc();
}
