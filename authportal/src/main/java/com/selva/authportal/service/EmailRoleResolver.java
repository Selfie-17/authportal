package com.selva.authportal.service;

import com.selva.authportal.exception.InvalidInstitutionalEmailException;
import com.selva.authportal.model.Role;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Centralized service component responsible for determining roles based on institutional email rules.
 * <p>
 * Rules:
 * 1. Must end with @rguktn.ac.in
 * 2. Matches ^[Nn]\d{6}@rguktn\.ac\.in$ -> STUDENT
 * 3. Verified via TeacherEligibilityService -> TEACHER
 * 4. ADMIN is NEVER automatically assigned by email resolution.
 */
@Component
public class EmailRoleResolver {

    private final Pattern studentPattern;
    private final String institutionalDomain;
    private final TeacherEligibilityService teacherEligibilityService;

    public EmailRoleResolver(
            @Value("${app.auth.student-pattern:^[Nn]\\d{6}@rguktn\\.ac\\.in$}") String studentRegex,
            @Value("${app.auth.institutional-domain:rguktn.ac.in}") String institutionalDomain,
            TeacherEligibilityService teacherEligibilityService
    ) {
        this.studentPattern = Pattern.compile(studentRegex);
        this.institutionalDomain = institutionalDomain.toLowerCase();
        this.teacherEligibilityService = teacherEligibilityService;
    }

    /**
     * Resolves the appropriate system Role for the given email address.
     *
     * @param email The input email address
     * @return Role.STUDENT or Role.TEACHER
     * @throws InvalidInstitutionalEmailException if email is non-institutional or not eligible
     */
    public Role resolveRole(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new InvalidInstitutionalEmailException("Email address is required.");
        }

        String normalizedEmail = email.trim().toLowerCase();
        String domainSuffix = "@" + institutionalDomain;

        if (!normalizedEmail.endsWith(domainSuffix)) {
            throw new InvalidInstitutionalEmailException(
                    "Only institutional email addresses ending with @" + institutionalDomain + " are permitted."
            );
        }

        // Check student regex pattern (case-insensitive for N/n)
        if (studentPattern.matcher(email.trim()).matches()) {
            return Role.STUDENT;
        }

        // Check teacher eligibility
        if (teacherEligibilityService.isEligibleTeacher(normalizedEmail)) {
            return Role.TEACHER;
        }

        throw new InvalidInstitutionalEmailException(
                "Email address is not authorized for registration. Non-student accounts require explicit institutional authorization."
        );
    }

    /**
     * Helper to verify if an email belongs to the institutional domain.
     */
    public boolean isInstitutionalDomain(String email) {
        if (email == null) {
            return false;
        }
        return email.trim().toLowerCase().endsWith("@" + institutionalDomain);
    }
}
