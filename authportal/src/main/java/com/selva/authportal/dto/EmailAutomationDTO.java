package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailAutomationDTO {
    private Long id;
    private Boolean enabled;
    private String triggerType;
    private String academicYear;
    private String branch;
    private String section;
    private String week;
    private String reportFormat;
    private String provider;
    private String updatedBy;
    private Instant updatedAt;
}
