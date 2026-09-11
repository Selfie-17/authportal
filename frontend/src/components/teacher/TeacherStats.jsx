import React from 'react';

/**
 * Top summary statistics bar for Teacher Dashboard.
 * Displays Total Students, Evaluated Weeks, Average Lab Score, and Review Completion Rate.
 */
export default function TeacherStats({ totalStudents, totalWeeks, averageScore, reviewedCount, totalEvaluations }) {
  const reviewPercentage = totalEvaluations > 0 
    ? Math.round((reviewedCount / totalEvaluations) * 100) 
    : 0;

  return (
    <div className="teacher-stats-bar">
      <div className="teacher-stat-card">
        <div className="teacher-stat-icon-wrapper student-accent">
          👥
        </div>
        <div className="teacher-stat-info">
          <span className="teacher-stat-label">Total Students</span>
          <span className="teacher-stat-val">{totalStudents}</span>
          <span className="teacher-stat-sub">In evaluation records</span>
        </div>
      </div>

      <div className="teacher-stat-card">
        <div className="teacher-stat-icon-wrapper week-accent">
          📅
        </div>
        <div className="teacher-stat-info">
          <span className="teacher-stat-label">Evaluated Weeks</span>
          <span className="teacher-stat-val">{totalWeeks}</span>
          <span className="teacher-stat-sub">Lab curriculum cycles</span>
        </div>
      </div>

      <div className="teacher-stat-card">
        <div className="teacher-stat-icon-wrapper score-accent">
          ⭐
        </div>
        <div className="teacher-stat-info">
          <span className="teacher-stat-label">Class Average Score</span>
          <span className="teacher-stat-val">
            {averageScore > 0 ? `${averageScore.toFixed(1)} / 10` : '—'}
          </span>
          <span className="teacher-stat-sub">Overall student average</span>
        </div>
      </div>

      <div className="teacher-stat-card">
        <div className="teacher-stat-icon-wrapper review-accent">
          📋
        </div>
        <div className="teacher-stat-info">
          <span className="teacher-stat-label">Teacher Reviews</span>
          <span className="teacher-stat-val">
            {reviewedCount} <span className="teacher-stat-denom">/ {totalEvaluations}</span>
          </span>
          <span className="teacher-stat-sub">{reviewPercentage}% completed</span>
        </div>
      </div>
    </div>
  );
}
