package com.selva.authportal.dto;

import com.selva.authportal.model.FileType;
import lombok.*;

import java.time.Instant;

/**
 * Data transfer object representing an individual submitted file.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionFileDTO {

    private Long id;
    private String originalFilename;
    private String fileExtension;
    private FileType fileType;
    private Long fileSizeBytes;
    private Instant createdAt;
}
