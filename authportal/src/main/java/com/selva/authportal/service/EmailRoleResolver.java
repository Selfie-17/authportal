package com.selva.authportal.service;

import com.selva.authportal.exception.InvalidInstitutionalEmailException;
import com.selva.authportal.model.Role;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Centralized service component responsible for determining roles based on institutional email rules.
 * <p>
 * Local Registration Rules:
 * 1. Must end with @rguktn.ac.in
 * 2. Matches ^[Nn]\d{6}@rguktn\.ac\.in$ -> STUDENT
 * 3. Verified via TeacherEligibilityService -> TEACHER
 * 4. ADMIN is NEVER automatically assigned by email resolution.
 * <p>
 * Google OAuth Rules:
 * 1. Configured Google Admin emails -> ADMIN (strictly via Google OAuth, any domain)
 * 2. Matches ^[Nn]\d{6}@rguktn\.ac\.in$ -> STUDENT
 * 3. All other @rguktn.ac.in institutional emails -> TEACHER
 * 4. Unauthorized non-institutional Google accounts -> rejected
 */
@Component
public class EmailRoleResolver {

    private final Pattern studentPattern;
    private final String institutionalDomain;
    private final TeacherEligibilityService teacherEligibilityService;
    private final Set<String> googleAdminEmails;

    @Autowired
    public EmailRoleResolver(
            @Value("${app.auth.student-pattern:^[Nn]\\d{6}@rguktn\\.ac\\.in$}") String studentRegex,
            @Value("${app.auth.institutional-domain:rguktn.ac.in}") String institutionalDomain,
            TeacherEligibilityService teacherEligibilityService,
            @Value("${app.auth.google-admin-emails:uday@rguktn.ac.in,kampadevaselvaraj@gmail.com}") String googleAdminEmailsConfig
    ) {
        this.studentPattern = Pattern.compile(studentRegex);
        this.institutionalDomain = institutionalDomain.toLowerCase();
        this.teacherEligibilityService = teacherEligibilityService;
        if (googleAdminEmailsConfig == null || googleAdminEmailsConfig.trim().isEmpty()) {
            this.googleAdminEmails = Collections.emptySet();
        } else {
            this.googleAdminEmails = Arrays.stream(googleAdminEmailsConfig.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toUnmodifiableSet());
        }
    }

    public EmailRoleResolver(
            String studentRegex,
            String institutionalDomain,
            TeacherEligibilityService teacherEligibilityService
    ) {
        this(studentRegex, institutionalDomain, teacherEligibilityService, "uday@rguktn.ac.in,kampadevaselvaraj@gmail.com");
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

    /**
     * Checks whether an email is configured as an authorized Google OAuth Administrator.
     * Can belong to any email domain.
     */
    public boolean isGoogleAdmin(String email) {
        if (email == null) {
            return false;
        }
        return googleAdminEmails.contains(email.trim().toLowerCase());
    }

    /**
     * Verifies if an email is permitted to authenticate via Google OAuth.
     * Allowed if the email is a configured Google Admin OR belongs to the institutional domain.
     */
    public boolean isAllowedOAuthEmail(String email) {
        if (email == null) {
            return false;
        }
        String normalizedEmail = email.trim().toLowerCase();
        return isGoogleAdmin(normalizedEmail) || isInstitutionalDomain(normalizedEmail);
    }

    /**
     * Resolves the system Role specifically for Google OAuth logins.
     * Rules:
     * 1. Configured Google Admin accounts -> ADMIN
     * 2. Non-admin accounts strictly require institutional domain (@rguktn.ac.in)
     * 3. N/n followed by 6 digits institutional email -> STUDENT
     * 4. Any other institutional email -> TEACHER
     *
     * @param email The Google authenticated email address
     * @return Resolved Role (ADMIN, STUDENT, or TEACHER)
     * @throws InvalidInstitutionalEmailException if not allowed to authenticate via OAuth
     */
    public Role resolveOAuthRole(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new InvalidInstitutionalEmailException("Email address is required.");
        }

        String normalizedEmail = email.trim().toLowerCase();

        // 1. Google OAuth Admin check (any domain allowed)
        if (isGoogleAdmin(normalizedEmail)) {
            return Role.ADMIN;
        }

        // 2. Non-admin accounts strictly require institutional domain
        if (!isInstitutionalDomain(normalizedEmail)) {
            throw new InvalidInstitutionalEmailException(
                    "Access denied. Only @" + institutionalDomain + " institutional accounts and authorized administrators are permitted to sign in with Google."
            );
        }

        // 3. Student pattern check (N/n + 6 digits)
        if (studentPattern.matcher(email.trim()).matches()) {
            return Role.STUDENT;
        }

        // 4. All other @rguktn.ac.in accounts are automatically assigned TEACHER for Google OAuth
        return Role.TEACHER;
    }
}
