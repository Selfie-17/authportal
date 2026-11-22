package com.selva.authportal.security.oauth2;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * Custom OIDC user service for OpenID Connect authentication (e.g. Google).
 * Ensures institutional domain validation and database persistence occur during the OIDC login flow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOidcUserService extends OidcUserService {

    private final CustomOAuth2UserService customOAuth2UserService;

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
        long start = System.nanoTime();
        OidcUser oidcUser = super.loadUser(userRequest);
        long accountStart = System.nanoTime();
        customOAuth2UserService.processOAuth2User(oidcUser);
        log.info("oidc_sign_in user_info_ms={} account_processing_ms={}",
                TimeUnit.NANOSECONDS.toMillis(accountStart - start),
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - accountStart));
        return oidcUser;
    }
}
