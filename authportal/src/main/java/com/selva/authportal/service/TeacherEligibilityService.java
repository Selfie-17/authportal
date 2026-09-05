package com.selva.authportal.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service responsible for verifying teacher eligibility.
 * Non-student institutional accounts are NOT automatically treated as teachers.
 * Configured via allowlist, designed to be seamlessly upgraded to a database-backed table.
 */
@Service
public class TeacherEligibilityService {

    private final Set<String> allowedTeacherEmails;

    public TeacherEligibilityService(
            @Value("${app.auth.teacher-allowed-emails:}") String allowedEmailsConfig
    ) {
        if (allowedEmailsConfig == null || allowedEmailsConfig.trim().isEmpty()) {
            this.allowedTeacherEmails = Collections.emptySet();
        } else {
            this.allowedTeacherEmails = Arrays.stream(allowedEmailsConfig.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toUnmodifiableSet());
        }
    }

    /**
     * Checks whether an institutional email address is verified as eligible for the TEACHER role.
     *
     * @param email The normalized institutional email address
     * @return true if the email is on the teacher eligibility allowlist, false otherwise
     */
    public boolean isEligibleTeacher(String email) {
        if (email == null) {
            return false;
        }
        return allowedTeacherEmails.contains(email.trim().toLowerCase());
    }
}
