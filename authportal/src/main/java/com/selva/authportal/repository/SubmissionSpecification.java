package com.selva.authportal.repository;

import com.selva.authportal.model.Submission;
import com.selva.authportal.model.YearLevel;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic JPA Specification for teacher queries filtering submissions by
 * Week (1–12), Year (E1–E4), Section (1–6), and optional Student ID search.
 */
public class SubmissionSpecification {

    public static Specification<Submission> withFilters(Integer week, YearLevel year, Integer section, String studentId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (week != null) {
                predicates.add(cb.equal(root.get("week"), week));
            }
            if (year != null) {
                predicates.add(cb.equal(root.get("year"), year));
            }
            if (section != null) {
                predicates.add(cb.equal(root.get("section"), section));
            }
            if (studentId != null && !studentId.trim().isEmpty()) {
                predicates.add(cb.like(cb.upper(root.get("studentId")), "%" + studentId.trim().toUpperCase() + "%"));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
