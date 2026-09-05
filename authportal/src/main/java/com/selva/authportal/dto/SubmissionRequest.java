package com.selva.authportal.dto;

import com.selva.authportal.model.YearLevel;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.*;

/**
 * Metadata payload for student lab submissions.
 * Sent as part of multipart/form-data request along with uploaded files.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionRequest {

    @NotBlank(message = "Student ID is required")
    @Pattern(regexp = "^[Nn]\\d{6}$", message = "Student ID must follow institutional format (e.g. N210001)")
    private String studentId;

    @NotNull(message = "Week number is required")
    @Min(value = 1, message = "Week must be between 1 and 12")
    @Max(value = 12, message = "Week must be between 1 and 12")
    private Integer week;

    @NotNull(message = "Year level is required")
    private YearLevel year;

    @NotNull(message = "Section number is required")
    @Min(value = 1, message = "Section must be between 1 and 6")
    @Max(value = 6, message = "Section must be between 1 and 6")
    private Integer section;
}
