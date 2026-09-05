package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

/**
 * DTO for user profile updates.
 * Only non-security fields (such as display name and avatar) may be modified.
 * Role and email modifications are strictly prohibited here.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateProfileRequest {

    @NotBlank(message = "Full name cannot be blank.")
    private String name;

    private String profilePicture;
}
