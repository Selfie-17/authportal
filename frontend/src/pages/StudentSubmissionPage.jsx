import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import FileUploadZone from '../components/FileUploadZone';
import { submissionService } from '../services/submissionService';
import '../styles/portal.css';

export default function StudentSubmissionPage() {
  const [studentId, setStudentId] = useState('');
  const [week, setWeek] = useState(1);
  const [year, setYear] = useState('E1');
  const [section, setSection] = useState(1);
  const [files, setFiles] = useState([]);

  const [submissions, setSubmissions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch initial student ID and student's history on mount
  useEffect(() => {
    loadDefaultId();
    loadHistory();
  }, []);

  const loadDefaultId = async () => {
    try {
      const defaultId = await submissionService.getDefaultStudentId();
      if (defaultId) {
        setStudentId(defaultId);
      }
    } catch (err) {
      console.warn('Could not pre-fill student ID:', err.message);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await submissionService.getMySubmissions();
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to load submission history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Check if a submission already exists for the selected (week, year, section)
  const existingSubmission = submissions.find(
    (s) => s.week === Number(week) && s.year === year && s.section === Number(section)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Form validations
    const studentIdClean = studentId.trim().toUpperCase();
    if (!/^[Nn]\d{6}$/.test(studentIdClean)) {
      setErrorMessage('Student ID must start with N followed by 6 digits (e.g. N210001).');
      return;
    }

    if (files.length === 0) {
      setErrorMessage('Please select at least one .c or .pdf file to upload.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('studentId', studentIdClean);
      formData.append('week', week);
      formData.append('year', year);
      formData.append('section', section);

      files.forEach((file) => {
        formData.append('files', file);
      });

      const result = await submissionService.submitAssignment(formData);

      setSuccessMessage(
        `Assignment successfully submitted for Week ${result.week}, ${result.year}, Section ${result.section} (Revision ${result.version})!`
      );
      setFiles([]);
      await loadHistory();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit assignment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadFile = async (submissionId, fileId, filename) => {
    try {
      await submissionService.downloadFile(submissionId, fileId, filename);
    } catch (err) {
      alert('Failed to download file: ' + err.message);
    }
  };

  const handleDeleteSubmission = async (submissionId, weekNum) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete your submission for Week ${weekNum}? This will delete all uploaded files and remove your submission record.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(submissionId);
      setErrorMessage(null);
      await submissionService.deleteSubmission(submissionId);
      setSuccessMessage(`Submission for Week ${weekNum} has been permanently deleted.`);
      await loadHistory();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete submission. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };


  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container">
        <div className="page-intro">
          <h2>Academic C-Program Submission</h2>
          <p>Submit your weekly laboratory C source programs and report PDFs securely.</p>
        </div>

        {errorMessage && (
          <div className="alert-message error">
            <span>⚠️</span>
            <div>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="alert-message success">
            <span>✅</span>
            <div>{successMessage}</div>
          </div>
        )}

        <div className="portal-card">
          <div className="portal-card-header">
            <div>
              <h3 className="portal-card-title">New Lab Submission</h3>
              <p className="portal-card-subtitle">
                Fill in your academic details and select files for submission
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="portal-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="studentIdInput">
                  Student ID
                  <span className="form-hint">Format: N210001</span>
                </label>
                <input
                  id="studentIdInput"
                  type="text"
                  className="form-input"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="N210001"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="weekSelect">
                  Lab Week
                </label>
                <select
                  id="weekSelect"
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
                <label className="form-label" htmlFor="yearSelect">
                  Year Level
                  <span className="form-hint">E1 to E4</span>
                </label>
                <select
                  id="yearSelect"
                  className="form-select"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="E1">E1 (1st Year Engg)</option>
                  <option value="E2">E2 (2nd Year Engg)</option>
                  <option value="E3">E3 (3rd Year Engg)</option>
                  <option value="E4">E4 (4th Year Engg)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="sectionSelect">
                  Section
                  <span className="form-hint">Section 1–6</span>
                </label>
                <select
                  id="sectionSelect"
                  className="form-select"
                  value={section}
                  onChange={(e) => setSection(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* {existingSubmission && (
              <div className="revision-banner updated">
                <span>ℹ️</span>
                <div>
                  <strong>Existing submission detected:</strong> You previously submitted Week{' '}
                  {existingSubmission.week}, {existingSubmission.year}, Section{' '}
                  {existingSubmission.section} (Current Revision:{' '}
                  <span className="revision-badge">Rev {existingSubmission.version}</span>). Submitting
                  now will increment the revision counter and replace previously stored files.
                </div>
              </div>
            )} */}


            <FileUploadZone
              files={files}
              setFiles={setFiles}
              error={errorMessage}
              setError={setErrorMessage}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || files.length === 0}
              >
                {submitting ? 'Uploading Submission...' : existingSubmission ? 'Upload & Replace Revision' : 'Submit Assignment'}
              </button>
            </div>
          </form>
        </div>

        {/* Submission History */}
        <div className="portal-card">
          <div className="portal-card-header">
            <div>
              <h3 className="portal-card-title">My Submission History</h3>
              <p className="portal-card-subtitle">
                Review your uploaded assignments and download individual files
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadHistory}
              disabled={loadingHistory}
            >
              🔄 Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="empty-state">Loading your submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <h3>No submissions yet</h3>
              <p>You have not submitted any lab assignments. Choose a week and upload your files above.</p>
            </div>
          ) : (
            <div className="portal-table-container">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Year & Sec</th>
                    <th>Student ID</th>
                    <th>Revision</th>
                    <th>Status</th>
                    <th>Submitted Files</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <strong>Week {sub.week}</strong>
                      </td>
                      <td>
                        {sub.year} — Sec {sub.section}
                      </td>
                      <td>
                        <code>{sub.studentId}</code>
                      </td>
                      <td>
                        <span className="revision-badge">Rev {sub.version}</span>
                      </td>
                      <td>
                        <span className={`status-tag ${sub.status.toLowerCase()}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td>
                        <div className="file-chips">
                          {sub.files && sub.files.length > 0 ? (
                            sub.files.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className="btn-file-chip"
                                onClick={() => handleDownloadFile(sub.id, f.id, f.originalFilename)}
                                title={`Click to download ${f.originalFilename}`}
                              >
                                ⬇️ {f.originalFilename}
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
                      <td>
                        <button
                          type="button"
                          className="btn-delete-submission"
                          onClick={() => handleDeleteSubmission(sub.id, sub.week)}
                          disabled={deletingId === sub.id}
                          title={`Delete submission for Week ${sub.week}`}
                        >
                          {deletingId === sub.id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
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
