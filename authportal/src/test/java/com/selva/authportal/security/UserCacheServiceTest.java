package com.selva.authportal.security;

import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UserDetails;

import static org.assertj.core.api.Assertions.assertThat;

class UserCacheServiceTest {

    private UserCacheService userCacheService;
    private UserDetails userDetails;

    @BeforeEach
    void setUp() {
        userCacheService = new UserCacheService();
        User user = User.builder()
                .id(1L)
                .email("student@rguktn.ac.in")
                .name("Student")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();
        userDetails = new CustomUserDetails(user);
    }

    @Test
    @DisplayName("Should cache and retrieve UserDetails for email")
    void testPutAndGet() {
        userCacheService.put("student@rguktn.ac.in", userDetails);

        UserDetails cached = userCacheService.get("student@rguktn.ac.in");
        assertThat(cached).isNotNull();
        assertThat(cached.getUsername()).isEqualTo("student@rguktn.ac.in");
    }

    @Test
    @DisplayName("Should evict cached user immediately")
    void testEvict() {
        userCacheService.put("student@rguktn.ac.in", userDetails);
        assertThat(userCacheService.get("student@rguktn.ac.in")).isNotNull();

        userCacheService.evict("student@rguktn.ac.in");
        assertThat(userCacheService.get("student@rguktn.ac.in")).isNull();
    }

    @Test
    @DisplayName("Should return null for un-cached or null email")
    void testGetUncached() {
        assertThat(userCacheService.get("unknown@rguktn.ac.in")).isNull();
        assertThat(userCacheService.get(null)).isNull();
    }

    @Test
    @DisplayName("Should clear all entries")
    void testClear() {
        userCacheService.put("student@rguktn.ac.in", userDetails);
        userCacheService.clear();
        assertThat(userCacheService.get("student@rguktn.ac.in")).isNull();
    }
}
