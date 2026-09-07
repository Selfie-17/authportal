package com.selva.authportal.repository;

import com.selva.authportal.model.TeacherFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeacherFeedbackRepository extends JpaRepository<TeacherFeedback, Long> {

    Optional<TeacherFeedback> findByStudentIdAndWeek(String studentId, String week);

    List<TeacherFeedback> findByStudentId(String studentId);
}
