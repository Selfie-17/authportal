import React, { useState, useEffect } from 'react';
import { evaluationService } from '../services/evaluationService';

/**
 * Single Student Teacher Report Component.
 *
 * Displays:
 * - Student ID & Week
 * - Final Score & Assessment
 * - Section-by-Section Score Breakdown
 * - Detailed Program / Question Analysis (dynamically rendered from JSON extraction/evaluation)
 * - Teacher Feedback Section:
 *     - Reviewed? [ Yes ] [ No ]
 *     - Multiline feedback text box
 *     - [Save Feedback] button
 */
export default function TeacherReportView({
  studentId,
  week,
  onBack,
  onFeedbackUpdated,
  onReportDeleted,
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Teacher feedback form state
  const [reviewed, setReviewed] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadReport();
  }, [studentId, week]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await evaluationService.getStudentReport(studentId, week);
      setReport(data);
      setReviewed(data.reviewed || false);
      setFeedbackText(data.feedbackText || '');
    } catch (err) {
      setError(err.message || 'Failed to load student evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    try {
      setSavingFeedback(true);
      setSaveError(null);
      setSaveSuccess(false);

      await evaluationService.saveFeedback({
        studentId,
        week,
        reviewed,
        feedbackText,
      });

      setSaveSuccess(true);
      if (onFeedbackUpdated) {
        onFeedbackUpdated(studentId, week, reviewed, feedbackText);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save feedback.');
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleDeleteReport = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${week} evaluation report for student ${studentId}?\n\nThis action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await evaluationService.deleteStudentReport(studentId, week);
      if (onReportDeleted) {
        onReportDeleted({ studentId, week });
      } else {
        onBack();
      }
    } catch (err) {
      alert(`Failed to delete report: ${err.message || 'Unknown error'}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="empty-state-icon">⏳</div>
        <h3>Loading Student Report...</h3>
        <p>Fetching evaluation data for {studentId} ({week})</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="portal-card" style={{ padding: '2rem' }}>
        <div className="alert-message error">
          <span>⚠️</span>
          <div>{error || 'Report not found.'}</div>
        </div>
        <button type="button" className="btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>
          ← Back to Evaluation Table
        </button>
      </div>
    );
  }

  // Extract programs from report.extraction if present
  const programs = report.extraction?.programs || {};
  const programKeys = Object.keys(programs);

  return (
    <div className="teacher-report-container">
      {/* Top Navigation Bar */}
      <div className="report-header-bar">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back to Evaluation Table
        </button>
        <div className="report-badge-group">
          <span className="student-badge">Student ID: <strong>{report.studentId}</strong></span>
          <span className="week-badge">{report.week}</span>
          {report.sectionId && <span className="section-badge">{report.sectionId}</span>}
          <span className={`review-badge-header ${reviewed ? 'reviewed' : 'not-reviewed'}`}>
            {reviewed ? 'Reviewed ✓' : 'Not Reviewed'}
          </span>
          <button
            type="button"
            className="btn-delete-report-danger"
            onClick={handleDeleteReport}
            disabled={deleting}
            title={`Delete ${report.week} evaluation report for ${report.studentId}`}
          >
            <span>🗑️</span> {deleting ? 'Deleting...' : 'Delete Report'}
          </button>
        </div>
      </div>

      {/* Main Report Card */}
      <div className="portal-card report-main-card">
        {/* Score & Assessment Summary */}
        <div className="report-summary-banner">
          <div className="report-score-box">
            <span className="score-label">Final Score</span>
            <span className="score-value">{report.finalScore || 'N/A'}</span>
            {report.totalScore && (
              <span className="score-subtext">Total Raw: {report.totalScore}</span>
            )}
          </div>
          <div className="report-assessment-box">
            <h4>Overall Assessment</h4>
            <p>{report.assessment || 'No assessment provided.'}</p>
          </div>
        </div>

        {/* Section-by-Section Score Breakdown */}
        <div className="report-section-block">
          <h3 className="section-title">📊 Section-by-Section Score Breakdown</h3>
          <div className="section-score-grid">
            <div className="score-card">
              <span className="score-card-number">1</span>
              <div className="score-card-content">
                <span className="score-card-label">Objective of the Lab</span>
                <span className="score-card-val">{report.objectiveScore || '—'}</span>
              </div>
            </div>

            <div className="score-card">
              <span className="score-card-number">2</span>
              <div className="score-card-content">
                <span className="score-card-label">Problem Understanding</span>
                <span className="score-card-val">{report.problemUnderstandingScore || '—'}</span>
              </div>
            </div>

            <div className="score-card">
              <span className="score-card-number">3</span>
              <div className="score-card-content">
                <span className="score-card-label">Logic / Approach Used</span>
                <span className="score-card-val">{report.logicScore || '—'}</span>
              </div>
            </div>

            <div className="score-card">
              <span className="score-card-number">4</span>
              <div className="score-card-content">
                <span className="score-card-label">Important Variables</span>
                <span className="score-card-val">{report.variablesScore || '—'}</span>
              </div>
            </div>

            <div className="score-card">
              <span className="score-card-number">5</span>
              <div className="score-card-content">
                <span className="score-card-label">What I Observed</span>
                <span className="score-card-val">{report.observationScore || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Program / Question Analysis */}
        <div className="report-section-block">
          <h3 className="section-title">
            🔬 Detailed Program / Question Analysis ({programKeys.length > 0 ? programKeys.length : 'Markdown'} Assigned Questions)
          </h3>

          {programKeys.length > 0 ? (
            <div className="program-list">
              {programKeys.map((pKey) => {
                const prog = programs[pKey];
                return (
                  <div key={pKey} className="program-item-card">
                    <div className="program-header">
                      <span className="program-tag">{pKey}</span>
                      <span className={`program-status-pill ${prog.status || 'detected'}`}>
                        {prog.status || 'detected'}
                      </span>
                      {prog.source_pages && (
                        <span className="program-pages">
                          Pages: {prog.source_pages.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="program-details-grid">
                      {prog.problem_understanding && (
                        <div className="program-field">
                          <strong>Problem Understanding:</strong>
                          <p>{prog.problem_understanding}</p>
                        </div>
                      )}

                      {prog.logic_approach && (
                        <div className="program-field">
                          <strong>Logic / Approach Used:</strong>
                          <p>{prog.logic_approach}</p>
                        </div>
                      )}

                      {prog.important_variables && prog.important_variables.length > 0 && (
                        <div className="program-field">
                          <strong>Important Variables:</strong>
                          <div className="variables-table-wrap">
                            <table className="mini-table">
                              <thead>
                                <tr>
                                  <th>Variable</th>
                                  <th>Purpose</th>
                                </tr>
                              </thead>
                              <tbody>
                                {prog.important_variables.map((v, idx) => (
                                  <tr key={idx}>
                                    <td><code>{v.variable}</code></td>
                                    <td>{v.purpose}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {prog.what_i_observed && (
                        <div className="program-field">
                          <strong>What I Observed:</strong>
                          <p>{prog.what_i_observed}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : report.rawEvaluationMarkdown ? (
            <div className="raw-markdown-view">
              <pre className="markdown-pre">{report.rawEvaluationMarkdown}</pre>
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>No program-specific analysis details available.</p>
          )}
        </div>

        {/* Teacher Feedback Section */}
        <div className="report-feedback-section">
          <div className="feedback-section-header">
            <h3>📝 Teacher Feedback</h3>
            <p className="feedback-hint">
              Review status and feedback are stored strictly for <strong>{report.studentId} + {report.week}</strong> and do NOT alter the AI evaluation scores.
            </p>
          </div>

          {saveSuccess && (
            <div className="alert-message success">
              <span>✅</span>
              <div>Teacher feedback saved successfully for {report.studentId} ({report.week})!</div>
            </div>
          )}

          {saveError && (
            <div className="alert-message error">
              <span>⚠️</span>
              <div>{saveError}</div>
            </div>
          )}

          <form onSubmit={handleSaveFeedback} className="feedback-form">
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Reviewed?
              </label>
              <div className="review-toggle-buttons">
                <button
                  type="button"
                  className={`btn-review-toggle ${reviewed ? 'selected-yes' : ''}`}
                  onClick={() => setReviewed(true)}
                >
                  ✓ Yes
                </button>
                <button
                  type="button"
                  className={`btn-review-toggle ${!reviewed ? 'selected-no' : ''}`}
                  onClick={() => setReviewed(false)}
                >
                  ✕ No
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" htmlFor="feedbackTextInput">
                Feedback:
              </label>
              <textarea
                id="feedbackTextInput"
                className="form-input feedback-textarea"
                rows="4"
                placeholder="Enter feedback for this student..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingFeedback}
                >
                  {savingFeedback ? '💾 Saving...' : 'Save Feedback'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onBack}
                >
                  Back to Table
                </button>
              </div>
              <button
                type="button"
                className="btn-delete-report-danger"
                onClick={handleDeleteReport}
                disabled={deleting}
              >
                <span>🗑️</span> {deleting ? 'Deleting...' : 'Delete Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
