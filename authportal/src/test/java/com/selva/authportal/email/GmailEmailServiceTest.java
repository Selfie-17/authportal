package com.selva.authportal.email;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.List;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GmailEmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    private EmailProperties emailProperties;
    private GmailEmailService gmailEmailService;

    @BeforeEach
    void setUp() {
        emailProperties = new EmailProperties();
        emailProperties.setHost("smtp.gmail.com");
        emailProperties.setPort(587);
        emailProperties.setUsername("faculty@rguktn.ac.in");
        emailProperties.setPassword("abcd-efgh-ijkl-mnop");
        emailProperties.setSenderName("RGUKT Academic Portal");
        emailProperties.setSenderEmail("faculty@rguktn.ac.in");

        gmailEmailService = new GmailEmailService(mailSender, emailProperties);
    }

    @Test
    @DisplayName("isConfigured returns true with valid credentials and false with placeholders")
    void testIsConfigured() {
        assertThat(gmailEmailService.isConfigured()).isTrue();

        emailProperties.setUsername("");
        assertThat(gmailEmailService.isConfigured()).isFalse();

        emailProperties.setUsername("user@gmail.com");
        emailProperties.setPassword("your-gmail-app-password");
        assertThat(gmailEmailService.isConfigured()).isFalse();

        emailProperties.setPassword("valid-app-password");
        assertThat(gmailEmailService.isConfigured()).isTrue();
    }

    @Test
    @DisplayName("sendEmail builds MimeMessage and dispatches via JavaMailSender")
    void testSendEmail() {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        EmailAttachment attachment = EmailAttachment.builder()
                .name("Report.html")
                .content("<html>Report</html>".getBytes())
                .contentType("text/html")
                .build();

        EmailSendRequest request = EmailSendRequest.builder()
                .to("student@rguktn.ac.in")
                .toName("Student One")
                .subject("Evaluation Report")
                .body("<p>Hello Student</p>")
                .html(true)
                .attachments(List.of(attachment))
                .build();

        EmailSendResult result = gmailEmailService.sendEmail(request);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getRecipientEmail()).isEqualTo("student@rguktn.ac.in");
        assertThat(result.getAttachedFiles()).contains("Report.html");

        verify(mailSender).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("sendEmail propagates actual SMTP error when JavaMailSender fails")
    void testSendEmailFailure() {
        MimeMessage mimeMessage = new MimeMessage((Session) null);
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        doThrow(new MailSendException("535 5.7.8 Username and Password not accepted"))
                .when(mailSender).send(any(MimeMessage.class));

        EmailSendRequest request = EmailSendRequest.builder()
                .to("student@rguktn.ac.in")
                .subject("Test Fail")
                .body("Hello")
                .build();

        assertThatThrownBy(() -> gmailEmailService.sendEmail(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Gmail SMTP error")
                .hasMessageContaining("Username and Password not accepted");
    }
}
