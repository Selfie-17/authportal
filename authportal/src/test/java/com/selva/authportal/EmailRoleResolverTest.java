package com.selva.authportal;

import com.selva.authportal.exception.InvalidInstitutionalEmailException;
import com.selva.authportal.model.Role;
import com.selva.authportal.service.EmailRoleResolver;
import com.selva.authportal.service.TeacherEligibilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class EmailRoleResolverTest {

    private EmailRoleResolver emailRoleResolver;

    @BeforeEach
    void setUp() {
        TeacherEligibilityService teacherEligibilityService = new TeacherEligibilityService(
                "hod.cse@rguktn.ac.in,dean@rguktn.ac.in,faculty@rguktn.ac.in"
        );
        emailRoleResolver = new EmailRoleResolver(
                "^[Nn]\\d{6}@rguktn\\.ac\\.in$",
                "rguktn.ac.in",
                teacherEligibilityService
        );
    }

    @ParameterizedTest(name = "Valid Student Email: {0}")
    @ValueSource(strings = {
            "N210921@rguktn.ac.in",
            "n210921@rguktn.ac.in",
            "N220001@rguktn.ac.in",
            "n250123@rguktn.ac.in",
            "N123456@rguktn.ac.in",
            "n999999@rguktn.ac.in"
    })
    @DisplayName("Should resolve valid student emails to STUDENT role")
    void testValidStudentEmails(String email) {
        Role resolved = emailRoleResolver.resolveRole(email);
        assertEquals(Role.STUDENT, resolved);
    }

    @ParameterizedTest(name = "Invalid Student Format: {0}")
    @ValueSource(strings = {
            "N21092@rguktn.ac.in",     // 5 digits
            "N2109211@rguktn.ac.in",   // 7 digits
            "A210921@rguktn.ac.in",    // starts with A
            "210921@rguktn.ac.in",     // missing N prefix
            "NN210921@rguktn.ac.in"    // double N
    })
    @DisplayName("Should reject invalid student formats as unverified institutional users")
    void testInvalidStudentFormats(String email) {
        assertThrows(InvalidInstitutionalEmailException.class, () -> emailRoleResolver.resolveRole(email));
    }

    @ParameterizedTest(name = "Non-Institutional Email: {0}")
    @ValueSource(strings = {
            "N210921@gmail.com",
            "n210921@outlook.com",
            "student@yahoo.com",
            "admin@rguktn.com"
    })
    @DisplayName("Should strictly reject non-institutional domain emails")
    void testNonInstitutionalDomainEmails(String email) {
        InvalidInstitutionalEmailException ex = assertThrows(
                InvalidInstitutionalEmailException.class,
                () -> emailRoleResolver.resolveRole(email)
        );
        assertTrue(ex.getMessage().contains("Only institutional email addresses ending with @rguktn.ac.in are permitted."));
    }

    @ParameterizedTest(name = "Eligible Teacher Email: {0}")
    @ValueSource(strings = {
            "hod.cse@rguktn.ac.in",
            "HOD.CSE@rguktn.ac.in",
            "dean@rguktn.ac.in",
            "faculty@rguktn.ac.in"
    })
    @DisplayName("Should resolve eligible allowlisted teachers to TEACHER role")
    void testEligibleTeacherEmails(String email) {
        Role resolved = emailRoleResolver.resolveRole(email);
        assertEquals(Role.TEACHER, resolved);
    }

    @Test
    @DisplayName("Should reject non-allowlisted institutional emails from claiming TEACHER role")
    void testIneligibleTeacherEmail() {
        assertThrows(
                InvalidInstitutionalEmailException.class,
                () -> emailRoleResolver.resolveRole("unauthorized.staff@rguktn.ac.in")
        );
    }

    @Test
    @DisplayName("Should NEVER resolve ADMIN role from an email pattern")
    void testAdminNeverResolved() {
        // Even if an email looks like an admin email, role resolver never returns ADMIN
        TeacherEligibilityService teacherEligibilityService = new TeacherEligibilityService("admin@rguktn.ac.in");
        EmailRoleResolver resolver = new EmailRoleResolver(
                "^[Nn]\\d{6}@rguktn\\.ac\\.in$",
                "rguktn.ac.in",
                teacherEligibilityService
        );

        Role role = resolver.resolveRole("admin@rguktn.ac.in");
        assertNotEquals(Role.ADMIN, role, "Email resolver must NEVER return Role.ADMIN");
        assertEquals(Role.TEACHER, role);
    }
}
