import React, { useState, useEffect, useRef } from 'react';
import { evaluationService } from '../services/evaluationService';
import ExtractedTextViewer from './teacher/ExtractedTextViewer';
import UploadedPdfViewer from './teacher/UploadedPdfViewer';

/**
 * Single Student Teacher Report Component.
 *
 * Displays:
 * - Student ID & Week
 * - Final Score Stepper (- marks +) & Assessment
 * - Section-by-Section Score Breakdown
 * - Detailed Program / Question Analysis
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

  // Active view tab: 'evaluation' | 'side-by-side'
  const [activeTab, setActiveTab] = useState('evaluation');

  // Teacher feedback form state
  const [reviewed, setReviewed] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Marks Stepper & Section Breakdown State
  const [currentScore, setCurrentScore] = useState(0);
  const [scoreInput, setScoreInput] = useState('');
  const [totalRaw, setTotalRaw] = useState('');
  const [scoreStatus, setScoreStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [scoreError, setScoreError] = useState(null);
  const debounceTimerRef = useRef(null);
  const latestScoreRef = useRef(0);

  // Section-by-Section state (Objective, Problem, Logic, Variables, Observed)
  const [sections, setSections] = useState({
    objective: { label: 'Objective of the Lab', score: 2, max: 2 },
    problem: { label: 'Problem Understanding', score: 8, max: 8 },
    logic: { label: 'Logic / Approach Used', score: 8, max: 8 },
    variables: { label: 'Important Variables', score: 1, max: 8 },
    observation: { label: 'What I Observed', score: 8, max: 8 },
  });
  const [sectionInputs, setSectionInputs] = useState({
    objective: '2',
    problem: '8',
    logic: '8',
    variables: '1',
    observation: '8',
  });
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    loadReport();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [studentId, week]);

  const extractNumericScore = (finalScoreStr) => {
    if (!finalScoreStr) return 0;
    const match = String(finalScoreStr).match(/^[\s]*([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      return !isNaN(parsed) ? parsed : 0;
    }
    const parsed = parseFloat(finalScoreStr);
    return !isNaN(parsed) ? parsed : 0;
  };

  const parseFractionScore = (str, defaultMax = 8) => {
    if (!str) return { score: 0, max: defaultMax };
    const parts = String(str).split('/');
    if (parts.length >= 2) {
      const s = parseFloat(parts[0]);
      const m = parseFloat(parts[1]);
      return {
        score: !isNaN(s) ? s : 0,
        max: !isNaN(m) && m > 0 ? m : defaultMax,
      };
    }
    const s = parseFloat(str);
    return {
      score: !isNaN(s) ? s : 0,
      max: defaultMax,
    };
  };

  const calculateTotals = (secs) => {
    let totalAwarded = 0;
    let totalMax = 0;
    Object.values(secs).forEach((sec) => {
      totalAwarded += sec.score;
      totalMax += sec.max;
    });
    totalAwarded = Math.round(totalAwarded * 100) / 100;
    totalMax = Math.round(totalMax * 100) / 100;

    let computedFinal = totalMax > 0 ? (totalAwarded / totalMax) * 10 : 0;
    computedFinal = Math.round(computedFinal * 100) / 100;
    computedFinal = Math.min(10, Math.max(0, computedFinal));

    const totalRawStr = `${totalAwarded} / ${totalMax}`;
    const finalScoreStr = `${computedFinal} / 10`;

    return {
      totalAwarded,
      totalMax,
      computedFinal,
      totalRawStr,
      finalScoreStr,
    };
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await evaluationService.getStudentReport(studentId, week);
      setReport(data);
      setReviewed(data.reviewed || false);
      setFeedbackText(data.feedbackText || '');

      const parsedSections = {
        objective: { label: 'Objective of the Lab', ...parseFractionScore(data.objectiveScore, 2) },
        problem: { label: 'Problem Understanding', ...parseFractionScore(data.problemUnderstandingScore, 8) },
        logic: { label: 'Logic / Approach Used', ...parseFractionScore(data.logicScore, 8) },
        variables: { label: 'Important Variables', ...parseFractionScore(data.variablesScore, 8) },
        observation: { label: 'What I Observed', ...parseFractionScore(data.observationScore, 8) },
      };
      setSections(parsedSections);
      sectionsRef.current = parsedSections;
      setSectionInputs({
        objective: String(parsedSections.objective.score),
        problem: String(parsedSections.problem.score),
        logic: String(parsedSections.logic.score),
        variables: String(parsedSections.variables.score),
        observation: String(parsedSections.observation.score),
      });

      const totals = calculateTotals(parsedSections);
      setTotalRaw(data.totalScore || totals.totalRawStr);

      const num = extractNumericScore(data.finalScore || totals.finalScoreStr);
      setCurrentScore(num);
      latestScoreRef.current = num;
      setScoreInput(String(num));
      setScoreStatus('idle');
      setScoreError(null);
    } catch (err) {
      setError(err.message || 'Failed to load student evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Persists all updated scores (final score, total raw, and 5 sections) to backend.
   */
  const persistScoreData = async ({ sections: secs, totalScore: rawTotal, finalScore: fScore, numericScore: numVal }) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const payload = {
      studentId,
      week,
      objectiveScore: `${secs.objective.score} / ${secs.objective.max}`,
      problemUnderstandingScore: `${secs.problem.score} / ${secs.problem.max}`,
      logicScore: `${secs.logic.score} / ${secs.logic.max}`,
      variablesScore: `${secs.variables.score} / ${secs.variables.max}`,
      observationScore: `${secs.observation.score} / ${secs.observation.max}`,
      totalScore: rawTotal,
      finalScore: fScore,
      numericScore: numVal,
    };

    try {
      setScoreStatus('saving');
      setScoreError(null);

      await evaluationService.updateScore(payload);

      setScoreStatus('saved');
      setReport((prev) =>
        prev
          ? {
              ...prev,
              finalScore: fScore,
              totalScore: rawTotal,
              objectiveScore: payload.objectiveScore,
              problemUnderstandingScore: payload.problemUnderstandingScore,
              logicScore: payload.logicScore,
              variablesScore: payload.variablesScore,
              observationScore: payload.observationScore,
            }
          : prev
      );

      // Carry full breakdown so evaluation table row and expanded week card update in real time
      if (onFeedbackUpdated) {
        onFeedbackUpdated(studentId, week, reviewed, feedbackText, {
          numericScore: numVal,
          formattedScore: fScore,
          totalScore: rawTotal,
          objectiveScore: payload.objectiveScore,
          problemUnderstandingScore: payload.problemUnderstandingScore,
          logicScore: payload.logicScore,
          variablesScore: payload.variablesScore,
          observationScore: payload.observationScore,
        });
      }

      setTimeout(() => {
        setScoreStatus((s) => (s === 'saved' ? 'idle' : s));
      }, 3000);
    } catch (err) {
      console.error('Failed to update scores:', err);
      setScoreStatus('error');
      setScoreError(err.message || 'Failed to update marks.');
    }
  };

  /**
   * Applies new section breakdown, recalculates Total Raw and Final Score, and persists.
   */
  const applySectionsUpdate = (nextSections) => {
    setSections(nextSections);
    sectionsRef.current = nextSections;
    setSectionInputs({
      objective: String(nextSections.objective.score),
      problem: String(nextSections.problem.score),
      logic: String(nextSections.logic.score),
      variables: String(nextSections.variables.score),
      observation: String(nextSections.observation.score),
    });

    const { computedFinal, totalRawStr, finalScoreStr } = calculateTotals(nextSections);
    setTotalRaw(totalRawStr);
    setCurrentScore(computedFinal);
    latestScoreRef.current = computedFinal;
    setScoreInput(String(computedFinal));

    persistScoreData({
      sections: nextSections,
      totalScore: totalRawStr,
      finalScore: finalScoreStr,
      numericScore: computedFinal,
    });
  };

  /**
   * Adjusts a specific section by +1 or -1.
   */
  const handleSectionStep = (secKey, delta) => {
    const sec = sectionsRef.current[secKey];
    if (!sec) return;
    const nextVal = Math.min(sec.max, Math.max(0, Math.round((sec.score + delta) * 100) / 100));
    if (nextVal === sec.score) return;

    const nextSections = {
      ...sectionsRef.current,
      [secKey]: { ...sec, score: nextVal },
    };
    applySectionsUpdate(nextSections);
  };

  const handleSectionInputChange = (secKey, val) => {
    setSectionInputs((prev) => ({ ...prev, [secKey]: val }));
    setScoreStatus('idle');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (val.trim() === '') return;

    debounceTimerRef.current = setTimeout(() => {
      commitSectionInput(secKey, val);
    }, 700);
  };

  const commitSectionInput = (secKey, val) => {
    const sec = sectionsRef.current[secKey];
    if (!sec) return;
    let parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setSectionInputs((prev) => ({ ...prev, [secKey]: String(sec.score) }));
      return;
    }
    parsed = Math.min(sec.max, Math.max(0, Math.round(parsed * 100) / 100));
    const nextSections = {
      ...sectionsRef.current,
      [secKey]: { ...sec, score: parsed },
    };
    applySectionsUpdate(nextSections);
  };

  const handleSectionInputBlur = (secKey) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const val = sectionInputs[secKey];
    if (!val || val.trim() === '') {
      setSectionInputs((prev) => ({ ...prev, [secKey]: String(sectionsRef.current[secKey].score) }));
      return;
    }
    commitSectionInput(secKey, val);
  };

  /**
   * Top Final Score Stepper: adjusts by +1 / -1 and synchronizes sections and Total Raw.
   */
  const handleFinalScoreStep = (delta) => {
    const current = latestScoreRef.current;
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 100) / 100));
    if (next === current) return;
    syncFinalScoreToSections(next);
  };

  const syncFinalScoreToSections = (targetFinal) => {
    const currentSecs = sectionsRef.current;
    let totalMax = 0;
    let currentRaw = 0;
    Object.values(currentSecs).forEach((s) => {
      totalMax += s.max;
      currentRaw += s.score;
    });

    const targetRaw = Math.min(totalMax, Math.max(0, Math.round((targetFinal / 10) * totalMax)));
    let rawDelta = targetRaw - currentRaw;

    const nextSecs = {
      objective: { ...currentSecs.objective },
      problem: { ...currentSecs.problem },
      logic: { ...currentSecs.logic },
      variables: { ...currentSecs.variables },
      observation: { ...currentSecs.observation },
    };

    if (rawDelta > 0) {
      // Allocate to sections with the most deficit (lowest score/max ratio first)
      const sortedKeys = ['variables', 'observation', 'logic', 'problem', 'objective'].sort(
        (a, b) => (nextSecs[a].score / nextSecs[a].max) - (nextSecs[b].score / nextSecs[b].max)
      );
      for (const k of sortedKeys) {
        if (rawDelta <= 0) break;
        const available = nextSecs[k].max - nextSecs[k].score;
        if (available > 0) {
          const add = Math.min(available, rawDelta);
          nextSecs[k].score = Math.round((nextSecs[k].score + add) * 100) / 100;
          rawDelta -= add;
        }
      }
    } else if (rawDelta < 0) {
      let neededDeduct = Math.abs(rawDelta);
      const sortedKeys = ['variables', 'observation', 'logic', 'problem', 'objective'].sort(
        (a, b) => nextSecs[b].score - nextSecs[a].score
      );
      for (const k of sortedKeys) {
        if (neededDeduct <= 0) break;
        const deduct = Math.min(nextSecs[k].score, neededDeduct);
        nextSecs[k].score = Math.round((nextSecs[k].score - deduct) * 100) / 100;
        neededDeduct -= deduct;
      }
    }

    applySectionsUpdate(nextSecs);
  };

  const handleScoreInputChange = (e) => {
    const val = e.target.value;
    setScoreInput(val);
    setScoreStatus('idle');
    setScoreError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (val.trim() === '') return;

    debounceTimerRef.current = setTimeout(() => {
      let parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        parsed = Math.min(10, Math.max(0, Math.round(parsed * 100) / 100));
        syncFinalScoreToSections(parsed);
      }
    }, 700);
  };

  const handleScoreInputBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    let parsed = parseFloat(scoreInput);
    if (isNaN(parsed)) {
      setScoreInput(String(currentScore));
      return;
    }
    parsed = Math.min(10, Math.max(0, Math.round(parsed * 100) / 100));
    syncFinalScoreToSections(parsed);
  };

  const handleScoreInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScoreInputBlur();
    }
  };

  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    try {
      setSavingFeedback(true);
      setSaveError(null);
      setSaveSuccess(false);

      const secs = sectionsRef.current;
      const formatted = `${currentScore} / 10`;

      await evaluationService.saveFeedback({
        studentId,
        week,
        reviewed,
        feedbackText,
        finalScore: formatted,
        numericScore: currentScore,
        totalScore: totalRaw,
        objectiveScore: `${secs.objective.score} / ${secs.objective.max}`,
        problemUnderstandingScore: `${secs.problem.score} / ${secs.problem.max}`,
        logicScore: `${secs.logic.score} / ${secs.logic.max}`,
        variablesScore: `${secs.variables.score} / ${secs.variables.max}`,
        observationScore: `${secs.observation.score} / ${secs.observation.max}`,
      });

      setSaveSuccess(true);
      if (onFeedbackUpdated) {
        onFeedbackUpdated(studentId, week, reviewed, feedbackText, {
          numericScore: currentScore,
          formattedScore: formatted,
          totalScore: totalRaw,
          objectiveScore: `${secs.objective.score} / ${secs.objective.max}`,
          problemUnderstandingScore: `${secs.problem.score} / ${secs.problem.max}`,
          logicScore: `${secs.logic.score} / ${secs.logic.max}`,
          variablesScore: `${secs.variables.score} / ${secs.variables.max}`,
          observationScore: `${secs.observation.score} / ${secs.observation.max}`,
        });
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

      {/* Two-Tab Report Navigation: Evaluation Report | Side-by-Side */}
      <div className="report-nav-tabs" role="tablist">
        <button
          type="button"
          className={`report-nav-tab ${activeTab === 'evaluation' ? 'active' : ''}`}
          onClick={() => setActiveTab('evaluation')}
        >
          <span>📊 Evaluation Report</span>
        </button>
        <button
          type="button"
          className={`report-nav-tab ${activeTab === 'side-by-side' ? 'active' : ''}`}
          onClick={() => setActiveTab('side-by-side')}
          title="Compare OCR extracted text and original PDF side by side"
        >
          <span>◫ Side-by-Side</span>
        </button>
      </div>

      {/* Side-by-Side View (OCR Extracted Text + Student Uploaded PDF) */}
      {activeTab === 'side-by-side' && (
        <div className="report-side-by-side-layout">
          <div className="side-by-side-column ocr-column">
            <div className="side-by-side-col-header">
              <span className="side-col-title">📝 Extracted OCR Text</span>
            </div>
            <ExtractedTextViewer
              studentId={report.studentId}
              week={report.week}
              report={report}
            />
          </div>
          <div className="side-by-side-column pdf-column">
            <div className="side-by-side-col-header">
              <span className="side-col-title">📄 Student Uploaded PDF</span>
            </div>
            <UploadedPdfViewer
              studentId={report.studentId}
              week={report.week}
              report={report}
            />
          </div>
        </div>
      )}

      {/* Evaluation Report Card */}
      {activeTab === 'evaluation' && (
        <div className="portal-card report-main-card">
          {/* Score & Assessment Banner with Marks Stepper (- marks +) */}
          <div className="report-summary-banner">
            <div className="report-score-box">
              <span className="score-label">Final Score</span>

              {/* Interactive Marks Stepper (- marks +) */}
              <div className="marks-stepper-widget">
                <button
                  type="button"
                  className="marks-stepper-btn decrement"
                  onClick={() => handleFinalScoreStep(-1)}
                  disabled={scoreStatus === 'saving' || currentScore <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease mark by 1"
                >
                  −
                </button>

                <div className="marks-input-wrapper">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    className="marks-stepper-input"
                    value={scoreInput}
                    onChange={handleScoreInputChange}
                    onBlur={handleScoreInputBlur}
                    onKeyDown={handleScoreInputKeyDown}
                    disabled={scoreStatus === 'saving'}
                    title="Directly enter marks (0 - 10)"
                    aria-label="Awarded marks out of 10"
                  />
                  <span className="marks-stepper-scale">/ 10</span>
                </div>

                <button
                  type="button"
                  className="marks-stepper-btn increment"
                  onClick={() => handleFinalScoreStep(1)}
                  disabled={scoreStatus === 'saving' || currentScore >= 10}
                  title="Increase mark by 1"
                  aria-label="Increase mark by 1"
                >
                  +
                </button>
              </div>

              {/* Real-time status indicator: Saving... / Saved ✓ / Error */}
              <div className="marks-status-area">
                {scoreStatus === 'saving' && (
                  <span className="marks-status-pill saving">Saving...</span>
                )}
                {scoreStatus === 'saved' && (
                  <span className="marks-status-pill saved">Saved ✓</span>
                )}
                {scoreStatus === 'error' && (
                  <span className="marks-status-pill error" title={scoreError}>
                    ⚠️ {scoreError || 'Error'}
                  </span>
                )}
              </div>

              {(totalRaw || report.totalScore) && (
                <span className="score-subtext">Total Raw: {totalRaw || report.totalScore}</span>
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
            {/* Section 1: Objective of the Lab */}
            <div className="score-card">
              <div className="score-card-header">
                <span className="score-card-number">1</span>
                <span className="score-card-label" title="Objective of the Lab">Objective of the Lab</span>
              </div>
              <div className="section-stepper-widget">
                <button
                  type="button"
                  className="sec-step-btn decrement"
                  onClick={() => handleSectionStep('objective', -1)}
                  disabled={scoreStatus === 'saving' || sections.objective.score <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease Objective mark by 1"
                >
                  −
                </button>
                <div className="sec-step-pill">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={sections.objective.max}
                    className="sec-step-input"
                    value={sectionInputs.objective}
                    onChange={(e) => handleSectionInputChange('objective', e.target.value)}
                    onBlur={() => handleSectionInputBlur('objective')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('objective')}
                    disabled={scoreStatus === 'saving'}
                    aria-label="Objective of the Lab mark"
                  />
                  <span className="sec-step-denom">/ {sections.objective.max}</span>
                </div>
                <button
                  type="button"
                  className="sec-step-btn increment"
                  onClick={() => handleSectionStep('objective', 1)}
                  disabled={scoreStatus === 'saving' || sections.objective.score >= sections.objective.max}
                  title="Increase mark by 1"
                  aria-label="Increase Objective mark by 1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 2: Problem Understanding */}
            <div className="score-card">
              <div className="score-card-header">
                <span className="score-card-number">2</span>
                <span className="score-card-label" title="Problem Understanding">Problem Understanding</span>
              </div>
              <div className="section-stepper-widget">
                <button
                  type="button"
                  className="sec-step-btn decrement"
                  onClick={() => handleSectionStep('problem', -1)}
                  disabled={scoreStatus === 'saving' || sections.problem.score <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease Problem Understanding mark by 1"
                >
                  −
                </button>
                <div className="sec-step-pill">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={sections.problem.max}
                    className="sec-step-input"
                    value={sectionInputs.problem}
                    onChange={(e) => handleSectionInputChange('problem', e.target.value)}
                    onBlur={() => handleSectionInputBlur('problem')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('problem')}
                    disabled={scoreStatus === 'saving'}
                    aria-label="Problem Understanding mark"
                  />
                  <span className="sec-step-denom">/ {sections.problem.max}</span>
                </div>
                <button
                  type="button"
                  className="sec-step-btn increment"
                  onClick={() => handleSectionStep('problem', 1)}
                  disabled={scoreStatus === 'saving' || sections.problem.score >= sections.problem.max}
                  title="Increase mark by 1"
                  aria-label="Increase Problem Understanding mark by 1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 3: Logic / Approach Used */}
            <div className="score-card">
              <div className="score-card-header">
                <span className="score-card-number">3</span>
                <span className="score-card-label" title="Logic / Approach Used">Logic / Approach Used</span>
              </div>
              <div className="section-stepper-widget">
                <button
                  type="button"
                  className="sec-step-btn decrement"
                  onClick={() => handleSectionStep('logic', -1)}
                  disabled={scoreStatus === 'saving' || sections.logic.score <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease Logic mark by 1"
                >
                  −
                </button>
                <div className="sec-step-pill">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={sections.logic.max}
                    className="sec-step-input"
                    value={sectionInputs.logic}
                    onChange={(e) => handleSectionInputChange('logic', e.target.value)}
                    onBlur={() => handleSectionInputBlur('logic')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('logic')}
                    disabled={scoreStatus === 'saving'}
                    aria-label="Logic / Approach Used mark"
                  />
                  <span className="sec-step-denom">/ {sections.logic.max}</span>
                </div>
                <button
                  type="button"
                  className="sec-step-btn increment"
                  onClick={() => handleSectionStep('logic', 1)}
                  disabled={scoreStatus === 'saving' || sections.logic.score >= sections.logic.max}
                  title="Increase mark by 1"
                  aria-label="Increase Logic mark by 1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 4: Important Variables */}
            <div className="score-card">
              <div className="score-card-header">
                <span className="score-card-number">4</span>
                <span className="score-card-label" title="Important Variables">Important Variables</span>
              </div>
              <div className="section-stepper-widget">
                <button
                  type="button"
                  className="sec-step-btn decrement"
                  onClick={() => handleSectionStep('variables', -1)}
                  disabled={scoreStatus === 'saving' || sections.variables.score <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease Important Variables mark by 1"
                >
                  −
                </button>
                <div className="sec-step-pill">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={sections.variables.max}
                    className="sec-step-input"
                    value={sectionInputs.variables}
                    onChange={(e) => handleSectionInputChange('variables', e.target.value)}
                    onBlur={() => handleSectionInputBlur('variables')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('variables')}
                    disabled={scoreStatus === 'saving'}
                    aria-label="Important Variables mark"
                  />
                  <span className="sec-step-denom">/ {sections.variables.max}</span>
                </div>
                <button
                  type="button"
                  className="sec-step-btn increment"
                  onClick={() => handleSectionStep('variables', 1)}
                  disabled={scoreStatus === 'saving' || sections.variables.score >= sections.variables.max}
                  title="Increase mark by 1"
                  aria-label="Increase Important Variables mark by 1"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 5: What I Observed */}
            <div className="score-card">
              <div className="score-card-header">
                <span className="score-card-number">5</span>
                <span className="score-card-label" title="What I Observed">What I Observed</span>
              </div>
              <div className="section-stepper-widget">
                <button
                  type="button"
                  className="sec-step-btn decrement"
                  onClick={() => handleSectionStep('observation', -1)}
                  disabled={scoreStatus === 'saving' || sections.observation.score <= 0}
                  title="Decrease mark by 1"
                  aria-label="Decrease What I Observed mark by 1"
                >
                  −
                </button>
                <div className="sec-step-pill">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max={sections.observation.max}
                    className="sec-step-input"
                    value={sectionInputs.observation}
                    onChange={(e) => handleSectionInputChange('observation', e.target.value)}
                    onBlur={() => handleSectionInputBlur('observation')}
                    onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('observation')}
                    disabled={scoreStatus === 'saving'}
                    aria-label="What I Observed mark"
                  />
                  <span className="sec-step-denom">/ {sections.observation.max}</span>
                </div>
                <button
                  type="button"
                  className="sec-step-btn increment"
                  onClick={() => handleSectionStep('observation', 1)}
                  disabled={scoreStatus === 'saving' || sections.observation.score >= sections.observation.max}
                  title="Increase mark by 1"
                  aria-label="Increase What I Observed mark by 1"
                >
                  +
                </button>
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
    )}
  </div>
);
}
