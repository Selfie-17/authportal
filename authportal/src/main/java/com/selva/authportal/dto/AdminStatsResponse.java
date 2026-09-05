package com.selva.authportal.dto;

import lombok.*;

/**
 * Aggregated statistics for the administrator dashboard.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminStatsResponse {

    private long totalUsers;
    private long studentCount;
    private long teacherCount;
    private long adminCount;
    private long totalSubmissions;
}
