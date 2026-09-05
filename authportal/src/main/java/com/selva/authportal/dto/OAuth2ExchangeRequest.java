package com.selva.authportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for exchanging a one-time OAuth authorization code for a JWT.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OAuth2ExchangeRequest {

    @NotBlank(message = "Exchange code is required")
    private String code;
}
