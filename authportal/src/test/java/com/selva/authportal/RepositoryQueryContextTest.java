package com.selva.authportal;

import com.selva.authportal.model.User;
import com.selva.authportal.repository.EmailBatchRecipientRepository;
import com.selva.authportal.repository.SubmissionRepository;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RepositoryQueryContextTest.Config.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = {
        "spring.config.import=",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.jpa.database-platform=org.hibernate.dialect.MySQLDialect",
        "spring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false"
})
class RepositoryQueryContextTest {

    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = User.class)
    @EnableJpaRepositories(basePackageClasses = UserRepository.class)
    static class Config {
    }

    @Test
    void initializesPagedRepositoriesAndTransactionTemplate(
            @Autowired UserRepository users,
            @Autowired SubmissionRepository submissions,
            @Autowired EmailBatchRecipientRepository recipients,
            @Autowired TransactionTemplate transactions) {
        assertThat(users).isNotNull();
        assertThat(submissions).isNotNull();
        assertThat(recipients).isNotNull();
        assertThat(transactions).isNotNull();
    }
}
