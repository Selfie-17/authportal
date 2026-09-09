package com.selva.authportal.config;

import lombok.Getter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration properties for Backblaze B2 S3-compatible cloud storage.
 * Mapped to environment variables:
 * - B2_ENDPOINT        -> app.storage.backblaze.endpoint
 * - B2_BUCKET_NAME     -> app.storage.backblaze.bucket-name
 * - B2_KEY_ID          -> app.storage.backblaze.key-id
 * - B2_APPLICATION_KEY -> app.storage.backblaze.application-key
 * - B2_REGION          -> app.storage.backblaze.region
 */
@Getter
@ConfigurationProperties(prefix = "app.storage.backblaze")
public class BackblazeStorageProperties {

    private final String endpoint;
    private final String bucketName;
    private final String keyId;
    private final String applicationKey;
    private final String region;

    @ConstructorBinding
    public BackblazeStorageProperties(
            @DefaultValue("https://s3.us-east-005.backblazeb2.com") String endpoint,
            @DefaultValue("rguktn-academic-portal") String bucketName,
            @DefaultValue("") String keyId,
            @DefaultValue("") String applicationKey,
            @DefaultValue("us-east-005") String region
    ) {
        this.endpoint = (endpoint != null && !endpoint.trim().isEmpty())
                ? endpoint.trim()
                : "https://s3.us-east-005.backblazeb2.com";
        this.bucketName = (bucketName != null && !bucketName.trim().isEmpty())
                ? bucketName.trim()
                : "rguktn-academic-portal";
        this.keyId = keyId != null ? keyId.trim() : "";
        this.applicationKey = applicationKey != null ? applicationKey.trim() : "";
        this.region = (region != null && !region.trim().isEmpty())
                ? region.trim()
                : "us-east-005";
    }
}
