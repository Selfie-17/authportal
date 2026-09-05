package com.selva.authportal.dto;

import com.selva.authportal.model.Role;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * DTO for updating a user's role.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateRoleRequest {

    @NotNull(message = "Role is required.")
    private Role role;
}
