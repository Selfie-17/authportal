import React, { useState } from 'react';
import StudentScoreRow from './StudentScoreRow';

/**
 * Common Week 1–Week 12 Table for Teacher Observation Reports.
 * Displays exactly ONE common header row at the top with aligned student scores underneath.
 * Manages inline week score expansion per student row.
 */
export default function StudentScoreTable({
  students = [],
  studentMetaMap = {},
  onViewReport,
  onDeleteReport,
}) {
  // Map of active expanded week per student: { [studentId]: 'Week 1' }
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const handleToggleWeek = (studentId, targetWeek) => {
    setExpandedWeeks((prev) => {
      const current = prev[studentId];
      if (current === targetWeek) {
        // Clicking the currently active score collapses it
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      // Clicking another week closes previous and opens new one
      return {
        ...prev,
        [studentId]: targetWeek,
      };
    });
  };

  if (students.length === 0) {
    return (
      <div className="portal-card" style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>🔍</div>
        <h3 style={{ color: '#0f172a', marginBottom: '0.35rem' }}>No Matching Students Found</h3>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          No student evaluations match the selected filters or search query.
        </p>
      </div>
    );
  }

  return (
    <div className="teacher-table-card">
      <div className="student-score-table-responsive">
        <table className="teacher-score-table">
          <colgroup>
            <col className="col-index" style={{ width: '38px' }} />
            <col className="col-student" style={{ width: '195px' }} />
            {Array.from({ length: 12 }, (_, i) => (
              <col key={i + 1} className="col-week" />
            ))}
            <col className="col-action" style={{ width: '72px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="th-index" scope="col">#</th>
              <th className="th-student" scope="col">STUDENT</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i + 1} className="th-week" scope="col">
                  Week {i + 1}
                </th>
              ))}
              <th className="th-action" scope="col">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {students.map((row, idx) => {
              const sId = (row.studentId || '').toUpperCase();
              const meta = studentMetaMap[sId] || {};
              const expandedWeek = expandedWeeks[sId] || null;

              return (
                <StudentScoreRow
                  key={row.studentId || idx}
                  rowIndex={idx + 1}
                  row={row}
                  studentMeta={meta}
                  expandedWeek={expandedWeek}
                  onToggleWeek={(targetWeek) => handleToggleWeek(sId, targetWeek)}
                  onViewReport={onViewReport}
                  onDeleteReport={onDeleteReport}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="teacher-table-footer">
        <span className="footer-count-text">
          Showing <strong>1</strong> to <strong>{students.length}</strong> of <strong>{students.length}</strong> students
        </span>
      </div>
    </div>
  );
}
