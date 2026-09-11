import React from 'react';

/**
 * Single Week Score Badge/Chip for the common table.
 * Displays color-coded numeric score (e.g. 8.5) or '-' for unevaluated weeks.
 * Supports interactive expansion toggle with keyboard accessibility.
 */
export default function WeekScoreCell({
  weekName,
  evaluation,
  isActive,
  onToggleWeek,
}) {
  if (!evaluation) {
    return (
      <td className="score-cell empty-cell">
        <span className="score-chip-dash" aria-hidden="true">
          -
        </span>
      </td>
    );
  }

  // Parse numeric score to determine visual color category
  const numScore = parseFloat(evaluation.finalScore);
  let scoreClass = 'score-chip-mid'; // default yellow/amber (5.0 - 6.9)
  let formattedScore = evaluation.finalScore || '—';

  if (!isNaN(numScore)) {
    formattedScore = numScore.toFixed(1);
    if (numScore >= 7.0) {
      scoreClass = 'score-chip-high'; // soft green (>= 7.0)
    } else if (numScore < 5.0) {
      scoreClass = 'score-chip-low'; // soft red (< 5.0)
    }
  }

  return (
    <td className="score-cell">
      <button
        type="button"
        className={`score-chip-btn ${scoreClass} ${isActive ? 'active-selected' : ''}`}
        onClick={() => onToggleWeek(weekName)}
        aria-expanded={isActive}
        aria-label={isActive ? `Collapse ${weekName} report` : `Expand ${weekName} report (Score: ${formattedScore}/10)`}
        title={`${weekName}: ${formattedScore}/10 — Click to ${isActive ? 'collapse' : 'expand'} report`}
      >
        {formattedScore}
      </button>
    </td>
  );
}
