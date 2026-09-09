package com.selva.authportal;

import com.selva.authportal.service.storage.BackblazeB2StorageService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "app.storage.type=backblaze",
        "app.storage.backblaze.key-id=test-key-id",
        "app.storage.backblaze.application-key=test-app-key",
        "app.storage.backblaze.bucket-name=test-bucket"
})
class BackblazeContextLoadTest {

    @Autowired(required = false)
    private BackblazeB2StorageService backblazeB2StorageService;

    @Test
    @DisplayName("Should successfully instantiate BackblazeB2StorageService bean via Spring autowiring when storage.type=backblaze")
    void shouldInstantiateBackblazeB2StorageServiceBean() {
        assertThat(backblazeB2StorageService).isNotNull();
        assertThat(backblazeB2StorageService.getBucketName()).isEqualTo("test-bucket");
    }
}
