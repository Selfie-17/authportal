package com.selva.authportal.dto;

import java.util.List;

public record EmailHistoryPageResponse(List<EmailHistoryItemDTO> items, long totalItems) {
}
