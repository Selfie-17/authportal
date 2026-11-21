package com.selva.authportal.repository;

import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for the User entity.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmail(String email);

    Optional<User> findByGoogleId(String googleId);

    boolean existsByEmail(String email);

    boolean existsByGoogleId(String googleId);

    long countByRole(Role role);

    List<User> findAllByOrderByCreatedAtDesc();

    /**
     * Lightweight projection for teacher evaluation grid student matching.
     * Avoids transferring full User entity state (passwords, timestamps, roles) across remote database connections.
     */
    interface StudentDirectoryProjection {
        String getEmail();
        String getName();
        String getProfilePicture();
    }

    @Query("SELECT u.email as email, u.name as name, u.profilePicture as profilePicture FROM User u WHERE u.role = 'STUDENT'")
    List<StudentDirectoryProjection> findAllStudentDirectory();
}

