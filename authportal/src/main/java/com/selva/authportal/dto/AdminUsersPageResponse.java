package com.selva.authportal.dto;

import java.util.List;

public record AdminUsersPageResponse(List<UserResponse> users, long totalItems) {
}
