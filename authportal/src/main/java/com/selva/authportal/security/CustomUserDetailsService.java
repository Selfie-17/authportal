package com.selva.authportal.security;

import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Custom UserDetailsService that loads users by email from the database,
 * protected with a high-performance in-memory cache to prevent redundant database hits.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserCacheService userCacheService;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
        this.userCacheService = new UserCacheService();
    }

    @Autowired
    public CustomUserDetailsService(UserRepository userRepository, UserCacheService userCacheService) {
        this.userRepository = userRepository;
        this.userCacheService = (userCacheService != null) ? userCacheService : new UserCacheService();
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null) {
            throw new UsernameNotFoundException("Email cannot be null");
        }
        String normalizedEmail = email.trim().toLowerCase();

        UserDetails cached = userCacheService.get(normalizedEmail);
        if (cached != null) {
            return cached;
        }

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + normalizedEmail));

        UserDetails userDetails = new CustomUserDetails(user);
        userCacheService.put(normalizedEmail, userDetails);
        return userDetails;
    }
}
