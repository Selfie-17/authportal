package com.selva.authportal.dto;

import java.util.List;

public record SubmissionPageResponse(List<SubmissionResponse> submissions, long totalItems) {
}
