package com.selva.authportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EvaluationUploadResponse {
    private boolean success;
    private String message;
    private int processedCount;
    @Builder.Default
    private List<String> weeks = new ArrayList<>();
}
