package com.selva.authportal.security.oauth2;

import com.selva.authportal.exception.InvalidInstitutionalEmailException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.service.EmailRoleResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Custom OAuth2 user service processing Google OIDC / OAuth2 logins.
 * Enforces institutional email rules, preserves ADMIN roles, and manages safe account linking.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final EmailRoleResolver emailRoleResolver;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        try {
            return processOAuth2User(oAuth2User);
        } catch (OAuth2AuthenticationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error processing OAuth2 user: ", e);
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("oauth_processing_error"),
                    e.getMessage()
            );
        }
    }

    public OAuth2User processOAuth2User(OAuth2User oAuth2User) {
        String email = oAuth2User.getAttribute("email");
        if (email == null || email.trim().isEmpty()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_email"),
                    "Email not found from OAuth2 provider."
            );
        }

        String normalizedEmail = email.trim().toLowerCase();
        String googleId = oAuth2User.getAttribute("sub");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");

        if (name == null || name.trim().isEmpty()) {
            name = normalizedEmail.split("@")[0];
        }

        // 1. Verify institutional email domain
        if (!emailRoleResolver.isInstitutionalDomain(normalizedEmail)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_institutional_domain"),
                    "Only @rguktn.ac.in institutional accounts are permitted to authenticate."
            );
        }

        Optional<User> existingUserOpt = userRepository.findByEmail(normalizedEmail);
        User user;

        if (existingUserOpt.isPresent()) {
            // Existing user handling
            user = existingUserOpt.get();

            // Safe account linking: associate Google ID if not already set
            if (user.getGoogleId() == null) {
                user.setGoogleId(googleId);
            }

            // Update profile picture if missing
            if ((user.getProfilePicture() == null || user.getProfilePicture().isEmpty()) && picture != null) {
                user.setProfilePicture(picture);
            }

            // CRITICAL: Preserve existing role (especially ADMIN - never downgrade!)
            log.info("Existing user authenticated via Google OAuth: {}, role: {}", normalizedEmail, user.getRole());
            user = userRepository.save(user);

        } else {
            // New user provisioning: determine role via centralized resolver
            Role role;
            try {
                role = emailRoleResolver.resolveRole(normalizedEmail);
            } catch (InvalidInstitutionalEmailException e) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("unauthorized_registration"),
                        e.getMessage()
                );
            }

            user = User.builder()
                    .email(normalizedEmail)
                    .name(name)
                    .googleId(googleId)
                    .profilePicture(picture)
                    .role(role)
                    .authProvider(AuthProvider.GOOGLE)
                    .enabled(true)
                    .build();

            user = userRepository.save(user);
            log.info("New user provisioned via Google OAuth: {}, role: {}", normalizedEmail, role);
        }

        return new OAuth2UserPrincipal(user, oAuth2User.getAttributes());
    }
}
