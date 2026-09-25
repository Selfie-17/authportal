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
    private final Set<String> institutionalDomains;
    private final TeacherEligibilityService teacherEligibilityService;
    private final Set<String> googleAdminEmails;

    @Autowired
    public EmailRoleResolver(
            @Value("${app.auth.student-pattern:^[A-Za-z]\\d{6}@(rguktn\\.ac\\.in|rguktrkv\\.ac\\.in|rguktong\\.ac\\.in|rguktsklm\\.ac\\.in|rgukt\\.in)$}") String studentRegex,
            @Value("${app.auth.institutional-domains:${app.auth.institutional-domain:rguktn.ac.in,rguktrkv.ac.in,rguktong.ac.in,rguktsklm.ac.in,rgukt.in}}") String institutionalDomainsConfig,
            TeacherEligibilityService teacherEligibilityService,
            @Value("${app.auth.google-admin-emails:uday@rguktn.ac.in,kampadevaselvaraj@gmail.com}") String googleAdminEmailsConfig
    ) {
        this.studentPattern = Pattern.compile(studentRegex, Pattern.CASE_INSENSITIVE);
        this.teacherEligibilityService = teacherEligibilityService;

        if (institutionalDomainsConfig == null || institutionalDomainsConfig.trim().isEmpty()) {
            this.institutionalDomains = Set.of("rguktn.ac.in", "rguktrkv.ac.in", "rguktong.ac.in", "rguktsklm.ac.in", "rgukt.in");
        } else {
            this.institutionalDomains = Arrays.stream(institutionalDomainsConfig.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .map(d -> d.startsWith("@") ? d.substring(1) : d)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.collectingAndThen(Collectors.toCollection(java.util.LinkedHashSet::new), Collections::unmodifiableSet));
        }

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
            String institutionalDomainsConfig,
            TeacherEligibilityService teacherEligibilityService
    ) {
        this(studentRegex, institutionalDomainsConfig, teacherEligibilityService, "uday@rguktn.ac.in,kampadevaselvaraj@gmail.com");
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

        if (!isInstitutionalDomain(normalizedEmail)) {
            String domainDisplay = institutionalDomains.size() == 1
                    ? "@" + institutionalDomains.iterator().next()
                    : institutionalDomains.stream().map(d -> "@" + d).collect(Collectors.joining(", "));
            throw new InvalidInstitutionalEmailException(
                    "Only institutional email addresses ending with " + domainDisplay + " are permitted."
            );
        }

        // Check student regex pattern (case-insensitive)
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
     * Helper to verify if an email belongs to an approved institutional domain.
     */
    public boolean isInstitutionalDomain(String email) {
        if (email == null) {
            return false;
        }
        String normalizedEmail = email.trim().toLowerCase();
        return institutionalDomains.stream().anyMatch(domain -> normalizedEmail.endsWith("@" + domain));
    }

    /**
     * Returns an unmodifiable set of the allowed institutional domains.
     */
    public Set<String> getInstitutionalDomains() {
        return institutionalDomains;
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
     * Allowed if the email is a configured Google Admin OR belongs to an institutional domain.
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
     * 2. Non-admin accounts strictly require an approved institutional domain
     * 3. Campus prefix followed by 6 digits institutional email -> STUDENT
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
            String domainDisplay = institutionalDomains.stream().map(d -> "@" + d).collect(Collectors.joining(", "));
            throw new InvalidInstitutionalEmailException(
                    "Access denied. Only institutional accounts (" + domainDisplay + ") and authorized administrators are permitted to sign in with Google."
            );
        }

        // 3. Student pattern check
        if (studentPattern.matcher(email.trim()).matches()) {
            return Role.STUDENT;
        }

        // 4. All other institutional accounts are automatically assigned TEACHER for Google OAuth
        return Role.TEACHER;
    }
}
