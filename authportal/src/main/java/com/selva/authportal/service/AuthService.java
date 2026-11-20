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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.selva.authportal.security.LoginRateLimiter;
import com.selva.authportal.security.UserCacheService;
import com.selva.authportal.security.oauth2.OAuth2ExchangeCodeStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private LoginRateLimiter loginRateLimiter;
    private UserCacheService userCacheService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       EmailRoleResolver emailRoleResolver,
                       JwtService jwtService,
                       OAuth2ExchangeCodeStore exchangeCodeStore) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailRoleResolver = emailRoleResolver;
        this.jwtService = jwtService;
        this.exchangeCodeStore = exchangeCodeStore;
        this.loginRateLimiter = new LoginRateLimiter();
        this.userCacheService = new UserCacheService();
    }

    @Autowired
    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       EmailRoleResolver emailRoleResolver,
                       JwtService jwtService,
                       OAuth2ExchangeCodeStore exchangeCodeStore,
                       LoginRateLimiter loginRateLimiter,
                       UserCacheService userCacheService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailRoleResolver = emailRoleResolver;
        this.jwtService = jwtService;
        this.exchangeCodeStore = exchangeCodeStore;
        this.loginRateLimiter = loginRateLimiter != null ? loginRateLimiter : new LoginRateLimiter();
        this.userCacheService = userCacheService != null ? userCacheService : new UserCacheService();
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
            userCacheService.evict(normalizedEmail);
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
     */
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        // 0. Brute-force & rate-limiting check
        if (loginRateLimiter != null && loginRateLimiter.isBlocked(normalizedEmail)) {
            throw new InvalidCredentialsException("Too many failed login attempts. Please wait 15 minutes before trying again.");
        }

        // 1. Locate user; use generic error to prevent account enumeration
        User user = userRepository.findByEmail(normalizedEmail)
                .orElse(null);

        // 2. Verify password (accounts created solely via Google OAuth will have null password)
        if (user == null || user.getPassword() == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
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

        // 4. Generate JWT
        String token = jwtService.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs() / 1000)
                .user(UserResponse.fromEntity(user))
                .build();
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
    @Transactional(readOnly = true)
    public AuthResponse exchangeOAuthCode(String code) {
        String email = exchangeCodeStore.consumeCode(code)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid or expired OAuth authorization code."));

        User user = userRepository.findByEmail(email)
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

