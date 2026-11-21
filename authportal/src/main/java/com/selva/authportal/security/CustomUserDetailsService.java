package com.selva.authportal.security;

import com.selva.authportal.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Custom UserDetailsService that coordinates cached user authentication.
 * Cache hits are completely transaction-free and acquire no database connection.
 * On cache misses, user retrieval is delegated to the transactional UserDatabaseLookupService.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserDatabaseLookupService userDatabaseLookupService;
    private final UserCacheService userCacheService;

    public CustomUserDetailsService(UserDatabaseLookupService userDatabaseLookupService) {
        this.userDatabaseLookupService = userDatabaseLookupService;
        this.userCacheService = new UserCacheService();
    }

    @Autowired
    public CustomUserDetailsService(UserDatabaseLookupService userDatabaseLookupService, UserCacheService userCacheService) {
        this.userDatabaseLookupService = userDatabaseLookupService;
        this.userCacheService = (userCacheService != null) ? userCacheService : new UserCacheService();
    }

    // Compatibility constructors for repository-based instantiations
    public CustomUserDetailsService(UserRepository userRepository) {
        this(new UserDatabaseLookupService(userRepository), new UserCacheService());
    }

    public CustomUserDetailsService(UserRepository userRepository, UserCacheService userCacheService) {
        this(new UserDatabaseLookupService(userRepository), userCacheService);
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null) {
            throw new UsernameNotFoundException("Email cannot be null");
        }
        String normalizedEmail = email.trim().toLowerCase();

        UserDetails cached = userCacheService.get(normalizedEmail);
        if (cached != null) {
            return cached;
        }

        UserDetails userDetails = userDatabaseLookupService.loadUserByEmail(normalizedEmail);
        userCacheService.put(normalizedEmail, userDetails);
        return userDetails;
    }
}
