import React, { useState, useEffect, useRef } from 'react';
import { evaluationService } from '../services/evaluationService';
import ExtractedTextViewer from './teacher/ExtractedTextViewer';
import UploadedPdfViewer from './teacher/UploadedPdfViewer';
import MarkdownReportRenderer from './teacher/MarkdownReportRenderer';

/**
 * Single Student Teacher Report Component.
 *
 * Supports:
 * - Multi-provider AI reports: Gemini Report & Ollama Report with instant switcher
 * - Schema 2.0 dimensions (D1..D5), model name, grade, status, strengths, recommendations
 * - Rich markdown and table report rendering
 * - Interactive Final Score Stepper (- marks +) & Assessment
 * - Section-by-Section Score Breakdown
 * - Side-by-side comparison with original student PDF
 * - Teacher Feedback Section:
 *     - Reviewed? [ Yes ] [ No ]
 *     - Multiline feedback text box
 *     - [Save Feedback] button
 */
export default function TeacherReportView({
  studentId,
  week,
  initialProvider = null,
  onBack,
  onFeedbackUpdated,
  onReportDeleted,
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(initialProvider);

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

  // Section-by-Section state
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
    loadReport(selectedProvider);
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

  const parseFractionScore = (str, defaultMax = 2) => {
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

  const applyReportScores = (data, targetProv = null) => {
    if (targetProv) {
      setSelectedProvider(targetProv);
    } else if (data.provider) {
      setSelectedProvider(data.provider);
    }
    setReviewed(data.reviewed || false);
    setFeedbackText(data.feedbackText || '');

    const isSchema2 = Boolean(data.criteriaScores && Object.keys(data.criteriaScores).length > 0);

    const parsedSections = isSchema2
      ? {
        objective: {
          label: data.criteriaScores?.D1?.name || 'D1: Syntax & Validity',
          ...parseFractionScore(data.objectiveScore, data.criteriaScores?.D1?.max_score || 2),
        },
        problem: {
          label: data.criteriaScores?.D2?.name || 'D2: Algorithmic Logic',
          ...parseFractionScore(data.problemUnderstandingScore, data.criteriaScores?.D2?.max_score || 2),
        },
        logic: {
          label: data.criteriaScores?.D3?.name || 'D3: Report Quality',
          ...parseFractionScore(data.logicScore, data.criteriaScores?.D3?.max_score || 2),
        },
        variables: {
          label: data.criteriaScores?.D4?.name || 'D4: Concept Consistency',
          ...parseFractionScore(data.variablesScore, data.criteriaScores?.D4?.max_score || 2),
        },
        observation: {
          label: data.criteriaScores?.D5?.name || 'D5: Novelty & Innovation',
          ...parseFractionScore(data.observationScore, data.criteriaScores?.D5?.max_score || 2),
        },
      }
      : {
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
  };

  const loadReport = async (targetProvider = null) => {
    try {
      if (!report) {
        setLoading(true);
      }
      setError(null);
      const data = await evaluationService.getStudentReport(studentId, week, targetProvider);
      setReport(data);

      const activeProv = targetProvider || data.provider || 'gemini';
      const subReport = data.reports && data.reports[activeProv.toLowerCase()];
      if (subReport) {
        applyReportScores(subReport, activeProv);
      } else {
        applyReportScores(data, data.provider || activeProv);
      }
    } catch (err) {
      setError(err.message || 'Failed to load student evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProvider = async (prov) => {
    if (prov === selectedProvider || switchingProvider) return;
    const targetKey = prov.toLowerCase();

    // 1. Instant 0ms switch from bundled reports in memory (0 network requests, 0 unmounting)
    const bundledSub = report?.reports?.[targetKey];
    if (bundledSub) {
      setSelectedProvider(prov);
      setReport((prev) => ({
        ...prev,
        ...bundledSub,
        provider: prov,
        reports: prev.reports,
        availableProviders: prev.availableProviders || Object.keys(prev.reports || {}),
      }));
      applyReportScores(bundledSub, prov);
      return;
    }

    // 2. Non-destructive background switch if not already present in memory
    try {
      setSwitchingProvider(true);
      const data = await evaluationService.getStudentReport(studentId, week, prov);
      if (data) {
        setReport(data);
        const sub = data.reports?.[targetKey] || data;
        applyReportScores(sub, prov);
      }
    } catch (err) {
      console.error('Failed to switch provider report:', err);
    } finally {
      setSwitchingProvider(false);
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

  const applySectionsUpdate = (nextSections, debounceMs = 600) => {
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

    const payloadParams = {
      sections: nextSections,
      totalScore: totalRawStr,
      finalScore: finalScoreStr,
      numericScore: computedFinal,
    };

    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setScoreStatus('saving');
      debounceTimerRef.current = setTimeout(() => {
        persistScoreData(payloadParams);
      }, debounceMs);
    } else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      persistScoreData(payloadParams);
    }
  };

  const handleSectionStep = (secKey, delta) => {
    const sec = sectionsRef.current[secKey];
    if (!sec) return;
    const nextVal = Math.min(sec.max, Math.max(0, Math.round((sec.score + delta) * 100) / 100));
    if (nextVal === sec.score) return;

    const nextSections = {
      ...sectionsRef.current,
      [secKey]: { ...sec, score: nextVal },
    };
    applySectionsUpdate(nextSections, 600);
  };

  const handleSectionInputChange = (secKey, val) => {
    setSectionInputs((prev) => ({ ...prev, [secKey]: val }));
    setScoreStatus('idle');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (val.trim() === '') return;

    debounceTimerRef.current = setTimeout(() => {
      commitSectionInput(secKey, val, 0);
    }, 600);
  };

  const commitSectionInput = (secKey, val, debounceMs = 0) => {
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
    applySectionsUpdate(nextSections, debounceMs);
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
    commitSectionInput(secKey, val, 0);
  };

  const handleFinalScoreStep = (delta) => {
    const current = latestScoreRef.current;
    const next = Math.min(10, Math.max(0, Math.round((current + delta) * 100) / 100));
    if (next === current) return;
    syncFinalScoreToSections(next, 600);
  };

  const syncFinalScoreToSections = (targetFinal, debounceMs = 600) => {
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

    applySectionsUpdate(nextSecs, debounceMs);
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
        syncFinalScoreToSections(parsed, 0);
      }
    }, 600);
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
    syncFinalScoreToSections(parsed, 0);
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
      `Are you sure you want to delete the ${week} (${selectedProvider ? selectedProvider.toUpperCase() : 'AI'}) report for student ${studentId}?\n\nThis action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await evaluationService.deleteStudentReport(studentId, week, selectedProvider);
      if (onReportDeleted) {
        onReportDeleted({ studentId, week, provider: selectedProvider });
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      alert(`Failed to delete report: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ color: '#0f172a' }}>Loading Evaluation Report...</h3>
        <p style={{ color: '#64748b' }}>
          Loading evaluation for <strong>{studentId}</strong> ({week}).
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="portal-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
        <h3 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Failed to Load Report</h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>{error || 'Report data not found.'}</p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back to Table
        </button>
      </div>
    );
  }

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

          {/* Model Tag Badge */}
          {report.provider && (
            <span className={`provider-model-badge ${report.provider}`}>
              {report.provider === 'gemini' ? '✨ Gemini' : '🦙 Ollama'}
              {report.modelName ? ` • ${report.modelName}` : ''}
            </span>
          )}

          {/* Academic Grade Badge */}
          {report.grade && (
            <span className={`academic-grade-badge ${report.grade.startsWith('A') || report.grade.startsWith('B') ? 'grade-good' : 'grade-fail'}`}>
              Grade: <strong>{report.grade}</strong>
            </span>
          )}

          {/* Status Badge */}
          {report.status && (
            <span className={`approval-status-badge ${report.status === 'Approved' ? 'approved' : 'revision'}`}>
              {report.status}
            </span>
          )}

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
            <span>🗑️</span> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Top Bar with Navigation Tabs and Select Report switcher */}
      <div className="report-tabs-and-switcher-bar">
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

        {/* Report Selector: Select report to view when multiple exist (only on Evaluation tab) */}
        {activeTab !== 'side-by-side' && report.availableProviders && report.availableProviders.length > 1 && (
          <div className="report-select-model-group">
            <span className="report-select-model-label">Select Report:</span>
            <div className="report-select-model-pills">
              {report.availableProviders.map((prov) => {
                const isGemini = prov.toLowerCase() === 'gemini';
                const isOllama = prov.toLowerCase() === 'ollama';
                const isCurrent = (selectedProvider || report.provider || 'gemini').toLowerCase() === prov.toLowerCase();
                return (
                  <button
                    key={prov}
                    type="button"
                    className={`model-select-pill-btn ${isCurrent ? 'active' : ''}`}
                    onClick={() => handleSwitchProvider(prov)}
                    disabled={loading || switchingProvider}
                    title={`View ${isGemini ? 'Gemini' : isOllama ? 'Ollama' : prov} evaluation report`}
                  >
                    <span>{isGemini ? '✨ Gemini' : isOllama ? '🦙 Ollama' : prov}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
        <div className="report-main-card">
          {/* Score & Assessment Banner with Marks Stepper */}
          <div className="report-summary-banner">
            <div className="report-score-box">
              <span className="score-label">FINAL SCORE</span>

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

              <div className="marks-total-raw-text">
                Total Raw: {totalRaw}
              </div>

              {/* Real-time status indicator */}
              {scoreStatus !== 'idle' && (
                <div className="marks-status-area">
                  {scoreStatus === 'saving' && (
                    <span className="marks-status-pill saving">Saving...</span>
                  )}
                  {scoreStatus === 'saved' && (
                    <span className="marks-status-pill saved">Saved ✓</span>
                  )}
                  {scoreStatus === 'error' && (
                    <span className="marks-status-pill error" title={scoreError}>
                      Save Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="report-assessment-box">
              <span className="assessment-label">Overall Assessment</span>
              <p className="assessment-text">
                {report.assessment || 'Unified evaluation completed.'}
              </p>
            </div>
          </div>

          {/* Section Breakdown Steppers */}
          <div className="score-breakdown-section">
            <div className="score-breakdown-header">
              <span className="score-breakdown-title">
                <span className="breakdown-icon">📊</span> Section-by-Section Score Breakdown
              </span>
            </div>

            <div className="score-cards-grid">
              {/* Section 1: D1 */}
              <div className="score-card">
                <div className="score-card-header">
                  <span className="score-card-number">1</span>
                  <span className="score-card-label" title={sections.objective.label}>
                    {sections.objective.label}
                  </span>
                </div>
                <div className="section-stepper-widget">
                  <button
                    type="button"
                    className="sec-step-btn decrement"
                    onClick={() => handleSectionStep('objective', -0.5)}
                    disabled={scoreStatus === 'saving' || sections.objective.score <= 0}
                    title="Decrease mark by 0.5"
                    aria-label="Decrease mark"
                  >
                    −
                  </button>
                  <div className="sec-step-pill">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={sections.objective.max}
                      className="sec-step-input"
                      value={sectionInputs.objective}
                      onChange={(e) => handleSectionInputChange('objective', e.target.value)}
                      onBlur={() => handleSectionInputBlur('objective')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('objective')}
                      disabled={scoreStatus === 'saving'}
                      aria-label="Section 1 mark"
                    />
                    <span className="sec-step-denom">/ {sections.objective.max}</span>
                  </div>
                  <button
                    type="button"
                    className="sec-step-btn increment"
                    onClick={() => handleSectionStep('objective', 0.5)}
                    disabled={scoreStatus === 'saving' || sections.objective.score >= sections.objective.max}
                    title="Increase mark by 0.5"
                    aria-label="Increase mark"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Section 2: D2 */}
              <div className="score-card">
                <div className="score-card-header">
                  <span className="score-card-number">2</span>
                  <span className="score-card-label" title={sections.problem.label}>
                    {sections.problem.label}
                  </span>
                </div>
                <div className="section-stepper-widget">
                  <button
                    type="button"
                    className="sec-step-btn decrement"
                    onClick={() => handleSectionStep('problem', -0.5)}
                    disabled={scoreStatus === 'saving' || sections.problem.score <= 0}
                    title="Decrease mark by 0.5"
                    aria-label="Decrease mark"
                  >
                    −
                  </button>
                  <div className="sec-step-pill">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={sections.problem.max}
                      className="sec-step-input"
                      value={sectionInputs.problem}
                      onChange={(e) => handleSectionInputChange('problem', e.target.value)}
                      onBlur={() => handleSectionInputBlur('problem')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('problem')}
                      disabled={scoreStatus === 'saving'}
                      aria-label="Section 2 mark"
                    />
                    <span className="sec-step-denom">/ {sections.problem.max}</span>
                  </div>
                  <button
                    type="button"
                    className="sec-step-btn increment"
                    onClick={() => handleSectionStep('problem', 0.5)}
                    disabled={scoreStatus === 'saving' || sections.problem.score >= sections.problem.max}
                    title="Increase mark by 0.5"
                    aria-label="Increase mark"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Section 3: D3 */}
              <div className="score-card">
                <div className="score-card-header">
                  <span className="score-card-number">3</span>
                  <span className="score-card-label" title={sections.logic.label}>
                    {sections.logic.label}
                  </span>
                </div>
                <div className="section-stepper-widget">
                  <button
                    type="button"
                    className="sec-step-btn decrement"
                    onClick={() => handleSectionStep('logic', -0.5)}
                    disabled={scoreStatus === 'saving' || sections.logic.score <= 0}
                    title="Decrease mark by 0.5"
                    aria-label="Decrease mark"
                  >
                    −
                  </button>
                  <div className="sec-step-pill">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={sections.logic.max}
                      className="sec-step-input"
                      value={sectionInputs.logic}
                      onChange={(e) => handleSectionInputChange('logic', e.target.value)}
                      onBlur={() => handleSectionInputBlur('logic')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('logic')}
                      disabled={scoreStatus === 'saving'}
                      aria-label="Section 3 mark"
                    />
                    <span className="sec-step-denom">/ {sections.logic.max}</span>
                  </div>
                  <button
                    type="button"
                    className="sec-step-btn increment"
                    onClick={() => handleSectionStep('logic', 0.5)}
                    disabled={scoreStatus === 'saving' || sections.logic.score >= sections.logic.max}
                    title="Increase mark by 0.5"
                    aria-label="Increase mark"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Section 4: D4 */}
              <div className="score-card">
                <div className="score-card-header">
                  <span className="score-card-number">4</span>
                  <span className="score-card-label" title={sections.variables.label}>
                    {sections.variables.label}
                  </span>
                </div>
                <div className="section-stepper-widget">
                  <button
                    type="button"
                    className="sec-step-btn decrement"
                    onClick={() => handleSectionStep('variables', -0.5)}
                    disabled={scoreStatus === 'saving' || sections.variables.score <= 0}
                    title="Decrease mark by 0.5"
                    aria-label="Decrease mark"
                  >
                    −
                  </button>
                  <div className="sec-step-pill">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={sections.variables.max}
                      className="sec-step-input"
                      value={sectionInputs.variables}
                      onChange={(e) => handleSectionInputChange('variables', e.target.value)}
                      onBlur={() => handleSectionInputBlur('variables')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('variables')}
                      disabled={scoreStatus === 'saving'}
                      aria-label="Section 4 mark"
                    />
                    <span className="sec-step-denom">/ {sections.variables.max}</span>
                  </div>
                  <button
                    type="button"
                    className="sec-step-btn increment"
                    onClick={() => handleSectionStep('variables', 0.5)}
                    disabled={scoreStatus === 'saving' || sections.variables.score >= sections.variables.max}
                    title="Increase mark by 0.5"
                    aria-label="Increase mark"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Section 5: D5 */}
              <div className="score-card">
                <div className="score-card-header">
                  <span className="score-card-number">5</span>
                  <span className="score-card-label" title={sections.observation.label}>
                    {sections.observation.label}
                  </span>
                </div>
                <div className="section-stepper-widget">
                  <button
                    type="button"
                    className="sec-step-btn decrement"
                    onClick={() => handleSectionStep('observation', -0.5)}
                    disabled={scoreStatus === 'saving' || sections.observation.score <= 0}
                    title="Decrease mark by 0.5"
                    aria-label="Decrease mark"
                  >
                    −
                  </button>
                  <div className="sec-step-pill">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={sections.observation.max}
                      className="sec-step-input"
                      value={sectionInputs.observation}
                      onChange={(e) => handleSectionInputChange('observation', e.target.value)}
                      onBlur={() => handleSectionInputBlur('observation')}
                      onKeyDown={(e) => e.key === 'Enter' && handleSectionInputBlur('observation')}
                      disabled={scoreStatus === 'saving'}
                      aria-label="Section 5 mark"
                    />
                    <span className="sec-step-denom">/ {sections.observation.max}</span>
                  </div>
                  <button
                    type="button"
                    className="sec-step-btn increment"
                    onClick={() => handleSectionStep('observation', 0.5)}
                    disabled={scoreStatus === 'saving' || sections.observation.score >= sections.observation.max}
                    title="Increase mark by 0.5"
                    aria-label="Increase mark"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Schema 2.0 Strengths & Recommendations Card */}
          {((report.strengths && report.strengths.length > 0) || (report.recommendations && report.recommendations.length > 0)) && (
            <div className="report-insights-grid">
              {report.strengths && report.strengths.length > 0 && (
                <div className="insight-card strengths-card">
                  <h4>💪 Key Strengths</h4>
                  <ul>
                    {report.strengths.map((str, idx) => (
                      <li key={idx}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {report.recommendations && report.recommendations.length > 0 && (
                <div className="insight-card recommendations-card">
                  <h4>🎯 Recommendations & Improvements</h4>
                  <ul>
                    {report.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Schema 2.0 Criteria Scores Justification Section */}
          {report.criteriaScores && Object.keys(report.criteriaScores).length > 0 && (
            <div className="report-criteria-block">
              <h3 className="section-title">📐 Criteria Assessment & Justifications</h3>
              <div className="criteria-cards-grid">
                {Object.entries(report.criteriaScores).map(([dKey, dVal]) => (
                  <div key={dKey} className="criterion-detail-card">
                    <div className="criterion-card-header">
                      <span className="criterion-key">{dKey}</span>
                      <span className="criterion-name">{dVal.name || dKey}</span>
                      <span className="criterion-score-badge">
                        {dVal.score !== undefined ? dVal.score : '—'} / {dVal.max_score || 2.0}
                      </span>
                    </div>
                    {dVal.justification && (
                      <p className="criterion-justification">{dVal.justification}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Program / Markdown Analysis */}
          <div className="report-section-block">
            <h3 className="section-title">
              🔬 Detailed Program Analysis ({programKeys.length > 0 ? `${programKeys.length} Assigned Programs` : 'Evaluation Markdown'})
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
              <MarkdownReportRenderer content={report.rawEvaluationMarkdown} />
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
