package com.selva.authportal.service.storage;

import com.selva.authportal.config.BackblazeStorageProperties;
import com.selva.authportal.service.StorageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.paginators.ListObjectsV2Iterable;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * Backblaze B2 Cloud Storage Provider implementing StorageService.
 * Connects to Backblaze B2 via its S3-compatible API using AWS SDK for Java v2 (S3Client).
 *
 * Uses path-style access and stream-based direct transfers without local staging.
 * Activated when app.storage.type=backblaze.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "backblaze")
public class BackblazeB2StorageService implements StorageService {

    private final S3Client s3Client;
    private final String bucketName;

    public BackblazeB2StorageService(BackblazeStorageProperties properties) {
        this.bucketName = properties.getBucketName();

        URI endpointUri = URI.create(properties.getEndpoint());
        Region region = Region.of(properties.getRegion());
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                properties.getKeyId(),
                properties.getApplicationKey()
        );

        this.s3Client = S3Client.builder()
                .endpointOverride(endpointUri)
                .region(region)
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();

        log.info("Initialized BackblazeB2StorageService for bucket '{}' at endpoint '{}' [region: {}]",
                this.bucketName, properties.getEndpoint(), properties.getRegion());
    }

    /**
     * Public constructor for unit testing or custom S3Client wiring.
     */
    public BackblazeB2StorageService(S3Client s3Client, String bucketName) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }

    @Override
    public String storeFile(InputStream inputStream, String storageKey, String contentType, long sizeBytes) throws IOException {
        validateKey(storageKey);
        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .contentType(contentType != null ? contentType : "application/octet-stream")
                    .contentLength(sizeBytes)
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(inputStream, sizeBytes));
            log.info("Stored file in Backblaze B2: key={}, sizeBytes={}", storageKey, sizeBytes);
            return storageKey;
        } catch (S3Exception e) {
            log.error("Failed to store file in Backblaze B2: key={}, status={}, error={}",
                    storageKey, e.statusCode(), e.awsErrorDetails() != null ? e.awsErrorDetails().errorMessage() : e.getMessage());
            throw new IOException("Failed to upload file to Backblaze B2 storage: " + storageKey, e);
        }
    }

    @Override
    public InputStream openStream(String storageKey) throws IOException {
        validateKey(storageKey);
        try {
            GetObjectRequest getRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();

            return s3Client.getObject(getRequest);
        } catch (NoSuchKeyException e) {
            log.warn("File not found in Backblaze B2: key={}", storageKey);
            throw new FileNotFoundException("Backblaze B2 object not found: " + storageKey);
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                log.warn("File not found in Backblaze B2 (404): key={}", storageKey);
                throw new FileNotFoundException("Backblaze B2 object not found: " + storageKey);
            }
            log.error("Failed to open stream from Backblaze B2: key={}, status={}, error={}",
                    storageKey, e.statusCode(), e.awsErrorDetails() != null ? e.awsErrorDetails().errorMessage() : e.getMessage());
            throw new IOException("Failed to read file from Backblaze B2 storage: " + storageKey, e);
        }
    }

    @Override
    public boolean fileExists(String storageKey) {
        if (storageKey == null || storageKey.trim().isEmpty()) {
            return false;
        }
        try {
            HeadObjectRequest headRequest = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();

            s3Client.headObject(headRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            log.warn("Error checking file existence in Backblaze B2: key={}, status={}", storageKey, e.statusCode());
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void deleteFile(String storageKey) throws IOException {
        if (storageKey == null || storageKey.trim().isEmpty()) {
            return;
        }
        try {
            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storageKey)
                    .build();

            s3Client.deleteObject(deleteRequest);
            log.info("Deleted object from Backblaze B2: key={}", storageKey);
        } catch (S3Exception e) {
            log.error("Failed to delete object from Backblaze B2: key={}, status={}", storageKey, e.statusCode());
            throw new IOException("Failed to delete file from Backblaze B2: " + storageKey, e);
        }
    }

    @Override
    public void deletePrefix(String prefix) throws IOException {
        if (prefix == null || prefix.trim().isEmpty()) {
            return;
        }
        String normalizedPrefix = prefix.trim();
        try {
            ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .prefix(normalizedPrefix)
                    .build();

            ListObjectsV2Iterable pages = s3Client.listObjectsV2Paginator(listRequest);
            List<ObjectIdentifier> toDelete = new ArrayList<>();

            for (ListObjectsV2Response page : pages) {
                if (page.contents() != null) {
                    for (S3Object s3Object : page.contents()) {
                        toDelete.add(ObjectIdentifier.builder().key(s3Object.key()).build());
                    }
                }
            }

            if (!toDelete.isEmpty()) {
                for (int i = 0; i < toDelete.size(); i += 1000) {
                    List<ObjectIdentifier> batch = toDelete.subList(i, Math.min(i + 1000, toDelete.size()));
                    DeleteObjectsRequest deleteObjectsRequest = DeleteObjectsRequest.builder()
                            .bucket(bucketName)
                            .delete(Delete.builder().objects(batch).build())
                            .build();
                    s3Client.deleteObjects(deleteObjectsRequest);
                }
                log.info("Purged {} objects under prefix '{}' in Backblaze B2", toDelete.size(), normalizedPrefix);
            }
        } catch (S3Exception e) {
            log.error("Failed to delete prefix '{}' from Backblaze B2: status={}", normalizedPrefix, e.statusCode());
            throw new IOException("Failed to purge prefix from Backblaze B2: " + normalizedPrefix, e);
        }
    }

    private void validateKey(String key) {
        if (key == null || key.trim().isEmpty()) {
            throw new IllegalArgumentException("Storage key cannot be empty.");
        }
    }

    public String getBucketName() {
        return bucketName;
    }
}
