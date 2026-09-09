package com.selva.authportal.service.storage;

import com.selva.authportal.service.StorageService;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Comparator;
import java.util.stream.Stream;

/**
 * Local filesystem implementation of StorageService.
 * Stores files under the configured root directory (default: ./storage).
 * Enforces strict path traversal defenses to prevent root escape.
 */
@Slf4j
@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    private final Path rootLocation;

    public LocalStorageService(@Value("${app.storage.base-path:storage}") String basePath) {
        this.rootLocation = Paths.get(basePath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(rootLocation);
            log.info("Initialized LocalStorageService root at: {}", rootLocation);
        } catch (IOException e) {
            throw new IllegalStateException("Could not initialize local storage directory: " + rootLocation, e);
        }
    }

    @Override
    public String storeFile(InputStream inputStream, String storageKey, String contentType, long sizeBytes) throws IOException {
        Path destinationPath = resolveAndValidate(storageKey);

        if (destinationPath.getParent() != null) {
            Files.createDirectories(destinationPath.getParent());
        }

        Files.copy(inputStream, destinationPath, StandardCopyOption.REPLACE_EXISTING);
        log.debug("Stored file locally at: {}", destinationPath);
        return storageKey;
    }

    @Override
    public InputStream openStream(String storageKey) throws IOException {
        Path filePath = resolveAndValidate(storageKey);

        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new FileNotFoundException("Local file not found: " + storageKey);
        }

        return Files.newInputStream(filePath);
    }

    @Override
    public boolean fileExists(String storageKey) {
        try {
            Path filePath = resolveAndValidate(storageKey);
            return Files.exists(filePath) && Files.isRegularFile(filePath);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public void deleteFile(String storageKey) throws IOException {
        Path filePath = resolveAndValidate(storageKey);
        Files.deleteIfExists(filePath);
        log.debug("Deleted local file: {}", filePath);
    }

    @Override
    public void deletePrefix(String prefix) throws IOException {
        if (prefix == null || prefix.trim().isEmpty()) {
            return;
        }
        Path targetPath = resolveAndValidate(prefix);

        if (!Files.exists(targetPath)) {
            return;
        }

        if (Files.isDirectory(targetPath)) {
            try (Stream<Path> stream = Files.walk(targetPath)) {
                stream.sorted(Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                Files.delete(p);
                            } catch (IOException e) {
                                log.warn("Failed to delete path during directory purge: {}", p, e);
                            }
                        });
            }
            log.info("Purged local directory: {}", targetPath);
        } else {
            Files.deleteIfExists(targetPath);
            log.info("Deleted local path: {}", targetPath);
        }
    }

    private Path resolveAndValidate(String relativeKey) {
        if (relativeKey == null || relativeKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Storage key cannot be empty.");
        }

        Path resolved = rootLocation.resolve(relativeKey).normalize();

        // Path traversal defense
        if (!resolved.startsWith(rootLocation)) {
            throw new SecurityException("Potential path traversal attempt detected for key: " + relativeKey);
        }

        return resolved;
    }

    public Path getRootLocation() {
        return rootLocation;
    }
}
