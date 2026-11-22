package com.selva.authportal.security.oauth2;

import com.selva.authportal.exception.InvalidInstitutionalEmailException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.service.EmailRoleResolver;
import com.selva.authportal.security.UserCacheService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

/**
 * Custom OAuth2 user service processing Google OIDC / OAuth2 logins.
 * Enforces institutional email rules, preserves ADMIN roles, and manages safe account linking.
 */
@Slf4j
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final EmailRoleResolver emailRoleResolver;
    private UserCacheService userCacheService;

    public CustomOAuth2UserService(UserRepository userRepository, EmailRoleResolver emailRoleResolver) {
        this.userRepository = userRepository;
        this.emailRoleResolver = emailRoleResolver;
        this.userCacheService = new UserCacheService();
    }

    @Autowired
    public CustomOAuth2UserService(UserRepository userRepository, EmailRoleResolver emailRoleResolver, UserCacheService userCacheService) {
        this.userRepository = userRepository;
        this.emailRoleResolver = emailRoleResolver;
        this.userCacheService = userCacheService != null ? userCacheService : new UserCacheService();
    }

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

        // 1. Verify eligibility for Google OAuth (must be configured Google Admin or institutional account)
        if (!emailRoleResolver.isAllowedOAuthEmail(normalizedEmail)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unauthorized_account"),
                    "Access denied. Only institutional accounts (@rguktn.ac.in, @rguktrkv.ac.in, @rguktong.ac.in, @rguktsklm.ac.in, @rgukt.in) and authorized administrators are permitted to authenticate via Google."
            );
        }

        Optional<User> existingUserOpt = userRepository.findByEmail(normalizedEmail);
        User user;

        if (existingUserOpt.isPresent()) {
            // Existing user handling
            user = existingUserOpt.get();

            String linkedGoogleId = user.getGoogleId() == null ? googleId : user.getGoogleId();
            String profilePicture = picture != null && !picture.trim().isEmpty() ? picture : user.getProfilePicture();
            Role role = user.getRole();
            if (emailRoleResolver.isGoogleAdmin(normalizedEmail)) {
                role = Role.ADMIN;
            } else if (role != Role.ADMIN) {
                role = emailRoleResolver.resolveOAuthRole(normalizedEmail);
            }

            if (!Objects.equals(user.getGoogleId(), linkedGoogleId)
                    || !Objects.equals(user.getProfilePicture(), profilePicture) || user.getRole() != role) {
                user.setGoogleId(linkedGoogleId);
                user.setProfilePicture(profilePicture);
                user.setRole(role);
                user = userRepository.save(user);
            }
            log.info("Existing user authenticated via Google OAuth: {}, role: {}", normalizedEmail, user.getRole());
            if (userCacheService != null) {
                userCacheService.evict(normalizedEmail);
            }

        } else {
            // New user provisioning: determine role via OAuth-specific resolver
            Role role;
            try {
                role = emailRoleResolver.resolveOAuthRole(normalizedEmail);
            } catch (InvalidInstitutionalEmailException e) {
                throw new OAuth2AuthenticationException(
                        new OAuth2Error("unauthorized_registration"),
                        e.getMessage()
                );
            }

            User.UserBuilder userBuilder = User.builder()
                    .email(normalizedEmail)
                    .name(name)
                    .googleId(googleId)
                    .profilePicture(picture)
                    .role(role)
                    .authProvider(AuthProvider.GOOGLE)
                    .enabled(true);

            if (role == Role.STUDENT) {
                userBuilder.branch("CSE");
            }

            user = userBuilder.build();

            user = userRepository.save(user);
            if (userCacheService != null) {
                userCacheService.evict(normalizedEmail);
            }
            log.info("New user provisioned via Google OAuth: {}, role: {}", normalizedEmail, role);
        }

        return new OAuth2UserPrincipal(user, oAuth2User.getAttributes());
    }
}
