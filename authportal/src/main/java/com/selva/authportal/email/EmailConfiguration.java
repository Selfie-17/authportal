package com.selva.authportal.email;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

/**
 * Spring configuration creating the JavaMailSender bean configured for Gmail SMTP.
 */
@Configuration
@RequiredArgsConstructor
public class EmailConfiguration {

    private final EmailProperties emailProperties;

    @Bean
    public JavaMailSender javaMailSender() {
        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setHost(emailProperties.getHost());
        mailSender.setPort(emailProperties.getPort());
        mailSender.setUsername(emailProperties.getUsername());
        mailSender.setPassword(emailProperties.getPassword());
        mailSender.setDefaultEncoding("UTF-8");

        Properties props = mailSender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", String.valueOf(emailProperties.isAuth()));
        props.put("mail.smtp.starttls.enable", String.valueOf(emailProperties.isStarttlsEnable()));
        props.put("mail.smtp.starttls.required", String.valueOf(emailProperties.isStarttlsRequired()));
        props.put("mail.smtp.ssl.trust", emailProperties.getHost());
        props.put("mail.smtp.connectiontimeout", "20000");
        props.put("mail.smtp.timeout", "25000");
        props.put("mail.smtp.writetimeout", "25000");

        return mailSender;
    }
}
