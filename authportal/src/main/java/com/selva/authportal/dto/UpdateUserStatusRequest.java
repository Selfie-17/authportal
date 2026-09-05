package com.selva.authportal.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * DTO for enabling or disabling user accounts.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserStatusRequest {

    @NotNull(message = "Enabled status is required.")
    private Boolean enabled;
}
