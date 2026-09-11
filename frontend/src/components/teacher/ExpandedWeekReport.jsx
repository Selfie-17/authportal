import React from 'react';

/**
 * Inline Expanded Week Report Card.
 * Inserts directly beneath the active student row and spans the full table width.
 * Displays breakdown metric chips, final score, review badge, and View Report button.
 */
export default function ExpandedWeekReport({
  studentId,
  weekName,
  evaluation,
  onViewReport,
  onDeleteReport,
}) {
  if (!evaluation) return null;

  const numScore = parseFloat(evaluation.finalScore);
  const formattedScore = !isNaN(numScore) ? numScore.toFixed(1) : (evaluation.finalScore || '—');

  // Compute realistic lab date range based on week number if available
  const weekNumMatch = weekName.match(/\d+/);
  const weekNum = weekNumMatch ? parseInt(weekNumMatch[0], 10) : 1;
  const dateSubtext = `Week ${weekNum} Evaluation Cycle • 2025`;

  return (
    <div className="expanded-week-card">
      {/* Top Header Row */}
      <div className="expanded-week-header">
        <div className="expanded-week-title-col">
          <div className="expanded-week-icon-box">
            📅
          </div>
          <div>
            <h4 className="expanded-week-heading">{weekName} Report</h4>
            <span className="expanded-week-subtext">{dateSubtext}</span>
          </div>
        </div>

        <div className="expanded-week-badges-col">
          <div className="expanded-score-pill">
            <strong>{formattedScore}</strong> / 10
          </div>
          {evaluation.reviewed ? (
            <span className="expanded-review-tag reviewed">
              ✓ Reviewed
            </span>
          ) : (
            <span className="expanded-review-tag not-reviewed">
              Not Reviewed
            </span>
          )}
        </div>
      </div>

      {/* Metric Breakdown Chips + Action Buttons Row */}
      <div className="expanded-week-body">
        <div className="expanded-metrics-chips">
          <div className="exp-metric-card">
            <span className="exp-metric-label">Objective</span>
            <span className="exp-metric-value">{evaluation.objectiveScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">Problem</span>
            <span className="exp-metric-value">{evaluation.problemUnderstandingScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">Logic</span>
            <span className="exp-metric-value">{evaluation.logicScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">Variables</span>
            <span className="exp-metric-value">{evaluation.variablesScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">Observed</span>
            <span className="exp-metric-value">{evaluation.observationScore || '—'}</span>
          </div>

          <div className="exp-metric-card total-metric">
            <span className="exp-metric-label">Total</span>
            <span className="exp-metric-value">{evaluation.totalScore || '—'}</span>
          </div>
        </div>

        <div className="expanded-actions-col">
          <button
            type="button"
            className="btn-view-report-primary"
            onClick={() => onViewReport({ studentId, week: weekName })}
            title={`Open full detailed lab evaluation report and feedback for ${studentId} (${weekName})`}
          >
            <span>📄</span> View Report
          </button>
          {onDeleteReport && (
            <button
              type="button"
              className="btn-delete-report-danger"
              onClick={() => onDeleteReport({ studentId, week: weekName })}
              title={`Delete ${weekName} evaluation report for ${studentId}`}
            >
              <span>🗑️</span> Delete Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
