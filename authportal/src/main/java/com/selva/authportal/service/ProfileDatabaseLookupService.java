package com.selva.authportal.service;

import com.selva.authportal.exception.ResourceNotFoundException;
import com.selva.authportal.model.User;
import com.selva.authportal.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dedicated transactional database fallback service for user profile retrieval.
 * Invoked through a Spring AOP proxy boundary only when the in-memory user entity
 * is missing or incomplete, ensuring that the common in-memory profile retrieval
 * path in ProfileService remains completely transaction-free and acquires no
 * database connection from HikariCP.
 */
@Service
public class ProfileDatabaseLookupService {

    private final UserRepository userRepository;

    public ProfileDatabaseLookupService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Loads a user by ID from the database within a read-only transaction.
     * This method is only called on fallback when the user entity is not available in memory.
     *
     * @param id User ID
     * @return User entity
     * @throws ResourceNotFoundException if user is not found or id is null
     */
    @Transactional(readOnly = true)
    public User fetchUserById(Long id) {
        if (id == null) {
            throw new ResourceNotFoundException("User not found with id: null");
        }
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
    }
}
