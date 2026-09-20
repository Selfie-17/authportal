import React from 'react';

/**
 * Single Week Score Badge/Chip for the common table.
 * Displays color-coded numeric score (e.g. 8.5) or '-' for unevaluated weeks.
 * Supports multi-provider view (Gemini, Ollama) and interactive expansion toggle.
 */
export default function WeekScoreCell({
  weekName,
  evaluation,
  isActive,
  onToggleWeek,
  providerFilter = 'all',
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

  // Resolve score based on selected provider view
  let rawScore = evaluation.finalScore;
  if (providerFilter === 'gemini') {
    rawScore = evaluation.geminiScore || (evaluation.provider === 'gemini' ? evaluation.finalScore : null);
  } else if (providerFilter === 'ollama') {
    rawScore = evaluation.ollamaScore || (evaluation.provider === 'ollama' ? evaluation.finalScore : null);
  }

  if (rawScore === null || rawScore === undefined) {
    return (
      <td className="score-cell empty-cell">
        <span className="score-chip-dash" title={`No ${providerFilter.toUpperCase()} evaluation for ${weekName}`} aria-hidden="true">
          -
        </span>
      </td>
    );
  }

  // Parse numeric score to determine visual color category
  const numScore = parseFloat(rawScore);
  let scoreClass = 'score-chip-mid'; // default yellow/amber (5.0 - 6.9)
  let formattedScore = rawScore || '—';

  if (!isNaN(numScore)) {
    formattedScore = numScore.toFixed(1);
    if (numScore >= 7.0) {
      scoreClass = 'score-chip-high'; // soft green (>= 7.0)
    } else if (numScore < 5.0) {
      scoreClass = 'score-chip-low'; // soft red (< 5.0)
    }
  }

  const hasMultiple = evaluation.availableProviders && evaluation.availableProviders.length > 1;

  return (
    <td className="score-cell">
      <button
        type="button"
        className={`score-chip-btn ${scoreClass} ${isActive ? 'active-selected' : ''}`}
        onClick={() => onToggleWeek(weekName)}
        aria-expanded={isActive}
        aria-label={isActive ? `Collapse ${weekName} report` : `Expand ${weekName} report (Score: ${formattedScore}/10)`}
        title={`${weekName}: ${formattedScore}/10 ${hasMultiple ? '(Both Gemini & Ollama available)' : ''} — Click to ${isActive ? 'collapse' : 'expand'} report`}
      >
        <span>{formattedScore}</span>
        {hasMultiple && providerFilter === 'all' && (
          <span className="score-chip-multi-dot" title="Multiple AI evaluations available (Gemini & Ollama)">•</span>
        )}
      </button>
    </td>
  );
}
