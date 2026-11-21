package com.selva.authportal.security;

import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Dedicated transactional database fallback service for user authentication loading.
 * Separated from CustomUserDetailsService and AuthService to ensure database transactions
 * are strictly initiated ONLY when database access is required through a Spring AOP proxy boundary,
 * preventing connection checkout from HikariCP on cache hits and during CPU-bound password hashing.
 */
@Service
public class UserDatabaseLookupService {

    private final UserRepository userRepository;

    public UserDatabaseLookupService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads a user from the database within a read-only transaction.
     * This method is only called when UserCacheService has a cache miss.
     *
     * @param normalizedEmail Lowercase, trimmed email address
     * @return UserDetails populated with user attributes and authorities
     * @throws UsernameNotFoundException if no user exists with the given email
     */
    @Transactional(readOnly = true)
    public UserDetails loadUserByEmail(String normalizedEmail) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + normalizedEmail));
        return new CustomUserDetails(user);
    }

    /**
     * Finds a user by email within a dedicated, short read-only transaction.
     * Ensures that the database connection is acquired, the point query executed,
     * and the connection released immediately back to the pool before subsequent
     * CPU-bound operations (such as BCrypt password hashing and JWT signing) take place.
     *
     * @param normalizedEmail Lowercase, trimmed email address
     * @return Optional containing the User if found, empty otherwise
     */
    @Transactional(readOnly = true)
    public Optional<User> findUserByEmail(String normalizedEmail) {
        if (normalizedEmail == null) {
            return Optional.empty();
        }
        return userRepository.findByEmail(normalizedEmail);
    }
}
