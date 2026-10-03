package com.selva.authportal.service;

import com.selva.authportal.dto.ZipReportItemDTO;
import com.selva.authportal.dto.ZipReportsParseResponse;
import com.selva.authportal.email.EmailService;
import com.selva.authportal.repository.EmailBatchRecipientRepository;
import com.selva.authportal.repository.EmailBatchRepository;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.File;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ZipReportEmailServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private EmailBatchRepository batchRepository;

    @Mock
    private EmailBatchRecipientRepository recipientRepository;

    private EmailReportHtmlTransformer htmlTransformer;
    private ZipReportEmailService zipReportEmailService;

    @BeforeEach
    void setUp() {
        htmlTransformer = new EmailReportHtmlTransformer();
        zipReportEmailService = new ZipReportEmailService(
                userRepository,
                emailService,
                htmlTransformer,
                batchRepository,
                recipientRepository
        );
    }

    @Test
    void testParseLocalZipReportsIfPresent() {
        File zipFile = new File("C:\\Users\\kampa\\Downloads\\lab_notebook_reports (2).zip");
        if (!zipFile.exists()) {
            return; // Skip if run in CI without this local file
        }

        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());

        ZipReportsParseResponse response = zipReportEmailService.parseZipReports(null, zipFile.getAbsolutePath());

        assertTrue(response.isSuccess());
        assertEquals(6, response.getTotalReports());
        assertNotNull(response.getReports());
        assertEquals(6, response.getReports().size());

        // Verify known student IDs from the archive
        ZipReportItemDTO first = response.getReports().get(0);
        assertEquals("N240035", first.getStudentId());
        assertEquals("n240035@rguktn.ac.in", first.getEmail());
        assertTrue(first.getHtmlFileName().contains("N240035_lab_notebook.html"));
        assertFalse(first.getCompanionFiles().isEmpty());
    }
}
