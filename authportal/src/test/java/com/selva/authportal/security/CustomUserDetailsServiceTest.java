package com.selva.authportal.security;

import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock
    private UserDatabaseLookupService userDatabaseLookupService;

    @Mock
    private UserRepository userRepository;

    private UserCacheService userCacheService;
    private CustomUserDetailsService customUserDetailsService;

    private User sampleUser;
    private UserDetails sampleUserDetails;

    @BeforeEach
    void setUp() {
        userCacheService = new UserCacheService();
        customUserDetailsService = new CustomUserDetailsService(userDatabaseLookupService, userCacheService);

        sampleUser = User.builder()
                .id(1L)
                .email("student@rguktn.ac.in")
                .password("$2a$10$encodedPasswordHash")
                .name("Test Student")
                .role(Role.STUDENT)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true)
                .build();
        sampleUserDetails = new CustomUserDetails(sampleUser);
    }

    @Test
    @DisplayName("1. Cache hit returns UserDetails without invoking database fallback")
    void testCacheHitReturnsWithoutDatabaseFallback() {
        userCacheService.put("student@rguktn.ac.in", sampleUserDetails);

        UserDetails result = customUserDetailsService.loadUserByUsername("student@rguktn.ac.in");

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("student@rguktn.ac.in");
        assertThat(result).isSameAs(sampleUserDetails);

        // Verify database fallback was NEVER contacted
        verifyNoInteractions(userDatabaseLookupService);
    }

    @Test
    @DisplayName("2. Cache hit path is transaction-free and initiates no transaction")
    void testCacheHitIsTransactionFree() throws NoSuchMethodException {
        // Assert CustomUserDetailsService has NO @Transactional annotation on class or method
        assertThat(CustomUserDetailsService.class.isAnnotationPresent(Transactional.class)).isFalse();
        Method loadUserMethod = CustomUserDetailsService.class.getMethod("loadUserByUsername", String.class);
        assertThat(loadUserMethod.isAnnotationPresent(Transactional.class)).isFalse();

        // Warm cache
        userCacheService.put("student@rguktn.ac.in", sampleUserDetails);

        // Invoke and verify no transaction is active
        UserDetails result = customUserDetailsService.loadUserByUsername("student@rguktn.ac.in");
        assertThat(result).isNotNull();
        assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();

        // Ensure database fallback service was not touched
        verifyNoInteractions(userDatabaseLookupService);
    }

    @Test
    @DisplayName("3. Cache miss invokes transactional database fallback with normalized email")
    void testCacheMissInvokesDatabaseFallback() {
        when(userDatabaseLookupService.loadUserByEmail("student@rguktn.ac.in")).thenReturn(sampleUserDetails);

        UserDetails result = customUserDetailsService.loadUserByUsername("  STUDENT@RGUKTN.AC.IN  ");

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("student@rguktn.ac.in");
        verify(userDatabaseLookupService, times(1)).loadUserByEmail("student@rguktn.ac.in");
    }

    @Test
    @DisplayName("3b. UserDatabaseLookupService method declares @Transactional(readOnly = true)")
    void testDatabaseLookupServiceDeclaresTransactionalReadOnly() throws NoSuchMethodException {
        Method dbMethod = UserDatabaseLookupService.class.getMethod("loadUserByEmail", String.class);
        Transactional tx = dbMethod.getAnnotation(Transactional.class);
        assertThat(tx).isNotNull();
        assertThat(tx.readOnly()).isTrue();
    }

    @Test
    @DisplayName("4. Database fallback correctly handles nonexistent users")
    void testDatabaseFallbackHandlesNonexistentUser() {
        UserDatabaseLookupService directService = new UserDatabaseLookupService(userRepository);
        when(userRepository.findByEmail("nonexistent@rguktn.ac.in")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> directService.loadUserByEmail("nonexistent@rguktn.ac.in"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("User not found with email: nonexistent@rguktn.ac.in");

        verify(userRepository, times(1)).findByEmail("nonexistent@rguktn.ac.in");
    }

    @Test
    @DisplayName("4b. Null email throws UsernameNotFoundException without calling cache or DB")
    void testNullEmailThrowsExceptionImmediately() {
        assertThatThrownBy(() -> customUserDetailsService.loadUserByUsername(null))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessageContaining("Email cannot be null");

        verifyNoInteractions(userDatabaseLookupService);
    }

    @Test
    @DisplayName("5. Cache is populated after a successful cache miss")
    void testCachePopulatedAfterMiss() {
        when(userDatabaseLookupService.loadUserByEmail("student@rguktn.ac.in")).thenReturn(sampleUserDetails);

        // First call: cache miss, calls DB fallback
        UserDetails firstResult = customUserDetailsService.loadUserByUsername("student@rguktn.ac.in");
        assertThat(firstResult).isNotNull();
        verify(userDatabaseLookupService, times(1)).loadUserByEmail("student@rguktn.ac.in");

        // Second call: cache hit, must NOT call DB fallback again
        UserDetails secondResult = customUserDetailsService.loadUserByUsername("student@rguktn.ac.in");
        assertThat(secondResult).isNotNull();
        assertThat(secondResult).isSameAs(sampleUserDetails);

        // Verification still shows exactly 1 invocation from the first call
        verify(userDatabaseLookupService, times(1)).loadUserByEmail("student@rguktn.ac.in");
    }

    @Test
    @DisplayName("6. Account status and role handling remain correct")
    void testAccountStatusAndRolesPreserved() {
        // Test Student
        assertThat(sampleUserDetails.isEnabled()).isTrue();
        assertThat(sampleUserDetails.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
        assertThat(sampleUserDetails.getPassword()).isEqualTo("$2a$10$encodedPasswordHash");
        assertThat(sampleUserDetails.getUsername()).isEqualTo("student@rguktn.ac.in");
        assertThat(sampleUserDetails.isAccountNonExpired()).isTrue();
        assertThat(sampleUserDetails.isAccountNonLocked()).isTrue();
        assertThat(sampleUserDetails.isCredentialsNonExpired()).isTrue();

        // Test Disabled Teacher
        User disabledTeacher = User.builder()
                .id(2L)
                .email("teacher@rguktn.ac.in")
                .password("$2a$10$teacherHash")
                .role(Role.TEACHER)
                .enabled(false)
                .build();
        CustomUserDetails teacherDetails = new CustomUserDetails(disabledTeacher);
        assertThat(teacherDetails.isEnabled()).isFalse();
        assertThat(teacherDetails.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_TEACHER");

        // Test Admin
        User adminUser = User.builder()
                .id(3L)
                .email("admin@rguktn.ac.in")
                .role(Role.ADMIN)
                .enabled(true)
                .build();
        CustomUserDetails adminDetails = new CustomUserDetails(adminUser);
        assertThat(adminDetails.isEnabled()).isTrue();
        assertThat(adminDetails.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("7. UserDatabaseLookupService direct execution loads user and builds CustomUserDetails")
    void testDirectUserDatabaseLookupServiceSuccess() {
        UserDatabaseLookupService directService = new UserDatabaseLookupService(userRepository);
        when(userRepository.findByEmail("student@rguktn.ac.in")).thenReturn(Optional.of(sampleUser));

        UserDetails details = directService.loadUserByEmail("student@rguktn.ac.in");
        assertThat(details).isNotNull();
        assertThat(details.getUsername()).isEqualTo("student@rguktn.ac.in");
        assertThat(details.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_STUDENT");
        assertThat(details.isEnabled()).isTrue();
    }
}
