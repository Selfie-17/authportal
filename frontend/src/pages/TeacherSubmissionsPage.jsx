import React, { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from '../components/Navbar';
import TeacherReportView from '../components/TeacherReportView';
import TeacherStats from '../components/teacher/TeacherStats';
import ReportFilters from '../components/teacher/ReportFilters';
import StudentScoreTable from '../components/teacher/StudentScoreTable';
import { submissionService } from '../services/submissionService';
import { evaluationService } from '../services/evaluationService';
import { adminService } from '../services/adminService';
import { deriveEngineering, deriveSection } from '../utils/studentDataHelper';
import '../styles/portal.css';

export default function TeacherSubmissionsPage() {
  // View switcher: 'evaluations' (Observation Reports) vs 'submissions' (File Submissions & ZIP)
  const [activeTab, setActiveTab] = useState('evaluations');

  // Selected report for single-student full report viewer (TeacherReportView)
  const [selectedReport, setSelectedReport] = useState(null);

  // ==============================================================================
  // Evaluation Table State
  // ==============================================================================
  const [gridData, setGridData] = useState({ weeks: [], rows: [], totalStudents: 0 });
  const [gridLoading, setGridLoading] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [uploadAlert, setUploadAlert] = useState(null);
  const fileInputRef = useRef(null);

  // Student metadata lookup cache (studentId -> { name, year, section, email })
  const [studentMetaMap, setStudentMetaMap] = useState({});

  // Multi-attribute filter states
  const [filterEngineering, setFilterEngineering] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  // Selected semester filter in header
  const [semester] = useState('Semester 1 • 2025');

  // ==============================================================================
  // File Submissions & Batch ZIP State (Preserved)
  // ==============================================================================
  const [week, setWeek] = useState(1);
  const [year, setYear] = useState('');
  const [section, setSection] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load grid and student metadata on mount and when evaluations tab is active
  useEffect(() => {
    if (activeTab === 'evaluations') {
      loadGrid();
      loadStudentMetadata();
    }
  }, [activeTab]);

  // Load submissions whenever submissions tab filters change
  useEffect(() => {
    if (activeTab === 'submissions') {
      fetchSubmissions();
    }
  }, [activeTab, week, year, section]);

  // ----------------------------------------------------------------------------
  // Evaluation Data Handlers
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

  /**
   * Loads student names and profile pictures from existing users and submissions.
   * Strictly uses real database/OAuth data without inventing mock data.
   */
  const loadStudentMetadata = async () => {
    const meta = {};

    // 1. Fetch system users if accessible (provides real Google OAuth names, emails & profile pictures)
    try {
      const usersData = await adminService.getUsers();
      const userList = Array.isArray(usersData) ? usersData : (usersData?.users || []);
      userList.forEach((u) => {
        if (u.email && u.email.includes('@')) {
          const local = u.email.split('@')[0].trim().toUpperCase();
          meta[local] = {
            name: u.name,
            email: u.email,
            profilePicture: u.profilePicture || null,
          };
        }
      });
    } catch (err) {
      // Non-admins or offline might not have access, continue gracefully
    }

    // 2. Fetch existing submissions to augment with studentId, userName, year, section
    try {
      const allSubs = await submissionService.filterTeacherSubmissions({});
      if (Array.isArray(allSubs)) {
        allSubs.forEach((sub) => {
          if (sub.studentId) {
            const cleanId = sub.studentId.toUpperCase();
            meta[cleanId] = {
              ...(meta[cleanId] || {}),
              name: sub.userName || meta[cleanId]?.name,
              year: sub.year || meta[cleanId]?.year,
              section: sub.section || meta[cleanId]?.section,
              email: sub.userEmail || meta[cleanId]?.email,
              profilePicture: sub.userProfilePicture || meta[cleanId]?.profilePicture || null,
            };
          }
        });
      }
    } catch (err) {
      console.warn('Could not pre-load submission metadata for student labels:', err.message);
    }

    setStudentMetaMap(meta);
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
      await loadStudentMetadata();
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
    // In-place update in gridData to reflect immediate review status change without full refetch
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

  /**
   * Deletes a student's evaluation report for a given week.
   * Prompts for confirmation, calls backend API, shows notification, and refreshes the grid.
   */
  const handleDeleteReport = async ({ studentId, week }) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${week} evaluation report for student ${studentId}?\n\nThis action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setGridLoading(true);
      await evaluationService.deleteStudentReport(studentId, week);
      setUploadAlert({
        type: 'success',
        message: `Successfully deleted ${week} evaluation report for ${studentId}.`,
      });
      await loadGrid();
    } catch (err) {
      console.error('Failed to delete report:', err);
      setUploadAlert({
        type: 'error',
        message: err.message || `Failed to delete ${week} report for ${studentId}.`,
      });
    } finally {
      setGridLoading(false);
    }
  };

  const handleReportDeletedFromView = ({ studentId, week }) => {
    setSelectedReport(null);
    setUploadAlert({
      type: 'success',
      message: `Successfully deleted ${week} evaluation report for ${studentId}.`,
    });
    loadGrid();
  };

  // ----------------------------------------------------------------------------
  // Multi-Filter Combined Logic
  // ----------------------------------------------------------------------------
  const filteredRows = useMemo(() => {
    if (!gridData.rows) return [];

    return gridData.rows.filter((row) => {
      const sId = (row.studentId || '').toUpperCase();
      const meta = studentMetaMap[sId] || {};

      // 1. Engineering filter
      const eng = deriveEngineering(sId, meta.year);
      if (filterEngineering !== 'ALL' && eng.code !== filterEngineering) {
        return false;
      }

      // 2. Section filter
      const sec = deriveSection(sId, meta.section, row.sectionId);
      if (filterSection !== 'ALL' && sec !== filterSection) {
        return false;
      }

      // 3. Search filter by Student ID or Student Name
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const idMatch = sId.toLowerCase().includes(q);
        const nameMatch = (meta.name || row.studentName || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [gridData.rows, studentMetaMap, filterEngineering, filterSection, filterSearch]);

  const handleClearFilters = () => {
    setFilterEngineering('ALL');
    setFilterSection('ALL');
    setFilterSearch('');
  };

  // Compute aggregated statistics across all evaluation rows
  const { averageScore, reviewedCount, totalEvaluations } = useMemo(() => {
    let scoreSum = 0;
    let scoreCount = 0;
    let revCount = 0;
    let totalEvals = 0;

    (gridData.rows || []).forEach((row) => {
      const evals = row.evaluations || {};
      Object.values(evals).forEach((ev) => {
        if (ev) {
          totalEvals++;
          if (ev.reviewed) revCount++;
          const num = parseFloat(ev.finalScore);
          if (!isNaN(num)) {
            scoreSum += num;
            scoreCount++;
          }
        }
      });
    });

    const avg = scoreCount > 0 ? scoreSum / scoreCount : 0;
    return { averageScore: avg, reviewedCount: revCount, totalEvaluations: totalEvals };
  }, [gridData.rows]);

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
  // If Single Student Detailed Report is selected, render TeacherReportView
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
            onReportDeleted={handleReportDeletedFromView}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container teacher-eval-page">
        {/* Top Header matching reference image: Title, Subtitle, Semester Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Teacher Dashboard
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0.35rem 0 0', maxWidth: '750px' }}>
              Review automated laboratory evaluations, monitor section scores, inspect detailed student reports, and save human teacher feedback.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="semester-selector-card" title="Active academic cycle">
              <span>📅</span>
              <span>{semester}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>▾</span>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleUploadButtonClick}
              disabled={uploadingJson}
              title="Upload evaluation JSON report"
              style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem', borderRadius: '8px' }}
            >
              {uploadingJson ? '⏳ Uploading...' : '📤 Upload JSON'}
            </button>
          </div>
        </div>

        {/* Hidden JSON file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleJsonFileSelected}
        />

        {/* Upload Notification / Alert */}
        {uploadAlert && (
          <div className={`alert-message ${uploadAlert.type}`} style={{ marginBottom: '1.25rem' }}>
            <span>{uploadAlert.type === 'success' ? '✅' : '⚠️'}</span>
            <div>{uploadAlert.message}</div>
            <button
              type="button"
              onClick={() => setUploadAlert(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="admin-tabs-nav" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setActiveTab('evaluations')}
          >
            <span>📊 Observation Reports</span>
            <span className="admin-tab-badge">{gridData.totalStudents || 0}</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            <span>📁 Student File Submissions & Batch ZIP</span>
          </button>
        </div>

        {/* ====================================================================== */}
        {/* TAB 1: TEACHER OBSERVATION REPORTS — COMMON TABLE & INLINE DETAIL VIEW  */}
        {/* ====================================================================== */}
        {activeTab === 'evaluations' && (
          <div>
            {/* Top Summary Statistics Bar (4 Cards Matching Screenshot) */}
            <TeacherStats
              totalStudents={gridData.totalStudents || (gridData.rows ? gridData.rows.length : 0)}
              totalWeeks={gridData.weeks ? gridData.weeks.length : 0}
              averageScore={averageScore}
              reviewedCount={reviewedCount}
              totalEvaluations={totalEvaluations}
            />

            {/* Filter Section Matching Screenshot */}
            <ReportFilters
              engineering={filterEngineering}
              setEngineering={setFilterEngineering}
              section={filterSection}
              setSection={setFilterSection}
              searchQuery={filterSearch}
              setSearchQuery={setFilterSearch}
              onSearchSubmit={() => {}}
              totalCount={gridData.rows ? gridData.rows.length : 0}
              filteredCount={filteredRows.length}
              onClear={handleClearFilters}
            />

            {/* Main Content Area: Loading / Empty / Common Score Table */}
            {gridLoading ? (
              <div className="portal-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ color: '#0f172a' }}>Loading Student Evaluations...</h3>
                <p style={{ color: '#64748b' }}>Retrieving student evaluations and teacher feedback.</p>
              </div>
            ) : gridData.weeks.length === 0 && (!gridData.rows || gridData.rows.length === 0) ? (
              <div className="portal-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                <h3 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>No Evaluations Uploaded Yet</h3>
                <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                  Click <strong>Upload JSON</strong> above to upload your lab evaluation report.
                  The table will automatically populate dynamic student rows with aligned Week 1–12 scores.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUploadButtonClick}
                >
                  📤 Upload First Evaluation JSON
                </button>
              </div>
            ) : (
              /* ONE Common Week 1 to Week 12 Table with Inline Expansion */
              <StudentScoreTable
                students={filteredRows}
                studentMetaMap={studentMetaMap}
                onViewReport={setSelectedReport}
                onDeleteReport={handleDeleteReport}
              />
            )}
          </div>
        )}

        {/* ====================================================================== */}
        {/* TAB 2: STUDENT FILE SUBMISSIONS & BATCH ZIP (PRESERVED)                 */}
        {/* ====================================================================== */}
        {activeTab === 'submissions' && (
          <div>
            {errorMessage && (
              <div className="alert-message error" style={{ marginBottom: '1.25rem' }}>
                <span>⚠️</span>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label className="filter-field-label">Week</label>
                <select
                  className="filter-field-select"
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
                <label className="filter-field-label">Year (Database Filter)</label>
                <select
                  className="filter-field-select"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">All Years (E1–E4)</option>
                  <option value="E1">Engineering 1 (E1)</option>
                  <option value="E2">Engineering 2 (E2)</option>
                  <option value="E3">Engineering 3 (E3)</option>
                  <option value="E4">Engineering 4 (E4)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="filter-field-label">Section</label>
                <select
                  className="filter-field-select"
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
                <label className="filter-field-label">Search Student ID</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="filter-search-text"
                    placeholder="e.g. N210001"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 0.85rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                    }}
                  />
                  <button type="submit" className="btn-secondary" title="Search" style={{ height: '42px' }}>
                    🔍
                  </button>
                </div>
              </form>
            </div>

            {/* Submissions Table & Batch Actions */}
            <div className="admin-card-container">
              <div className="portal-card-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                  <h3 className="admin-card-header-title">
                    Submissions ({submissions.length})
                  </h3>
                  <p className="admin-card-header-desc">
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
                <div className="empty-state" style={{ padding: '3rem' }}>Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem' }}>
                  <div className="empty-state-icon">🔍</div>
                  <h3>No Submissions Found</h3>
                  <p>
                    No student submissions match Week {week}
                    {year ? `, Year ${year}` : ''}
                    {section ? `, Section ${section}` : ''}.
                  </p>
                </div>
              ) : (
                <div className="modern-table-responsive">
                  <table className="modern-table">
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
                              <code className="student-id-badge">{sub.studentId}</code>
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{sub.userName}</div>
                            <div style={{ fontSize: '0.775rem', color: '#64748b' }}>{sub.userEmail}</div>
                          </td>
                          <td>
                            <span className="student-academic-chip">
                              Week {sub.week} · {sub.year} · Sec {sub.section}
                            </span>
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
                            <div className="file-chips" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {sub.files && sub.files.length > 0 ? (
                                sub.files.map((file) => (
                                  <button
                                    key={file.id}
                                    type="button"
                                    className="btn-file-chip"
                                    onClick={() => handleDownloadSingleFile(sub.id, file.id, file.originalFilename)}
                                    title={`Download ${file.originalFilename}`}
                                    style={{
                                      padding: '0.25rem 0.6rem',
                                      fontSize: '0.75rem',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#f8fafc',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ⬇️ {file.originalFilename}
                                  </button>
                                ))
                              ) : (
                                <span style={{ color: '#94a3b8' }}>No files</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.825rem', color: '#64748b' }}>
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
