package com.selva.authportal.repository;

import com.selva.authportal.model.Role;
import com.selva.authportal.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
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

    interface AdminCounts {
        long getTotalUsers();
        long getStudentCount();
        long getTeacherCount();
        long getAdminCount();
        long getTotalSubmissions();
        long getTotalFeedbacks();
    }

    @Query(value = """
            SELECT COUNT(*) AS totalUsers,
                   COUNT(CASE WHEN role = 'STUDENT' THEN 1 END) AS studentCount,
                   COUNT(CASE WHEN role = 'TEACHER' THEN 1 END) AS teacherCount,
                   COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) AS adminCount,
                   (SELECT COUNT(*) FROM submissions) AS totalSubmissions,
                   (SELECT COUNT(*) FROM teacher_feedbacks) AS totalFeedbacks
            FROM users
            """, nativeQuery = true)
    AdminCounts countAdminStats();

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

    @Query("""
            SELECT u.email as email, u.name as name FROM User u
            WHERE LOCATE('@', u.email) > 1
              AND UPPER(TRIM(SUBSTRING(u.email, 1, LOCATE('@', u.email) - 1))) IN :studentIds
            ORDER BY u.id
            """)
    List<StudentDirectoryProjection> findHistoryStudentNames(@Param("studentIds") Collection<String> studentIds);
}

