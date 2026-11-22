package com.selva.authportal.security.oauth2;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class OAuth2AuthenticationSuccessHandlerTest {

    @Test
    void shouldRedirectAnAlreadyProcessedOidcUserWithoutProcessingAgain() throws Exception {
        var userService = mock(CustomOAuth2UserService.class);
        var codeStore = new OAuth2ExchangeCodeStore();
        var handler = new OAuth2AuthenticationSuccessHandler("https://portal.example", codeStore, userService);
        var oidcUser = mock(OidcUser.class);
        var authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(oidcUser);
        when(oidcUser.getEmail()).thenReturn("Faculty@rguktn.ac.in");

        var response = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, authentication);

        String redirect = response.getRedirectedUrl();
        String prefix = "https://portal.example/oauth2/callback?code=";
        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(redirect).startsWith(prefix);
        String code = redirect.substring(prefix.length());
        assertThat(codeStore.consumeCode(code)).contains("faculty@rguktn.ac.in");
        assertThat(codeStore.consumeCode(code)).isEmpty();
        verifyNoInteractions(userService);
    }
}
