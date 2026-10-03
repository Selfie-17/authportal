package com.selva.authportal.event;

/**
 * Event published when teacher feedback is saved or updated for a student.
 */
public record FeedbackSavedEvent(String studentId, String week) {
}
