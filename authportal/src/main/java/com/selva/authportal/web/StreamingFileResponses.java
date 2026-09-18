package com.selva.authportal.web;

import com.selva.authportal.exception.ClientDisconnectDetector;
import com.selva.authportal.service.SubmissionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;

/**
 * Builds binary streaming HTTP responses so downloads never pass through Jackson.
 * The storage InputStream stays open until transferTo completes, then is closed.
 */
@Slf4j
public final class StreamingFileResponses {

    private StreamingFileResponses() {
    }

    public static ResponseEntity<StreamingResponseBody> from(
            SubmissionService.DownloadableFile downloadable,
            boolean asAttachment
    ) {
        String disposition = (asAttachment ? "attachment" : "inline")
                + "; filename=\"" + downloadable.filename() + "\"";

        StreamingResponseBody body = outputStream -> {
            try (InputStream in = downloadable.resource().getInputStream()) {
                in.transferTo(outputStream);
                outputStream.flush();
            } catch (IOException ex) {
                if (ClientDisconnectDetector.isClientAbort(ex)) {
                    log.info("Client aborted file download filename={}", downloadable.filename());
                    return;
                }
                throw ex;
            }
        };

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(downloadable.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Accel-Buffering", "no")
                .body(body);
    }
}
