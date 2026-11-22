package com.selva.authportal.service;

import com.selva.authportal.dto.AuthResponse;
import com.selva.authportal.dto.LoginRequest;
import com.selva.authportal.dto.RegisterRequest;
import com.selva.authportal.dto.UserResponse;
import com.selva.authportal.exception.InvalidCredentialsException;
import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.exception.UserAlreadyExistsException;
import com.selva.authportal.exception.UserDisabledException;
import com.selva.authportal.model.AuthProvider;
import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import com.selva.authportal.security.JwtService;
import com.selva.authportal.security.CustomUserDetails;
import com.selva.authportal.security.LoginRateLimiter;
import com.selva.authportal.security.UserCacheService;
import com.selva.authportal.security.UserDatabaseLookupService;
import com.selva.authportal.security.oauth2.OAuth2ExchangeCodeStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Service orchestrating user registration, local authentication, and session token issuance.
 */
@Slf4j
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailRoleResolver emailRoleResolver;
    private final JwtService jwtService;
    private final OAuth2ExchangeCodeStore exchangeCodeStore;
    private final UserDatabaseLookupService userDatabaseLookupService;
    private LoginRateLimiter loginRateLimiter;
    private UserCacheService userCacheService;

    @Autowired
    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       EmailRoleResolver emailRoleResolver,
                       JwtService jwtService,
                       OAuth2ExchangeCodeStore exchangeCodeStore,
                       UserDatabaseLookupService userDatabaseLookupService,
                       LoginRateLimiter loginRateLimiter,
                       UserCacheService userCacheService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailRoleResolver = emailRoleResolver;
        this.jwtService = jwtService;
        this.exchangeCodeStore = exchangeCodeStore;
        this.userDatabaseLookupService = userDatabaseLookupService;
        this.loginRateLimiter = loginRateLimiter != null ? loginRateLimiter : new LoginRateLimiter();
        this.userCacheService = userCacheService != null ? userCacheService : new UserCacheService();
    }

    // Compatibility constructors for standalone test instantiations
    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       EmailRoleResolver emailRoleResolver,
                       JwtService jwtService,
                       OAuth2ExchangeCodeStore exchangeCodeStore) {
        this(userRepository, passwordEncoder, emailRoleResolver, jwtService, exchangeCodeStore,
             new UserDatabaseLookupService(userRepository), new LoginRateLimiter(), new UserCacheService());
    }

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       EmailRoleResolver emailRoleResolver,
                       JwtService jwtService,
                       OAuth2ExchangeCodeStore exchangeCodeStore,
                       LoginRateLimiter loginRateLimiter,
                       UserCacheService userCacheService) {
        this(userRepository, passwordEncoder, emailRoleResolver, jwtService, exchangeCodeStore,
             new UserDatabaseLookupService(userRepository), loginRateLimiter, userCacheService);
    }

    /**
     * Registers a new user with local email/password credentials.
     * The role is strictly determined server-side from the institutional email.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // 1. Determine role server-side (throws InvalidInstitutionalEmailException if invalid)
        Role assignedRole = emailRoleResolver.resolveRole(normalizedEmail);

        // 2. Check for duplicate account
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new UserAlreadyExistsException("An account with this email address already exists.");
        }

        // 3. Hash password
        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User.UserBuilder userBuilder = User.builder()
                .name(request.getName().trim())
                .email(normalizedEmail)
                .password(hashedPassword)
                .role(assignedRole)
                .authProvider(AuthProvider.LOCAL)
                .enabled(true);

        if (assignedRole == Role.STUDENT) {
            userBuilder.branch("CSE");
        }

        User user = userBuilder.build();
        User savedUser = userRepository.save(user);
        if (userCacheService != null) {
            userCacheService.put(normalizedEmail, new CustomUserDetails(savedUser));
        }
        log.info("Successfully registered local user with email: {} and role: {}", normalizedEmail, assignedRole);

        // 5. Generate application JWT
        String token = jwtService.generateToken(savedUser);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .user(UserResponse.fromEntity(savedUser))
                .build();
    }

    /**
     * Authenticates a user using local email and password.
     * Transaction-free at the orchestrator level: User lookup executes in an isolated,
     * short read-only transaction through UserDatabaseLookupService and immediately releases
     * the database connection back to HikariCP before CPU-bound BCrypt password verification
     * and JWT generation execute.
     */
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // 0. Brute-force & rate-limiting check (zero DB)
        if (loginRateLimiter != null && loginRateLimiter.isBlocked(normalizedEmail)) {
            throw new InvalidCredentialsException("Too many failed login attempts. Please wait 15 minutes before trying again.");
        }

        // 1. Locate user via isolated transactional query; connection is checked out for findByEmail
        // and released immediately when UserDatabaseLookupService returns.
        User user = timeLoginStep("database lookup", () ->
                userDatabaseLookupService.findUserByEmail(normalizedEmail).orElse(null));

        // 2. Verify password (CPU-bound BCrypt execution occurs with ZERO database connections held)
        if (user == null || user.getPassword() == null || !timeLoginStep("password verification", () ->
                passwordEncoder.matches(request.getPassword(), user.getPassword()))) {
            if (loginRateLimiter != null) {
                loginRateLimiter.recordFailure(normalizedEmail);
            }
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        // 3. Check account enabled status
        if (!user.isEnabled()) {
            throw new UserDisabledException("Your account is disabled. Please contact administration.");
        }

        // Clear failed attempts upon successful login
        if (loginRateLimiter != null) {
            loginRateLimiter.recordSuccess(normalizedEmail);
        }

        log.info("User logged in successfully: {}", normalizedEmail);

        // Warm user cache immediately to avoid DB round-trips on subsequent authenticated requests
        if (userCacheService != null) {
            userCacheService.put(normalizedEmail, new CustomUserDetails(user));
        }

        // 4. Generate JWT (in-memory CPU work with zero DB connection held)
        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .user(UserResponse.fromEntity(user))
                .build();
    }

    private <T> T timeLoginStep(String step, Supplier<T> operation) {
        long start = System.nanoTime();
        try {
            return operation.get();
        } finally {
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            if (elapsedMs >= 1000) {
                log.warn("Slow password login step '{}': {} ms", step, elapsedMs);
            }
        }
    }

    /**
     * Retrieves profile information for the authenticated user.
     */
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found for email: " + email));
        return UserResponse.fromEntity(user);
    }

    /**
     * Exchanges a short-lived, single-use authorization code for an application JWT.
     * Burns the code upon exchange and returns standard AuthResponse.
     */
    public AuthResponse exchangeOAuthCode(String code) {
        String email = exchangeCodeStore.consumeCode(code)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid or expired OAuth authorization code."));

        User user = userDatabaseLookupService.findUserByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found for email: " + email));

        if (!user.isEnabled()) {
            throw new UserDisabledException("Your account is disabled. Please contact administration.");
        }

        String token = jwtService.generateToken(user);
        log.info("Successfully exchanged one-time code for JWT for user: {}", email);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .user(UserResponse.fromEntity(user))
                .build();
    }
}
