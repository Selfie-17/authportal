import React from 'react';

/**
 * Inline Expanded Week Report Card.
 * Inserts directly beneath the active student row and spans the full table width.
 * Displays multi-provider breakdown (Gemini, Ollama), score chips, review badge,
 * and direct "View Gemini Report" / "View Ollama Report" buttons.
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

  // Multi-provider evaluations check
  const availableProviders = evaluation.availableProviders || (evaluation.provider ? [evaluation.provider] : []);
  const hasGemini = availableProviders.includes('gemini') || !!evaluation.geminiScore;
  const hasOllama = availableProviders.includes('ollama') || !!evaluation.ollamaScore;

  const geminiData = evaluation.providers?.gemini;
  const ollamaData = evaluation.providers?.ollama;

  const geminiScore = evaluation.geminiScore || geminiData?.finalScore;
  const ollamaScore = evaluation.ollamaScore || ollamaData?.finalScore;

  // Compute lab date range subtext
  const weekNumMatch = weekName.match(/\d+/);
  const weekNum = weekNumMatch ? parseInt(weekNumMatch[0], 10) : 1;
  const dateSubtext = `Week ${weekNum} Evaluation Cycle`;

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
          {/* Multi-provider score pills */}
          {hasGemini && (
            <div className="expanded-score-pill gemini-pill" title="Gemini 2.5 Flash Evaluation Score">
              <span>Gemini:</span>
              <strong>{geminiScore || formattedScore}</strong>
            </div>
          )}

          {hasOllama && (
            <div className="expanded-score-pill ollama-pill" title="Ollama (Qwen2.5 Coder) Evaluation Score">
              <span>Ollama:</span>
              <strong>{ollamaScore || formattedScore}</strong>
            </div>
          )}

          {!hasGemini && !hasOllama && (
            <div className="expanded-score-pill">
              <strong>{formattedScore}</strong> / 10
            </div>
          )}

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
            <span className="exp-metric-label">D1: Syntax</span>
            <span className="exp-metric-value">{evaluation.objectiveScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">D2: Logic</span>
            <span className="exp-metric-value">{evaluation.problemUnderstandingScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">D3: Report</span>
            <span className="exp-metric-value">{evaluation.logicScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">D4: Concept</span>
            <span className="exp-metric-value">{evaluation.variablesScore || '—'}</span>
          </div>

          <div className="exp-metric-card">
            <span className="exp-metric-label">D5: Novelty</span>
            <span className="exp-metric-value">{evaluation.observationScore || '—'}</span>
          </div>

          <div className="exp-metric-card total-metric">
            <span className="exp-metric-label">Total</span>
            <span className="exp-metric-value">{evaluation.totalScore || formattedScore}</span>
          </div>
        </div>

        {/* Action Button: View Report, Delete */}
        <div className="expanded-actions-col">
          <button
            type="button"
            className="btn-view-report-primary"
            onClick={() => onViewReport({
              studentId,
              week: weekName,
              provider: hasGemini ? 'gemini' : hasOllama ? 'ollama' : undefined
            })}
            title={`Open evaluation report for ${studentId} (${weekName})`}
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
              <span>🗑️</span> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
