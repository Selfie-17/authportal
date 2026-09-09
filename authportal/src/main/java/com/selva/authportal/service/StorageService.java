package com.selva.authportal.service;

import java.io.IOException;
import java.io.InputStream;

/**
 * Storage abstraction for student submissions and academic artifacts.
 * Completely decouples business services (Submission, ZipArchive, Admin)
 * from the underlying physical storage mechanism (Local Filesystem, Google Cloud Storage, etc.).
 */
public interface StorageService {

    /**
     * Stores an input stream at the designated storage key.
     *
     * @param inputStream Source data stream
     * @param storageKey  Canonical storage key (e.g. "submissions/week-1/sec-1/N210001/main.c")
     * @param contentType MIME content type of the file
     * @param sizeBytes   Size in bytes
     * @return Unique stored file identifier (canonical storageKey)
     * @throws IOException If storage write fails
     */
    String storeFile(InputStream inputStream, String storageKey, String contentType, long sizeBytes) throws IOException;

    /**
     * Opens an InputStream to read the file stored at the given storage key.
     *
     * @param storageKey Canonical storage key
     * @return InputStream to the content
     * @throws IOException If file does not exist or stream cannot be opened
     */
    InputStream openStream(String storageKey) throws IOException;

    /**
     * Checks if a file or object exists at the specified storage key.
     *
     * @param storageKey Canonical storage key
     * @return true if the object exists and is readable, false otherwise
     */
    boolean fileExists(String storageKey);

    /**
     * Deletes a single file at the specified storage key.
     *
     * @param storageKey Canonical storage key
     * @throws IOException If deletion fails
     */
    void deleteFile(String storageKey) throws IOException;

    /**
     * Deletes all files matching the given directory or prefix.
     * (e.g. "submissions/week-1/sec-1/N210001")
     *
     * @param prefix Canonical prefix to purge
     * @throws IOException If deletion fails
     */
    void deletePrefix(String prefix) throws IOException;
}
