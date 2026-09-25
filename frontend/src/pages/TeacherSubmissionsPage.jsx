import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';
import TeacherReportView from '../components/TeacherReportView';
import ReportFilters from '../components/teacher/ReportFilters';
import StudentScoreTable from '../components/teacher/StudentScoreTable';
import { submissionService } from '../services/submissionService';
import { evaluationService } from '../services/evaluationService';
import { adminService } from '../services/adminService';
import { deriveEngineering, deriveSection } from '../utils/studentDataHelper';
import '../styles/portal.css';

export default function TeacherSubmissionsPage() {
  // Selected report for single-student full report viewer (TeacherReportView)
  const [selectedReport, setSelectedReport] = useState(null);

  // ==============================================================================
  // Evaluation Table State
  // ==============================================================================
  const [gridData, setGridData] = useState({ weeks: [], rows: [], totalStudents: 0 });
  const [gridLoading, setGridLoading] = useState(false);
  const [providerFilter] = useState('all');
  const [pageAlert, setPageAlert] = useState(null);

  // Student metadata lookup cache (studentId -> { name, year, section, email })
  const [studentMetaMap, setStudentMetaMap] = useState({});

  // Multi-attribute filter states
  const [filterEngineering, setFilterEngineering] = useState('ALL');
  const [filterSection, setFilterSection] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  // Initial load
  useEffect(() => {
    loadGrid();
    loadStudentMetadata();
  }, []);

  // ----------------------------------------------------------------------------
  // Evaluation Data Handlers
  // ----------------------------------------------------------------------------
  const loadGrid = async (forceRefresh = false) => {
    try {
      // 1. SWR: Check if grid is already cached in memory for instant display
      const hasCached = evaluationService.gridCache && evaluationService.gridCache.has();
      if (hasCached && !forceRefresh) {
        const cached = evaluationService.gridCache.get();
        if (cached) {
          setGridData(cached);
          if (cached.rows) {
            const meta = {};
            cached.rows.forEach((r) => {
              if (r.studentId) {
                meta[r.studentId.toUpperCase()] = {
                  name: r.studentName,
                  profilePicture: r.profilePicture,
                  year: r.year,
                  section: r.section || r.sectionId,
                };
              }
            });
            setStudentMetaMap((prev) => ({ ...meta, ...prev }));
          }
        }
      } else {
        setGridLoading(true);
      }

      // 2. Fetch fresh grid data (in background if cache hit, or foreground if miss/forceRefresh)
      const data = await evaluationService.getGrid(forceRefresh);
      setGridData(data);

      // Fast synchronous metadata mapping directly from grid response
      if (data && data.rows) {
        const meta = {};
        data.rows.forEach((r) => {
          if (r.studentId) {
            meta[r.studentId.toUpperCase()] = {
              name: r.studentName,
              profilePicture: r.profilePicture,
              year: r.year,
              section: r.section || r.sectionId,
            };
          }
        });
        setStudentMetaMap((prev) => ({ ...meta, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load evaluation grid:', err);
      setPageAlert({ type: 'error', message: err.message || 'Failed to load evaluation grid.' });
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

  const handleFeedbackUpdated = (sId, w, reviewed, text, scoreInfo) => {
    // Extract formatted and numeric score safely
    let formattedScore;
    let numericScore;

    if (scoreInfo && typeof scoreInfo === 'object') {
      formattedScore = scoreInfo.formattedScore;
      numericScore = scoreInfo.numericScore;
    } else if (typeof scoreInfo === 'string') {
      formattedScore = scoreInfo;
      numericScore = parseFloat(scoreInfo);
    } else if (typeof scoreInfo === 'number') {
      numericScore = scoreInfo;
      formattedScore = `${scoreInfo} / 10`;
    }

    // In-place update in gridData to reflect immediate review status and marks change without full refetch
    setGridData((prev) => {
      const updatedRows = (prev.rows || []).map((row) => {
        if (row.studentId === sId && row.evaluations && row.evaluations[w]) {
          const currentEval = row.evaluations[w];
          return {
            ...row,
            evaluations: {
              ...row.evaluations,
              [w]: {
                ...currentEval,
                reviewed: reviewed !== undefined ? reviewed : currentEval.reviewed,
                feedbackText: text !== undefined ? text : currentEval.feedbackText,
                finalScore: formattedScore || currentEval.finalScore,
                numericScore: numericScore !== undefined && !isNaN(numericScore) ? numericScore : currentEval.numericScore,
                totalScore: (scoreInfo && scoreInfo.totalScore) || currentEval.totalScore,
                objectiveScore: (scoreInfo && scoreInfo.objectiveScore) || currentEval.objectiveScore,
                problemUnderstandingScore: (scoreInfo && scoreInfo.problemUnderstandingScore) || currentEval.problemUnderstandingScore,
                logicScore: (scoreInfo && scoreInfo.logicScore) || currentEval.logicScore,
                variablesScore: (scoreInfo && scoreInfo.variablesScore) || currentEval.variablesScore,
                observationScore: (scoreInfo && scoreInfo.observationScore) || currentEval.observationScore,
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
      setPageAlert({
        type: 'success',
        message: `Successfully deleted ${week} evaluation report for ${studentId}.`,
      });
      await loadGrid(true);
    } catch (err) {
      console.error('Failed to delete report:', err);
      setPageAlert({
        type: 'error',
        message: err.message || `Failed to delete ${week} report for ${studentId}.`,
      });
    } finally {
      setGridLoading(false);
    }
  };

  const handleReportDeletedFromView = ({ studentId, week }) => {
    setSelectedReport(null);
    setPageAlert({
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
            initialProvider={selectedReport.provider}
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
        {/* Top Header: Title */}
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
          {/* <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Teacher Dashboard
            </h1>
          </div> */}
        </div>

        {/* Page Notification / Alert */}
        {pageAlert && (
          <div className={`alert-message ${pageAlert.type}`} style={{ marginBottom: '1.25rem' }}>
            <span>{pageAlert.type === 'success' ? '✅' : '⚠️'}</span>
            <div>{pageAlert.message}</div>
            <button
              type="button"
              onClick={() => setPageAlert(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Observation Reports — Filter and Table */}
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
            <p style={{ color: '#64748b', maxWidth: '520px', margin: '0 auto', lineHeight: '1.5' }}>
              No evaluation reports have been uploaded yet. Evaluation records will appear once an administrator uploads evaluation JSON batches in the Administrator Console.
            </p>
          </div>
        ) : (
          /* ONE Common Week 1 to Week 12 Table with Inline Expansion */
          <StudentScoreTable
            students={filteredRows}
            studentMetaMap={studentMetaMap}
            onViewReport={setSelectedReport}
            onDeleteReport={handleDeleteReport}
            providerFilter={providerFilter}
          />
        )}
      </main>
    </div>
  );
}
