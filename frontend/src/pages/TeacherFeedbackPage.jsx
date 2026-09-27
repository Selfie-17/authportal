import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import { submissionService } from '../services/submissionService';
import { evaluationService } from '../services/evaluationService';
import { authService } from '../services/authService';
import '../styles/portal.css';

/**
 * Student Submission + PDF + Teacher Feedback Review Page
 * Allows both TEACHER and ADMIN users to:
 * - Inspect all student submissions (ID, name, section, week, date)
 * - Open the student's actual uploaded PDF in a new browser tab
 * - Review and inspect teacher feedback logs
 * - Enter/edit feedback and toggle Reviewed/Pending status
 * - Navigate via server-side pagination (default: 20 records per page)
 */
export default function TeacherFeedbackPage() {
  const currentUser = authService.getAuthUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isTeacher = currentUser?.role === 'TEACHER';

  // ==============================================================================
  // Pagination & Filter States
  // ==============================================================================
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');

  // ==============================================================================
  // Data States
  // ==============================================================================
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bannerMsg, setBannerMsg] = useState(null);
  const [bannerErr, setBannerErr] = useState(null);

  // PDF opening state (tracks which submission is currently loading PDF)
  const [openingPdfId, setOpeningPdfId] = useState(null);

  // ==============================================================================
  // Feedback Modal State
  // ==============================================================================
  const [modalRecord, setModalRecord] = useState(null);
  const [modalReviewed, setModalReviewed] = useState(false);
  const [modalFeedbackText, setModalFeedbackText] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [modalError, setModalError] = useState(null);

  // ==============================================================================
  // Load Submissions Page from Backend
  // ==============================================================================
  const loadSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await submissionService.getPaginatedSubmissions({
        page: currentPage,
        size: pageSize,
        week: selectedWeek,
        search: activeSearch,
      });

      setRecords(data.content || []);
      setCurrentPage(data.currentPage || 0);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      console.error('Failed to load submissions page:', err);
      setError(err.message || 'Failed to retrieve submission records.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, selectedWeek, activeSearch]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // Handle Search input submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0);
    setActiveSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
    setCurrentPage(0);
  };

  const handleWeekChange = (e) => {
    setSelectedWeek(e.target.value);
    setCurrentPage(0);
  };

  // ==============================================================================
  // Open PDF in New Tab Handler
  // ==============================================================================
  const handleViewPdf = async (record) => {
    if (!record.hasPdf || !record.pdfFileId) {
      alert('No PDF lab report was uploaded for this submission.');
      return;
    }

    try {
      setOpeningPdfId(record.id);
      setBannerErr(null);
      await submissionService.openSubmissionPdfInNewTab(
        record.id,
        record.pdfFileId,
        record.pdfFileName || `${record.studentId}_${record.weekDisplay || 'Week'}.pdf`
      );
    } catch (err) {
      console.error('Error opening PDF:', err);
      setBannerErr(`Failed to open PDF for ${record.studentId}: ${err.message}`);
    } finally {
      setOpeningPdfId(null);
    }
  };

  // ==============================================================================
  // Feedback Modal Actions
  // ==============================================================================
  const openFeedbackModal = (record) => {
    setModalRecord(record);
    setModalReviewed(Boolean(record.reviewed));
    setModalFeedbackText(record.feedbackText || '');
    setModalError(null);
  };

  const closeFeedbackModal = () => {
    setModalRecord(null);
    setModalError(null);
    setSavingFeedback(false);
  };

  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    if (!modalRecord) return;

    try {
      setSavingFeedback(true);
      setModalError(null);

      const weekString = modalRecord.weekDisplay || `Week ${modalRecord.week}`;
      const payload = {
        studentId: modalRecord.studentId,
        week: weekString,
        reviewed: modalReviewed,
        feedbackText: modalFeedbackText.trim(),
      };

      const response = await evaluationService.saveFeedback(payload);

      // Optimistically update the record in the current page table
      setRecords((prev) =>
        prev.map((rec) => {
          if (rec.id === modalRecord.id) {
            return {
              ...rec,
              reviewed: response.reviewed,
              feedbackText: response.feedbackText,
              teacherEmail: response.teacherEmail || currentUser?.email || 'Teacher',
              feedbackUpdatedAt: response.updatedAt || new Date().toISOString(),
            };
          }
          return rec;
        })
      );

      setBannerMsg(
        `Feedback for ${modalRecord.studentId} (${weekString}) saved successfully.`
      );
      closeFeedbackModal();
    } catch (err) {
      console.error('Failed to save feedback:', err);
      setModalError(err.message || 'Failed to save feedback.');
    } finally {
      setSavingFeedback(false);
    }
  };

  // ==============================================================================
  // Pagination UI Calculation
  // ==============================================================================
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages - 1, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const recordRangeText = useMemo(() => {
    if (totalElements === 0) return 'Showing 0 records';
    const start = currentPage * pageSize + 1;
    const end = Math.min((currentPage + 1) * pageSize, totalElements);
    return `Showing ${start}–${end} of ${totalElements} records`;
  }, [currentPage, pageSize, totalElements]);

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Top Header */}
        <div className="admin-header-row" style={{ marginBottom: '1.5rem' }}>
          <div className="admin-header-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className="portal-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Student Submission & Feedback Review
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isAdmin ? '#ede9fe' : '#e0f2fe',
                  color: isAdmin ? '#6d28d9' : '#0369a1',
                  border: isAdmin ? '1px solid #ddd6fe' : '1px solid #bae6fd',
                }}
              >
                {isAdmin ? '🛡️ Administrator Access' : '👨‍🏫 Teacher Access'}
              </span>
            </div>
            <p className="portal-subtitle" style={{ fontSize: '0.925rem', color: '#64748b', margin: '0.35rem 0 0' }}>
              Inspect student lab submissions, view original uploaded PDFs in a new tab, and provide academic evaluation feedback.
            </p>
          </div>

          <div className="admin-header-toolbar">
            <button
              type="button"
              className="btn-sync-action"
              onClick={loadSubmissions}
              disabled={loading}
              title="Refresh submission records"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{ transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 500ms ease' }}>🔄</span>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {bannerMsg && (
          <div className="alert-message success" style={{ marginBottom: '1.5rem' }}>
            <span>✅</span>
            <div style={{ flex: 1 }}>{bannerMsg}</div>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
            >
              ×
            </button>
          </div>
        )}
        {bannerErr && (
          <div className="alert-message error" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{bannerErr}</div>
            <button
              type="button"
              onClick={() => setBannerErr(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Filters and Search Bar */}
        <div
          className="portal-card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input Form */}
            <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 320px', display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search by Student ID (e.g. N210001) or Student Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 2.2rem 0.6rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    color: '#1e293b',
                    background: '#f8fafc',
                    boxSizing: 'border-box',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      padding: 0,
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Search
              </button>
            </form>

            {/* Week Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="filter-week-select" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                Week:
              </label>
              <select
                id="filter-week-select"
                value={selectedWeek}
                onChange={handleWeekChange}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <option value="">All Weeks</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={`Week ${i + 1}`}>
                    Week {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters button if any active */}
            {(activeSearch || selectedWeek) && (
              <button
                type="button"
                onClick={() => {
                  handleClearSearch();
                  setSelectedWeek('');
                }}
                style={{
                  padding: '0.55rem 0.9rem',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            )}

            {/* Records Count Badge */}
            <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              {recordRangeText}
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        <div
          className="portal-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          }}
        >
          {loading ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', width: '32px', height: '32px' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>Loading student submissions and feedback records...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: '#dc2626' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
              <h3 style={{ margin: '0 0 0.5rem' }}>Failed to Load Records</h3>
              <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.9rem' }}>{error}</p>
              <button
                type="button"
                onClick={loadSubmissions}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          ) : records.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
              <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>No Submissions Found</h3>
              <p style={{ margin: '0 0 1.25rem', color: '#64748b', fontSize: '0.9rem' }}>
                {activeSearch || selectedWeek
                  ? 'No student submission records matched your active filters.'
                  : 'No student submissions have been recorded in the portal yet.'}
              </p>
              {(activeSearch || selectedWeek) && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearSearch();
                    setSelectedWeek('');
                  }}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#334155',
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="portal-table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table className="portal-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Student</th>
                    <th style={{ width: '10%' }}>Week</th>
                    <th style={{ width: '16%' }}>PDF Lab Report</th>
                    <th style={{ width: '14%' }}>Review Status</th>
                    <th style={{ width: '26%' }}>Teacher Feedback</th>
                    <th style={{ width: '12%', textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => {
                    const isOpeningThisPdf = openingPdfId === rec.id;
                    return (
                      <tr key={rec.id}>
                        {/* Student Column */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {rec.studentProfilePicture ? (
                              <img
                                src={rec.studentProfilePicture}
                                alt={rec.studentName}
                                referrerPolicy="no-referrer"
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid #e2e8f0',
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  background: '#e2e8f0',
                                  color: '#475569',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                }}
                              >
                                {rec.studentName ? rec.studentName.charAt(0).toUpperCase() : 'S'}
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <code
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    color: '#1e293b',
                                    background: '#f1f5f9',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {rec.studentId}
                                </code>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  #{rec.id}
                                </span>
                              </div>
                              <div style={{ fontWeight: 600, color: '#1e293b', marginTop: '0.15rem' }}>
                                {rec.studentName}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {rec.year ? `${rec.year} • ` : ''}
                                {rec.section ? `Section ${rec.section}` : ''}
                                {rec.version > 1 ? ` • v${rec.version}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Week Column */}
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            {rec.weekDisplay || `Week ${rec.week}`}
                          </span>
                          <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            {rec.submittedAt
                              ? new Date(rec.submittedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </div>
                        </td>

                        {/* PDF Column */}
                        <td>
                          {rec.hasPdf ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => handleViewPdf(rec)}
                                disabled={isOpeningThisPdf}
                                title={`Open ${rec.pdfFileName || 'PDF'} in a new browser tab`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '6px',
                                  background: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  color: '#166534',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  cursor: isOpeningThisPdf ? 'wait' : 'pointer',
                                  transition: 'all 150ms ease',
                                }}
                              >
                                <span>{isOpeningThisPdf ? '⏳' : '📄'}</span>
                                <span>{isOpeningThisPdf ? 'Opening...' : 'View PDF'}</span>
                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>↗</span>
                              </button>
                              {rec.pdfFileName && (
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#64748b',
                                    marginTop: '0.2rem',
                                    maxWidth: '160px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={rec.pdfFileName}
                                >
                                  {rec.pdfFileName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                background: '#f8fafc',
                                color: '#94a3b8',
                                fontSize: '0.75rem',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              No PDF uploaded
                            </span>
                          )}
                        </td>

                        {/* Review Status Column */}
                        <td>
                          {rec.reviewed ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              <span>✅</span>
                              <span>Reviewed</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                              }}
                            >
                              <span>⏳</span>
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        {/* Teacher Feedback Column */}
                        <td>
                          {rec.feedbackText ? (
                            <div>
                              <div
                                style={{
                                  fontSize: '0.85rem',
                                  color: '#1e293b',
                                  lineHeight: '1.4',
                                  maxHeight: '3.8em',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                                title={rec.feedbackText}
                              >
                                “{rec.feedbackText}”
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {rec.teacherEmail ? `By ${rec.teacherEmail}` : 'Teacher'}{' '}
                                {rec.feedbackUpdatedAt && (
                                  <span>
                                    •{' '}
                                    {new Date(rec.feedbackUpdatedAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              No feedback provided
                            </span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                          <button
                            type="button"
                            onClick={() => openFeedbackModal(rec)}
                            style={{
                              padding: '0.45rem 0.85rem',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              color: '#2563eb',
                              border: '1px solid #cbd5e1',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 150ms ease',
                            }}
                            title="Enter or update evaluation feedback"
                          >
                            <span>{rec.feedbackText ? '✏️ Edit' : '✍️ Feedback'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                {recordRangeText}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(0)}
                  disabled={currentPage === 0 || loading}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage === 0 ? '#94a3b8' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title="Go to first page"
                >
                  « First
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0 || loading}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage === 0 ? '#94a3b8' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title="Go to previous page"
                >
                  ‹ Previous
                </button>

                {/* Numbered Page Buttons */}
                {pageNumbers.map((pageIdx) => {
                  const isActive = pageIdx === currentPage;
                  return (
                    <button
                      key={pageIdx}
                      type="button"
                      onClick={() => setCurrentPage(pageIdx)}
                      disabled={loading}
                      style={{
                        padding: '0.35rem 0.65rem',
                        minWidth: '32px',
                        borderRadius: '6px',
                        border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: isActive ? '#2563eb' : '#ffffff',
                        color: isActive ? '#ffffff' : '#334155',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {pageIdx + 1}
                    </button>
                  );
                })}

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1 || loading}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage >= totalPages - 1 ? '#94a3b8' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Go to next page"
                >
                  Next ›
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={currentPage >= totalPages - 1 || loading}
                  style={{
                    padding: '0.35rem 0.7rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage >= totalPages - 1 ? '#94a3b8' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Go to last page"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================================== */}
        {/* Feedback Modal Dialog                                                  */}
        {/* ====================================================================== */}
        {modalRecord && (
          <div
            className="admin-modal-overlay"
            onClick={closeFeedbackModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1.5rem',
            }}
          >
            <div
              className="admin-modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                    Teacher Feedback & Review
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Student: <strong style={{ color: '#1e293b' }}>{modalRecord.studentId}</strong> (
                    {modalRecord.studentName}) • {modalRecord.weekDisplay || `Week ${modalRecord.week}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeFeedbackModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.4rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    lineHeight: 1,
                  }}
                  title="Close modal"
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSaveFeedback}>
                <div style={{ padding: '1.5rem' }}>
                  {modalError && (
                    <div className="alert-message error" style={{ marginBottom: '1rem' }}>
                      <span>⚠️</span>
                      <div style={{ flex: 1 }}>{modalError}</div>
                    </div>
                  )}

                  {/* Student Details and PDF Action Bar */}
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      marginBottom: '1.25rem',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ fontSize: '0.825rem', color: '#475569' }}>
                      <div>Section: <strong>{modalRecord.section || '—'}</strong> • Year: <strong>{modalRecord.year || '—'}</strong></div>
                      <div style={{ color: '#64748b', marginTop: '0.15rem' }}>
                        Submitted:{' '}
                        {modalRecord.submittedAt
                          ? new Date(modalRecord.submittedAt).toLocaleString()
                          : '—'}
                      </div>
                    </div>

                    {modalRecord.hasPdf && (
                      <button
                        type="button"
                        onClick={() => handleViewPdf(modalRecord)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        <span>📄 View PDF in Tab</span>
                        <span>↗</span>
                      </button>
                    )}
                  </div>

                  {/* Reviewed Status Toggle */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={modalReviewed}
                        onChange={(e) => setModalReviewed(e.target.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#16a34a',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                        Mark as Reviewed (✅)
                      </span>
                    </label>
                    <p style={{ margin: '0.3rem 0 0 1.75rem', fontSize: '0.785rem', color: '#64748b' }}>
                      Check this box once you have inspected the student's submission report.
                    </p>
                  </div>

                  {/* Feedback Textarea */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label
                      htmlFor="modal-feedback-textarea"
                      style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}
                    >
                      Teacher Feedback / Remarks:
                    </label>
                    <textarea
                      id="modal-feedback-textarea"
                      rows={5}
                      value={modalFeedbackText}
                      onChange={(e) => setModalFeedbackText(e.target.value)}
                      placeholder="Enter feedback comments, code review remarks, or areas for student improvement..."
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        color: '#1e293b',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Previous Feedback Metadata */}
                  {modalRecord.teacherEmail && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                      Last updated by {modalRecord.teacherEmail}
                      {modalRecord.feedbackUpdatedAt && ` on ${new Date(modalRecord.feedbackUpdatedAt).toLocaleString()}`}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    padding: '1rem 1.5rem',
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    disabled={savingFeedback}
                    style={{
                      padding: '0.55rem 1.1rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingFeedback}
                    style={{
                      padding: '0.55rem 1.25rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: savingFeedback ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {savingFeedback && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
                    <span>{savingFeedback ? 'Saving Feedback...' : 'Save Feedback'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
