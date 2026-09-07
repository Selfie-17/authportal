import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import TeacherReportView from '../components/TeacherReportView';
import { submissionService } from '../services/submissionService';
import { evaluationService } from '../services/evaluationService';
import '../styles/portal.css';

export default function TeacherSubmissionsPage() {
  // Top view tab: 'evaluations' (Evaluation Table) vs 'submissions' (File Submissions & ZIP)
  const [activeTab, setActiveTab] = useState('evaluations');

  // Selected report for single-student detailed view
  const [selectedReport, setSelectedReport] = useState(null);

  // ==============================================================================
  // Evaluation Table State
  // ==============================================================================
  const [gridData, setGridData] = useState({ weeks: [], rows: [], totalStudents: 0 });
  const [gridLoading, setGridLoading] = useState(false);
  const [evalSearch, setEvalSearch] = useState('');
  const [uploadingJson, setUploadingJson] = useState(false);
  const [uploadAlert, setUploadAlert] = useState(null);
  const fileInputRef = useRef(null);

  // ==============================================================================
  // Existing Submissions & Batch ZIP State
  // ==============================================================================
  const [week, setWeek] = useState(1);
  const [year, setYear] = useState('');
  const [section, setSection] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load grid on mount and when switching to evaluations tab
  useEffect(() => {
    if (activeTab === 'evaluations') {
      loadGrid();
    }
  }, [activeTab]);

  // Load submissions whenever submissions tab filters change
  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
    }
  }, [activeTab, week, year, section]);

  // ----------------------------------------------------------------------------
  // Evaluation Table Handlers
  // ----------------------------------------------------------------------------
  const loadGrid = async () => {
    try {
      setGridLoading(true);
      const data = await evaluationService.getGrid();
      setGridData(data);
    } catch (err) {
      console.error('Failed to load evaluation grid:', err);
      setUploadAlert({ type: 'error', message: err.message || 'Failed to load evaluation grid.' });
    } finally {
      setGridLoading(false);
    }
  };

  const handleUploadButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleJsonFileSelected = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      setUploadingJson(true);
      setUploadAlert(null);

      const resp = await evaluationService.uploadJsonFile(file);
      setUploadAlert({
        type: 'success',
        message: `${resp.message || 'JSON processed successfully!'} Processed ${resp.processedCount} student evaluations for ${resp.weeks?.join(', ') || 'selected weeks'}.`,
      });

      // Reload grid immediately to reflect new/updated evaluations
      await loadGrid();
    } catch (err) {
      setUploadAlert({
        type: 'error',
        message: err.message || 'Failed to upload and parse JSON file.',
      });
    } finally {
      setUploadingJson(false);
    }
  };

  const handleFeedbackUpdated = (sId, w, reviewed, text) => {
    // In-place update in gridData to reflect immediate status change without full refetch
    setGridData((prev) => {
      const updatedRows = prev.rows.map((row) => {
        if (row.studentId === sId && row.evaluations && row.evaluations[w]) {
          return {
            ...row,
            evaluations: {
              ...row.evaluations,
              [w]: {
                ...row.evaluations[w],
                reviewed,
                feedbackText: text,
              },
            },
          };
        }
        return row;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  // Filter evaluation rows by search query
  const filteredRows = gridData.rows.filter((row) => {
    if (!evalSearch.trim()) return true;
    return row.studentId.toLowerCase().includes(evalSearch.trim().toLowerCase());
  });

  // ----------------------------------------------------------------------------
  // Existing Submissions Handlers (Preserved)
  // ----------------------------------------------------------------------------
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await submissionService.filterTeacherSubmissions({
        week: week || undefined,
        year: year || undefined,
        section: section || undefined,
        studentId: studentId.trim() || undefined,
      });
      setSubmissions(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSubmissions();
  };

  const handleDownloadZip = async () => {
    if (!week) {
      alert('Please select a week to download the ZIP archive.');
      return;
    }

    try {
      setDownloadingZip(true);
      await submissionService.downloadSubmissionsZip({
        week,
        year: year || undefined,
        section: section || undefined,
      });
    } catch (err) {
      alert('Failed to download ZIP: ' + err.message);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSingleFile = async (submissionId, fileId, filename) => {
    try {
      await submissionService.downloadFile(submissionId, fileId, filename);
    } catch (err) {
      alert('Failed to download file: ' + err.message);
    }
  };

  const suggestedZipName = section
    ? `week-${week}-sec-${section}.zip`
    : `week-${week}.zip`;

  // ----------------------------------------------------------------------------
  // If Single Student Report is selected, render TeacherReportView
  // ----------------------------------------------------------------------------
  if (selectedReport) {
    return (
      <div className="portal-layout">
        <Navbar />
        <main className="portal-container">
          <TeacherReportView
            studentId={selectedReport.studentId}
            week={selectedReport.week}
            onBack={() => setSelectedReport(null)}
            onFeedbackUpdated={handleFeedbackUpdated}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container teacher-eval-page">
        {/* Top Header */}
        <div className="page-intro">
          <h2>Observation Report - Teacher View</h2>
          <p>
            Review automated laboratory evaluations, monitor section scores, inspect detailed student reports, and save human teacher feedback.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="portal-tabs-bar">
          <button
            type="button"
            className={`portal-tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            📊 Evaluation Table (Observation Reports)
          </button>
          <button
            type="button"
            className={`portal-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            📁 Student File Submissions & Batch ZIP
          </button>
        </div>

        {/* ====================================================================== */}
        {/* TAB 1: TEACHER EVALUATION TABLE VIEW                                    */}
        {/* ====================================================================== */}
        {activeTab === 'evaluations' && (
          <div>
            {/* Upload Notification / Alerts */}
            {uploadAlert && (
              <div className={`alert-message ${uploadAlert.type}`}>
                <span>{uploadAlert.type === 'success' ? '✅' : '⚠️'}</span>
                <div>{uploadAlert.message}</div>
              </div>
            )}

            {/* Hidden JSON file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleJsonFileSelected}
            />

            {/* Action Bar / Toolbar */}
            <div className="eval-toolbar">
              <div className="eval-toolbar-left">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUploadButtonClick}
                  disabled={uploadingJson}
                  title="Upload evaluation JSON to add or update student evaluations"
                >
                  {uploadingJson ? '⏳ Processing JSON...' : '📤 Upload JSON'}
                </button>

                <div className="eval-badge-stat">
                  <span>👥 Students:</span>
                  <strong>{gridData.totalStudents}</strong>
                </div>

                <div className="eval-badge-stat">
                  <span>📅 Weeks:</span>
                  <strong>{gridData.weeks.length}</strong>
                </div>
              </div>

              <div className="eval-toolbar-right">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input eval-search-input"
                    placeholder="Search Student ID (e.g. N210921)"
                    value={evalSearch}
                    onChange={(e) => setEvalSearch(e.target.value)}
                  />
                  {evalSearch && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEvalSearch('')}
                      title="Clear search filter"
                      style={{ padding: '0.55rem 0.75rem' }}
                    >
                      ✕
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={loadGrid}
                    disabled={gridLoading}
                    title="Refresh evaluation table"
                    style={{ padding: '0.55rem 0.85rem' }}
                  >
                    🔄
                  </button>
                </div>
              </div>
            </div>

            {/* Table Container */}
            {gridLoading ? (
              <div className="portal-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div className="empty-state-icon">⏳</div>
                <h3>Loading Evaluation Table...</h3>
                <p>Retrieving student evaluations and teacher feedback.</p>
              </div>
            ) : gridData.weeks.length === 0 ? (
              <div className="portal-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div className="empty-state-icon">📋</div>
                <h3>No Evaluations Uploaded Yet</h3>
                <p>
                  Click <strong>Upload JSON</strong> above to upload the first evaluation report JSON.
                  The table will automatically generate dynamic student rows and week columns.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUploadButtonClick}
                  style={{ marginTop: '1.25rem' }}
                >
                  📤 Upload First Evaluation JSON
                </button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="portal-card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="empty-state-icon">🔍</div>
                <h3>No Matching Students Found</h3>
                <p>No student ID matches "{evalSearch}".</p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEvalSearch('')}
                  style={{ marginTop: '1rem' }}
                >
                  Clear Search Filter
                </button>
              </div>
            ) : (
              <div className="spreadsheet-container">
                <table className="spreadsheet-table">
                  <thead>
                    <tr>
                      <th className="sticky-rno-th">R no</th>
                      <th className="sticky-id-th">ID No</th>
                      {gridData.weeks.map((w) => (
                        <th key={w} className="week-header-th">
                          {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => (
                      <tr key={row.studentId}>
                        <td className="sticky-rno-td">{idx + 1}</td>
                        <td className="sticky-id-td">
                          <code>{row.studentId}</code>
                        </td>
                        {gridData.weeks.map((w) => {
                          const cell = row.evaluations ? row.evaluations[w] : null;
                          if (!cell) {
                            return (
                              <td key={w}>
                                <div className="eval-cell-empty">—</div>
                              </td>
                            );
                          }

                          return (
                            <td key={w}>
                              <div className="eval-cell-card">
                                <div className="eval-score-header">
                                  <span className="score-badge-pill">
                                    Score: {cell.finalScore || 'N/A'}
                                  </span>
                                  {cell.reviewed ? (
                                    <span className="review-status-tag reviewed" title="Reviewed by teacher">
                                      Reviewed ✓
                                    </span>
                                  ) : (
                                    <span className="review-status-tag not-reviewed" title="Not reviewed yet">
                                      Not Reviewed
                                    </span>
                                  )}
                                </div>

                                <div className="eval-breakdown-list">
                                  <div className="eval-breakdown-row">
                                    <span className="eval-breakdown-label">Objective</span>
                                    <span className="eval-breakdown-val">{cell.objectiveScore || '—'}</span>
                                  </div>
                                  <div className="eval-breakdown-row">
                                    <span className="eval-breakdown-label">Problem</span>
                                    <span className="eval-breakdown-val">{cell.problemUnderstandingScore || '—'}</span>
                                  </div>
                                  <div className="eval-breakdown-row">
                                    <span className="eval-breakdown-label">Logic</span>
                                    <span className="eval-breakdown-val">{cell.logicScore || '—'}</span>
                                  </div>
                                  <div className="eval-breakdown-row">
                                    <span className="eval-breakdown-label">Variables</span>
                                    <span className="eval-breakdown-val">{cell.variablesScore || '—'}</span>
                                  </div>
                                  <div className="eval-breakdown-row">
                                    <span className="eval-breakdown-label">Observed</span>
                                    <span className="eval-breakdown-val">{cell.observationScore || '—'}</span>
                                  </div>
                                  <div className="eval-breakdown-row eval-total-row">
                                    <span className="eval-breakdown-label">Total</span>
                                    <span className="eval-breakdown-val">{cell.totalScore || '—'}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="btn-report-view"
                                  onClick={() => setSelectedReport({ studentId: row.studentId, week: w })}
                                  title={`View detailed evaluation report for ${row.studentId} (${w})`}
                                >
                                  View Report
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================== */}
        {/* TAB 2: STUDENT FILE SUBMISSIONS & BATCH ZIP (EXISTING VIEW PRESERVED)    */}
        {/* ====================================================================== */}
        {activeTab === 'submissions' && (
          <div>
            {errorMessage && (
              <div className="alert-message error">
                <span>⚠️</span>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="filter-bar">
              <div className="form-group">
                <label className="form-label">Week</label>
                <select
                  className="form-select"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Year (Database Filter)</label>
                <select
                  className="form-select"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">All Years (E1–E4)</option>
                  <option value="E1">E1</option>
                  <option value="E2">E2</option>
                  <option value="E3">E3</option>
                  <option value="E4">E4</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Section</label>
                <select
                  className="form-select"
                  value={section}
                  onChange={(e) => setSection(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">All Sections</option>
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSearchSubmit} className="form-group">
                <label className="form-label">Search Student ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. N210001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                  <button type="submit" className="btn-secondary" title="Search">
                    🔍
                  </button>
                </div>
              </form>
            </div>

            {/* Submissions Table & Batch Actions */}
            <div className="portal-card">
              <div className="portal-card-header">
                <div>
                  <h3 className="portal-card-title">
                    Submissions ({submissions.length})
                  </h3>
                  <p className="portal-card-subtitle">
                    Showing submissions for Week {week}
                    {year ? ` · Year ${year}` : ''}
                    {section ? ` · Section ${section}` : ' · All Sections'}
                  </p>
                </div>

                <div className="zip-download-box">
                  <span className="zip-badge">📁 {suggestedZipName}</span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleDownloadZip}
                    disabled={downloadingZip || submissions.length === 0}
                    title="Download all submissions for selected week and section in structured ZIP format"
                  >
                    {downloadingZip ? '📦 Creating ZIP...' : '⬇️ Download Batch ZIP'}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="empty-state">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <h3>No Submissions Found</h3>
                  <p>
                    No student submissions match Week {week}
                    {year ? `, Year ${year}` : ''}
                    {section ? `, Section ${section}` : ''}.
                  </p>
                </div>
              ) : (
                <div className="portal-table-container">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Student Name & Email</th>
                        <th>Week / Year / Sec</th>
                        <th>Revision</th>
                        <th>Files ({submissions.reduce((acc, s) => acc + (s.files?.length || 0), 0)})</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <tr key={sub.id}>
                          <td>
                            <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                              <code>{sub.studentId}</code>
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{sub.userName}</div>
                            <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{sub.userEmail}</div>
                          </td>
                          <td>
                            Week {sub.week} · {sub.year} · Sec {sub.section}
                          </td>
                          <td>
                            <span className="revision-badge">Rev {sub.version}</span>
                            {sub.status === 'UPDATED' && (
                              <span
                                className="status-tag updated"
                                style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}
                              >
                                UPDATED
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="file-chips">
                              {sub.files && sub.files.length > 0 ? (
                                sub.files.map((file) => (
                                  <button
                                    key={file.id}
                                    type="button"
                                    className="btn-file-chip"
                                    onClick={() => handleDownloadSingleFile(sub.id, file.id, file.originalFilename)}
                                    title={`Download ${file.originalFilename}`}
                                  >
                                    ⬇️ {file.originalFilename}
                                  </button>
                                ))
                              ) : (
                                <span style={{ color: '#94a3b8' }}>No files</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {new Date(sub.updatedAt || sub.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
