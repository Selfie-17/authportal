package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Server-side paginated response matching the exact pagination contract:
 * {
 *   "content": [],
 *   "currentPage": 0,
 *   "pageSize": 20,
 *   "totalElements": 100,
 *   "totalPages": 5
 * }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherSubmissionPageResponse {

    private List<TeacherSubmissionRecordDTO> content;
    private int currentPage;
    private int pageSize;
    private long totalElements;
    private int totalPages;
}
