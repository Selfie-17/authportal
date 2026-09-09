package com.selva.authportal.service;

import com.selva.authportal.service.storage.BackblazeB2StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.AbortableInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.paginators.ListObjectsV2Iterable;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BackblazeB2StorageServiceTest {

    private static final String BUCKET_NAME = "rguktn-academic-portal";

    @Mock
    private S3Client mockS3Client;

    private BackblazeB2StorageService storageService;

    @BeforeEach
    void setUp() {
        storageService = new BackblazeB2StorageService(mockS3Client, BUCKET_NAME);
    }

    @Test
    @DisplayName("Should upload file to Backblaze B2 using PutObjectRequest and return canonical storageKey")
    void shouldUploadFileToBackblazeB2() throws IOException {
        String key = "submissions/week-1/sec-2/N210001/main.c";
        byte[] content = "#include <stdio.h>\nint main(){return 0;}".getBytes(StandardCharsets.UTF_8);

        when(mockS3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().build());

        String returnedKey = storageService.storeFile(
                new ByteArrayInputStream(content),
                key,
                "text/x-c",
                content.length
        );

        assertThat(returnedKey).isEqualTo(key);

        ArgumentCaptor<PutObjectRequest> putCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(mockS3Client).putObject(putCaptor.capture(), any(RequestBody.class));

        PutObjectRequest capturedRequest = putCaptor.getValue();
        assertThat(capturedRequest.bucket()).isEqualTo(BUCKET_NAME);
        assertThat(capturedRequest.key()).isEqualTo(key);
        assertThat(capturedRequest.contentType()).isEqualTo("text/x-c");
        assertThat(capturedRequest.contentLength()).isEqualTo((long) content.length);
    }

    @Test
    @DisplayName("Should open stream for existing object from Backblaze B2")
    void shouldOpenStreamFromBackblazeB2() throws IOException {
        String key = "submissions/week-1/sec-2/N210001/report.pdf";
        byte[] content = "%PDF-1.4 Mock PDF Content".getBytes(StandardCharsets.UTF_8);

        GetObjectResponse getResponse = GetObjectResponse.builder()
                .contentLength((long) content.length)
                .contentType("application/pdf")
                .build();
        ResponseInputStream<GetObjectResponse> s3Stream = new ResponseInputStream<>(
                getResponse,
                AbortableInputStream.create(new ByteArrayInputStream(content))
        );

        when(mockS3Client.getObject(any(GetObjectRequest.class))).thenReturn(s3Stream);

        try (InputStream stream = storageService.openStream(key)) {
            byte[] readBytes = stream.readAllBytes();
            assertThat(new String(readBytes, StandardCharsets.UTF_8)).isEqualTo("%PDF-1.4 Mock PDF Content");
        }

        ArgumentCaptor<GetObjectRequest> getCaptor = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(mockS3Client).getObject(getCaptor.capture());
        assertThat(getCaptor.getValue().bucket()).isEqualTo(BUCKET_NAME);
        assertThat(getCaptor.getValue().key()).isEqualTo(key);
    }

    @Test
    @DisplayName("Should throw FileNotFoundException when object does not exist in Backblaze B2")
    void shouldHandleMissingObjectOnOpenStream() {
        String key = "submissions/week-1/sec-2/N210001/missing.c";

        when(mockS3Client.getObject(any(GetObjectRequest.class)))
                .thenThrow(NoSuchKeyException.builder().message("The specified key does not exist.").build());

        assertThatThrownBy(() -> storageService.openStream(key))
                .isInstanceOf(FileNotFoundException.class)
                .hasMessageContaining("Backblaze B2 object not found");
    }

    @Test
    @DisplayName("Should verify file existence correctly (true on found, false on NoSuchKeyException or 404)")
    void shouldVerifyFileExists() {
        String existingKey = "submissions/week-1/sec-2/N210001/main.c";
        String missingKey = "submissions/week-1/sec-2/N210001/none.c";

        when(mockS3Client.headObject(argThat((HeadObjectRequest req) -> req != null && req.key().equals(existingKey))))
                .thenReturn(HeadObjectResponse.builder().build());
        when(mockS3Client.headObject(argThat((HeadObjectRequest req) -> req != null && req.key().equals(missingKey))))
                .thenThrow(NoSuchKeyException.builder().message("Not found").build());

        assertThat(storageService.fileExists(existingKey)).isTrue();
        assertThat(storageService.fileExists(missingKey)).isFalse();
        assertThat(storageService.fileExists("")).isFalse();
        assertThat(storageService.fileExists(null)).isFalse();
    }

    @Test
    @DisplayName("Should delete single object from Backblaze B2")
    void shouldDeleteSingleFile() throws IOException {
        String key = "submissions/week-1/sec-2/N210001/main.c";

        when(mockS3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        storageService.deleteFile(key);

        ArgumentCaptor<DeleteObjectRequest> deleteCaptor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(mockS3Client).deleteObject(deleteCaptor.capture());
        assertThat(deleteCaptor.getValue().bucket()).isEqualTo(BUCKET_NAME);
        assertThat(deleteCaptor.getValue().key()).isEqualTo(key);
    }

    @Test
    @DisplayName("Should delete all objects under prefix in Backblaze B2 using DeleteObjects")
    void shouldDeletePrefixInBatches() throws IOException {
        String prefix = "submissions/week-1/sec-2/N210001";

        S3Object obj1 = S3Object.builder().key("submissions/week-1/sec-2/N210001/main.c").build();
        S3Object obj2 = S3Object.builder().key("submissions/week-1/sec-2/N210001/report.pdf").build();

        ListObjectsV2Response page = ListObjectsV2Response.builder()
                .contents(List.of(obj1, obj2))
                .isTruncated(false)
                .build();

        ListObjectsV2Iterable mockPaginator = mock(ListObjectsV2Iterable.class);
        when(mockPaginator.iterator()).thenReturn(Collections.singletonList(page).iterator());
        when(mockS3Client.listObjectsV2Paginator(any(ListObjectsV2Request.class))).thenReturn(mockPaginator);

        when(mockS3Client.deleteObjects(any(DeleteObjectsRequest.class)))
                .thenReturn(DeleteObjectsResponse.builder().build());

        storageService.deletePrefix(prefix);

        ArgumentCaptor<DeleteObjectsRequest> deleteCaptor = ArgumentCaptor.forClass(DeleteObjectsRequest.class);
        verify(mockS3Client).deleteObjects(deleteCaptor.capture());

        DeleteObjectsRequest capturedDelete = deleteCaptor.getValue();
        assertThat(capturedDelete.bucket()).isEqualTo(BUCKET_NAME);
        assertThat(capturedDelete.delete().objects()).hasSize(2);
        assertThat(capturedDelete.delete().objects().get(0).key()).isEqualTo("submissions/week-1/sec-2/N210001/main.c");
        assertThat(capturedDelete.delete().objects().get(1).key()).isEqualTo("submissions/week-1/sec-2/N210001/report.pdf");
    }

    @Test
    @DisplayName("Should handle null or empty prefix safely without calling S3")
    void shouldHandleEmptyPrefixSafely() throws IOException {
        storageService.deletePrefix(null);
        storageService.deletePrefix("   ");

        verify(mockS3Client, never()).listObjectsV2Paginator(any(ListObjectsV2Request.class));
        verify(mockS3Client, never()).deleteObjects(any(DeleteObjectsRequest.class));
    }
}
