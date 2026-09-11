import React from 'react';

/**
 * Compact Modern Card for a Single Week Evaluation.
 * Replaces the dense spreadsheet cell with a clean SaaS card.
 * Preserves all breakdown fields, review status, and View Report trigger.
 */
export default function WeekReportCard({ weekName, evaluation, studentId, onViewReport }) {
  if (!evaluation) {
    return (
      <div className="week-report-card empty">
        <div className="week-card-header">
          <span className="week-card-title">{weekName}</span>
          <span className="week-empty-tag">No Submission</span>
        </div>
        <div className="week-card-empty-body">
          <span>—</span>
        </div>
      </div>
    );
  }

  // Parse numeric score if possible to color-code score badge
  const finalScoreNum = parseFloat(evaluation.finalScore);
  let scoreClass = 'score-mid';
  if (!isNaN(finalScoreNum)) {
    if (finalScoreNum >= 7.0) scoreClass = 'score-high';
    else if (finalScoreNum < 5.0) scoreClass = 'score-low';
  }

  return (
    <div className={`week-report-card ${evaluation.reviewed ? 'is-reviewed' : ''}`}>
      {/* Header: Week title and Score Badge */}
      <div className="week-card-header">
        <div className="week-card-title-group">
          <span className="week-card-title">{weekName}</span>
          {evaluation.reviewed ? (
            <span className="week-review-tag reviewed" title="Reviewed by Teacher">
              Reviewed ✓
            </span>
          ) : (
            <span className="week-review-tag not-reviewed" title="Awaiting Teacher Review">
              Not Reviewed
            </span>
          )}
        </div>

        <div className={`week-score-pill ${scoreClass}`} title="Final Evaluation Score">
          <span className="score-value">{evaluation.finalScore || '—'}</span>
          <span className="score-max">/ 10</span>
        </div>
      </div>

      {/* Breakdown Metric Chips */}
      <div className="week-metrics-grid">
        <div className="metric-chip" title="Objective of the Lab">
          <span className="metric-chip-label">Objective</span>
          <span className="metric-chip-val">{evaluation.objectiveScore || '—'}</span>
        </div>
        <div className="metric-chip" title="Problem Understanding">
          <span className="metric-chip-label">Problem</span>
          <span className="metric-chip-val">{evaluation.problemUnderstandingScore || '—'}</span>
        </div>
        <div className="metric-chip" title="Logic / Approach Used">
          <span className="metric-chip-label">Logic</span>
          <span className="metric-chip-val">{evaluation.logicScore || '—'}</span>
        </div>
        <div className="metric-chip" title="Important Variables and Purpose">
          <span className="metric-chip-label">Variables</span>
          <span className="metric-chip-val">{evaluation.variablesScore || '—'}</span>
        </div>
        <div className="metric-chip" title="What I Observed">
          <span className="metric-chip-label">Observed</span>
          <span className="metric-chip-val">{evaluation.observationScore || '—'}</span>
        </div>
        <div className="metric-chip total-chip" title="Total Score">
          <span className="metric-chip-label">Total</span>
          <span className="metric-chip-val">{evaluation.totalScore || '—'}</span>
        </div>
      </div>

      {/* Action: View Report */}
      <div className="week-card-actions">
        <button
          type="button"
          className="btn-week-view-report"
          onClick={() => onViewReport({ studentId, week: weekName })}
          title={`View full detailed evaluation report and teacher feedback for ${studentId} - ${weekName}`}
        >
          View Report
        </button>
      </div>
    </div>
  );
}
