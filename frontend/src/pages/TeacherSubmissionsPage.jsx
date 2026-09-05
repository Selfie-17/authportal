import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { submissionService } from '../services/submissionService';
import '../styles/portal.css';

export default function TeacherSubmissionsPage() {
  const [week, setWeek] = useState(1);
  const [year, setYear] = useState('');
  const [section, setSection] = useState(1);
  const [studentId, setStudentId] = useState('');

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch submissions whenever filters change
  useEffect(() => {
    fetchSubmissions();
  }, [week, year, section]);

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

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container">
        <div className="page-intro">
          <h2>Teacher Submissions Dashboard</h2>
          <p>
            Filter submissions by Week, Year, Section, and download student files or complete
            batch ZIP archives.
          </p>
        </div>

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
      </main>
    </div>
  );
}
