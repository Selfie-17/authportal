import React, { useState } from 'react';
import WeekReportCard from './WeekReportCard';

/**
 * Expandable Accordion Card for an individual Student.
 * Collapsed by default for compact visual scanning.
 * Discloses weekly evaluations when expanded.
 */
export default function StudentReportCard({
  row,
  studentMeta = {},
  availableWeeks = [],
  activeWeekFilter = 'ALL',
  onViewReport,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const studentId = row.studentId;
  const evaluations = row.evaluations || {};

  // Compute stats for this student across all evaluated weeks
  const evalKeys = Object.keys(evaluations).filter((k) => !!evaluations[k]);
  const evaluatedWeeksCount = evalKeys.length;

  let totalScoreSum = 0;
  let scoreCount = 0;
  let reviewedCount = 0;

  evalKeys.forEach((k) => {
    const ev = evaluations[k];
    if (ev) {
      if (ev.reviewed) reviewedCount++;
      const num = parseFloat(ev.finalScore);
      if (!isNaN(num)) {
        totalScoreSum += num;
        scoreCount++;
      }
    }
  });

  const avgScore = scoreCount > 0 ? (totalScoreSum / scoreCount).toFixed(1) : null;

  // Student name and Academic tag (Engineering & Section) derived from metadata or row
  const studentName = studentMeta.name || row.studentName || 'Student';
  const engineeringLabel = studentMeta.engineering || row.engineering || 'Engineering';
  const sectionLabel = studentMeta.section ? `Section ${studentMeta.section}` : (row.section ? `Section ${row.section}` : '');
  const academicTag = sectionLabel ? `${engineeringLabel} • ${sectionLabel}` : engineeringLabel;

  // Initial for avatar
  const avatarInitials = studentMeta.name
    ? studentMeta.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('')
    : studentId.slice(0, 2).toUpperCase();

  // Weeks to display inside expanded view:
  // If activeWeekFilter is specific (e.g. 'Week 5'), show only that week.
  // Otherwise show all available weeks that have evaluations (or all availableWeeks).
  const weeksToDisplay = activeWeekFilter !== 'ALL'
    ? [activeWeekFilter]
    : availableWeeks.filter((w) => evaluations[w]);

  return (
    <div className={`student-accordion-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Clickable Header for Accordion */}
      <div
        className="student-card-header"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {/* Left: Student Identity */}
        <div className="student-identity-col">
          <div className="student-avatar-circle" aria-hidden="true">
            {avatarInitials}
          </div>
          <div className="student-identity-details">
            <div className="student-id-row">
              <span className="student-id-badge">{studentId}</span>
              <span className="student-academic-chip">{academicTag}</span>
            </div>
            <h3 className="student-full-name">{studentName}</h3>
          </div>
        </div>

        {/* Center: Summary Chips */}
        <div className="student-summary-metrics">
          <div className="summary-metric-pill" title="Evaluated Lab Weeks">
            <span className="metric-pill-icon">📅</span>
            <span><strong>{evaluatedWeeksCount}</strong> {evaluatedWeeksCount === 1 ? 'Week' : 'Weeks'}</span>
          </div>

          <div className="summary-metric-pill" title="Average Lab Score">
            <span className="metric-pill-icon">⭐</span>
            <span>
              Avg Score: <strong>{avgScore ? `${avgScore}/10` : 'N/A'}</strong>
            </span>
          </div>

          <div
            className={`summary-metric-pill ${
              evaluatedWeeksCount > 0 && reviewedCount === evaluatedWeeksCount ? 'all-reviewed' : ''
            }`}
            title="Teacher Reviews Completed"
          >
            <span className="metric-pill-icon">✓</span>
            <span>
              Reviewed: <strong>{reviewedCount}/{evaluatedWeeksCount}</strong>
            </span>
          </div>
        </div>

        {/* Right: Expand Toggle Button */}
        <div className="student-expand-action">
          <button
            type="button"
            className="btn-toggle-expand"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? 'Collapse student details' : 'Expand student details'}
          >
            <span className="expand-text">{isExpanded ? 'Collapse' : 'Expand'}</span>
            <span className={`expand-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
          </button>
        </div>
      </div>

      {/* Expanded Body: Weekly Reports Grid */}
      {isExpanded && (
        <div className="student-card-body">
          <div className="weeks-section-header">
            <h4 className="weeks-section-title">
              Weekly Laboratory Reports {activeWeekFilter !== 'ALL' ? `(${activeWeekFilter})` : ''}
            </h4>
            <span className="weeks-count-tag">
              {weeksToDisplay.length} {weeksToDisplay.length === 1 ? 'Report' : 'Reports'} Available
            </span>
          </div>

          {weeksToDisplay.length === 0 ? (
            <div className="empty-weeks-notice">
              <p>No evaluation report available for this student for the selected week filter.</p>
            </div>
          ) : (
            <div className="week-cards-grid">
              {weeksToDisplay.map((w) => (
                <WeekReportCard
                  key={w}
                  weekName={w}
                  evaluation={evaluations[w]}
                  studentId={studentId}
                  onViewReport={onViewReport}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
