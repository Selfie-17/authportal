package com.selva.authportal.dto;

import com.selva.authportal.model.Submission;
import com.selva.authportal.model.SubmissionStatus;
import com.selva.authportal.model.YearLevel;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Data transfer object representing a complete lab submission with its files.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionResponse {

    private Long id;
    private Long userId;
    private String userName;
    private String userEmail;
    private String studentId;
    private Integer week;
    private YearLevel year;
    private Integer section;
    private SubmissionStatus status;
    private Integer version;
    private List<SubmissionFileDTO> files;
    private Instant createdAt;
    private Instant updatedAt;

    public static SubmissionResponse fromEntity(Submission submission) {
        return SubmissionResponse.builder()
                .id(submission.getId())
                .userId(submission.getUser().getId())
                .userName(submission.getUser().getName())
                .userEmail(submission.getUser().getEmail())
                .studentId(submission.getStudentId())
                .week(submission.getWeek())
                .year(submission.getYear())
                .section(submission.getSection())
                .status(submission.getStatus())
                .version(submission.getVersion())
                .createdAt(submission.getCreatedAt())
                .updatedAt(submission.getUpdatedAt())
                .files(submission.getFiles() != null ? submission.getFiles().stream()
                        .map(file -> SubmissionFileDTO.builder()
                                .id(file.getId())
                                .originalFilename(file.getOriginalFilename())
                                .fileExtension(file.getFileExtension())
                                .fileType(file.getFileType())
                                .fileSizeBytes(file.getFileSizeBytes())
                                .createdAt(file.getCreatedAt())
                                .build())
                        .collect(Collectors.toList()) : List.of())
                .build();
    }
}
