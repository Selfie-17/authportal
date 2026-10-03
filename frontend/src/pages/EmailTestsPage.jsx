import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from '../components/Navbar';
import { emailService } from '../services/emailService';
import { authService } from '../services/authService';
import '../styles/portal.css';

export default function EmailTestsPage() {
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // File and Selectors State
  const [zipFile, setZipFile] = useState(null);
  const [samplePath, setSamplePath] = useState('C:\\Users\\kampa\\Downloads\\lab_notebook_reports (2).zip');
  const [usingSample, setUsingSample] = useState(false);
  const [year, setYear] = useState('E2');
  const [week, setWeek] = useState('Week 4');
  const [section, setSection] = useState('1');
  const [facultyMessage, setFacultyMessage] = useState('Please review your lab notebook evaluation summary attached below.');

  // Destination Mode: 'test_override' (send all to specific email) vs 'detected_students'
  const [dispatchMode, setDispatchMode] = useState('test_override');
  const [targetOverrideEmail, setTargetOverrideEmail] = useState('');

  // Parsed Reports State
  const [analyzingZip, setAnalyzingZip] = useState(false);
  const [parsedData, setParsedData] = useState(null); // { totalReports, reports: [...] }
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [previewReport, setPreviewReport] = useState(null);

  // Send Execution State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [sendResult, setSendResult] = useState(null); // { success, message, results, ... }
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);
  const currentUser = authService.getUser() || {};

  // Initialize status and default test email to active user's email
  useEffect(() => {
    async function init() {
      try {
        const res = await emailService.getStatus();
        setSmtpStatus(res);
      } catch (err) {
        console.warn('Failed to load SMTP status:', err);
      } finally {
        setLoadingStatus(false);
      }
    }
    init();

    if (currentUser?.email) {
      setTargetOverrideEmail(currentUser.email);
    }
  }, []);

  // Handle ZIP File Upload or Analysis
  const analyzeZip = async (fileObj, localFilePath) => {
    setAnalyzingZip(true);
    setErrorMsg(null);
    setSendResult(null);

    try {
      let result;
      if (fileObj) {
        const formData = new FormData();
        formData.append('file', fileObj);
        result = await emailService.parseZipReports(formData);
      } else {
        result = await emailService.parseZipReports({ filePath: localFilePath });
      }

      if (result.success && result.reports && result.reports.length > 0) {
        setParsedData(result);
        // Select all by default
        const allIds = new Set(result.reports.map((r) => r.studentId));
        setSelectedStudentIds(allIds);
      } else {
        setParsedData(null);
        setErrorMsg(result.message || result.errorMessage || 'No HTML reports found in the archive.');
      }
    } catch (err) {
      console.error('ZIP Analysis error:', err);
      setErrorMsg(err.message || 'Failed to inspect ZIP archive.');
      setParsedData(null);
    } finally {
      setAnalyzingZip(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setUsingSample(false);
      analyzeZip(file, null);
    }
  };

  const handleLoadSample = () => {
    setUsingSample(true);
    setZipFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    analyzeZip(null, samplePath);
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (!parsedData?.reports) return;
    if (selectedStudentIds.size === parsedData.reports.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(parsedData.reports.map((r) => r.studentId)));
    }
  };

  const handleToggleStudent = (sId) => {
    const next = new Set(selectedStudentIds);
    if (next.has(sId)) {
      next.delete(sId);
    } else {
      next.add(sId);
    }
    setSelectedStudentIds(next);
  };

  // Dispatch Reports
  const handleStartSend = () => {
    if (selectedStudentIds.size === 0) {
      setErrorMsg('Please select at least one student report to send.');
      return;
    }
    if (dispatchMode === 'test_override' && (!targetOverrideEmail || !targetOverrideEmail.trim())) {
      setErrorMsg('Please specify a destination test email address for Safe Testing Mode.');
      return;
    }
    setErrorMsg(null);
    setConfirmModalOpen(true);
  };

  const handleExecuteSend = async () => {
    setConfirmModalOpen(false);
    setIsSending(true);
    setSendResult(null);
    setErrorMsg(null);
    setSendProgress({ current: 0, total: selectedStudentIds.size });

    try {
      const formData = new FormData();
      if (zipFile) {
        formData.append('file', zipFile);
      } else {
        formData.append('filePath', samplePath);
      }
      formData.append('year', year);
      formData.append('week', week);
      formData.append('section', section);
      if (facultyMessage) {
        formData.append('facultyMessage', facultyMessage);
      }
      if (dispatchMode === 'test_override') {
        formData.append('targetOverrideEmail', targetOverrideEmail.trim());
      }
      // Append selected IDs
      Array.from(selectedStudentIds).forEach((id) => {
        formData.append('selectedStudentIds', id);
      });

      const response = await emailService.sendZipReports(formData);
      setSendResult(response);
    } catch (err) {
      console.error('Send error:', err);
      setErrorMsg(err.message || 'Failed to dispatch reports.');
    } finally {
      setIsSending(false);
    }
  };

  const selectedReports = parsedData?.reports?.filter((r) => selectedStudentIds.has(r.studentId)) || [];

  return (
    <div className="portal-page-container">
      <Navbar />

      <main className="email-reports-page">
        {/* Header */}
        <div className="email-reports-header">
          <div className="email-reports-title-area">
            <h1>
              <span>🧪</span>
              <span>Email Testing Center</span>
            </h1>
            <p>
              Safely test and verify HTML lab notebook report distribution via Gmail SMTP before sending to actual students.
            </p>
          </div>

          <div className="email-header-actions">
            <span className={`smtp-status-pill ${smtpStatus?.configured ? 'connected' : 'not-configured'}`}>
              <span className="smtp-status-dot" />
              {smtpStatus?.configured ? (
                <>
                  <span>
                    {smtpStatus?.transport === 'GMAIL_REST_API'
                      ? '⚡ Gmail REST API (Port 443 HTTPS)'
                      : 'Gmail SMTP (Port 587)'}
                  </span>
                  {smtpStatus.sender && <span className="smtp-sender-tag">{smtpStatus.sender}</span>}
                </>
              ) : (
                <span>Email Not Configured</span>
              )}
            </span>
          </div>
        </div>

        {/* Global Error Notice */}
        {errorMsg && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚠️</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Step 1: Upload & Selectors Card */}
        <div className="email-composer-card" style={{ marginBottom: '1.75rem' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📦</span>
              <span>Step 1: Upload ZIP Archive & Select Academic Context</span>
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Upload any evaluation report ZIP containing HTML files (e.g. <code>N240035_lab_notebook.html</code>) or load the verified sample archive.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {/* File Upload Box */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.45rem' }}>
                Report ZIP Archive
              </label>
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>📁</div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>
                  {zipFile ? zipFile.name : (usingSample ? 'Sample ZIP Loaded' : 'Click to Browse ZIP Archive')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Supports archives with student HTML reports & companion JSON files
                </div>
              </div>

              {/* Sample loader shortcut */}
              <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={analyzingZip}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Load Sample Archive (lab_notebook_reports (2).zip)
                </button>
              </div>
            </div>

            {/* Selectors: Year, Week, Section */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                    Year Level
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="email-input-text"
                    style={{ padding: '0.55rem 0.65rem' }}
                  >
                    <option value="E1">E1 (Year 1)</option>
                    <option value="E2">E2 (Year 2)</option>
                    <option value="E3">E3 (Year 3)</option>
                    <option value="E4">E4 (Year 4)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                    Week
                  </label>
                  <select
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    className="email-input-text"
                    style={{ padding: '0.55rem 0.65rem' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                      <option key={w} value={`Week ${w}`}>Week {w}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                    Section
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="email-input-text"
                    style={{ padding: '0.55rem 0.65rem' }}
                  >
                    <option value="1">Section 1</option>
                    <option value="2">Section 2</option>
                    <option value="3">Section 3</option>
                    <option value="4">Section 4</option>
                    <option value="all">All Sections</option>
                  </select>
                </div>
              </div>

              {/* Faculty Custom Message */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                  Faculty Custom Message <span style={{ fontWeight: 400, color: '#64748b' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={facultyMessage}
                  onChange={(e) => setFacultyMessage(e.target.value)}
                  placeholder="Enter a message to prepend to the students' report emails..."
                  className="email-input-text"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Destination Mode Card (Crucial Feature!) */}
        <div className="email-composer-card" style={{ marginBottom: '1.75rem' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🎯</span>
              <span>Step 2: Choose Delivery Destination Mode</span>
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Choose whether to redirect all reports to your personal test email or dispatch to detected student addresses.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Mode A: Safe Testing Mode */}
            <div
              style={{
                border: dispatchMode === 'test_override' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.25rem',
                background: dispatchMode === 'test_override' ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setDispatchMode('test_override')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <input
                  type="radio"
                  id="mode_test_override"
                  name="dispatch_mode"
                  checked={dispatchMode === 'test_override'}
                  onChange={() => setDispatchMode('test_override')}
                  style={{ cursor: 'pointer', width: '17px', height: '17px' }}
                />
                <label htmlFor="mode_test_override" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', cursor: 'pointer' }}>
                  🛡️ Safe Testing Mode: Send ALL Reports to a Specific Test Email
                </label>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 0.85rem 1.7rem', lineHeight: 1.45 }}>
                Every single report in the archive will be routed to <strong>this test address</strong>. Subjects are tagged with <code>[TEST - N240035]</code> so you can review each student's rendered email in your inbox without emailing real students.
              </p>

              {dispatchMode === 'test_override' && (
                <div style={{ marginLeft: '1.7rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.3rem' }}>
                    Destination Test Email Address:
                  </label>
                  <input
                    type="email"
                    value={targetOverrideEmail}
                    onChange={(e) => setTargetOverrideEmail(e.target.value)}
                    placeholder="Enter your email (e.g. personal@gmail.com)"
                    className="email-input-text"
                    style={{ background: '#ffffff' }}
                  />
                  {currentUser?.email && currentUser.email !== targetOverrideEmail && (
                    <button
                      type="button"
                      onClick={() => setTargetOverrideEmail(currentUser.email)}
                      style={{
                        marginTop: '0.35rem',
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Use my current login email ({currentUser.email})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mode B: Live Detected Student Delivery */}
            <div
              style={{
                border: dispatchMode === 'detected_students' ? '2px solid #059669' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.25rem',
                background: dispatchMode === 'detected_students' ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setDispatchMode('detected_students')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                <input
                  type="radio"
                  id="mode_detected_students"
                  name="dispatch_mode"
                  checked={dispatchMode === 'detected_students'}
                  onChange={() => setDispatchMode('detected_students')}
                  style={{ cursor: 'pointer', width: '17px', height: '17px' }}
                />
                <label htmlFor="mode_detected_students" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', cursor: 'pointer' }}>
                  🚀 Live Mode: Send to Each Student's Detected Email Address
                </label>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 0 1.7rem', lineHeight: 1.45 }}>
                Dispatches each evaluated report directly to the corresponding student's detected institutional email address (e.g., <code>n240035@rguktn.ac.in</code>).
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Parsed Reports Table */}
        <div className="email-composer-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📋</span>
                <span>Step 3: Detected Reports ({parsedData?.reports?.length || 0})</span>
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Select the reports you wish to dispatch. Click "Preview HTML" to inspect the exact report rendering.
              </p>
            </div>

            {parsedData?.reports && parsedData.reports.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                  Selected: {selectedStudentIds.size} / {parsedData.reports.length}
                </span>
                <button
                  type="button"
                  onClick={handleStartSend}
                  disabled={isSending || selectedStudentIds.size === 0}
                  className="btn-primary"
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span>✉️</span>
                  <span>
                    {dispatchMode === 'test_override'
                      ? `Send ${selectedStudentIds.size} Reports to Test Email`
                      : `Dispatch ${selectedStudentIds.size} Reports to Students`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {analyzingZip ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Analyzing ZIP archive and extracting HTML reports...</p>
            </div>
          ) : !parsedData?.reports || parsedData.reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📦</div>
              <h4 style={{ color: '#1e293b', marginBottom: '0.25rem' }}>No Reports Loaded Yet</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 1rem auto' }}>
                Upload an evaluation report ZIP file or click "Load Sample Archive" above to analyze reports.
              </p>
              <button
                type="button"
                onClick={handleLoadSample}
                style={{
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Load Sample ZIP (lab_notebook_reports (2).zip)
              </button>
            </div>
          ) : (
            <div className="email-table-container">
              <table className="email-table">
                <thead>
                  <tr>
                    <th style={{ width: '42px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.size === parsedData.reports.length && parsedData.reports.length > 0}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: 'pointer' }}
                        title="Select/Deselect All"
                      />
                    </th>
                    <th>Student ID</th>
                    <th>Destination Email</th>
                    <th>HTML Report File</th>
                    <th>Size</th>
                    <th>Companion Data</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.reports.map((report) => {
                    const isSelected = selectedStudentIds.has(report.studentId);
                    const destinationEmail = dispatchMode === 'test_override'
                      ? (targetOverrideEmail || '(Test email not set)')
                      : report.email;

                    return (
                      <tr key={report.studentId} className={isSelected ? 'selected-row' : ''}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStudent(report.studentId)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e3a8a', fontSize: '0.9rem' }}>
                            {report.studentId}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{destinationEmail}</span>
                            {dispatchMode === 'test_override' && (
                              <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                                (Original: {report.email})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#334155' }}>{report.htmlFileName}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {(report.htmlSize / 1024).toFixed(1)} KB
                        </td>
                        <td>
                          {report.companionFiles && report.companionFiles.length > 0 ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.55rem',
                                background: '#f1f5f9',
                                color: '#334155',
                                borderRadius: '4px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                              }}
                              title={report.companionFiles.join('\n')}
                            >
                              ✓ {report.companionFiles.length} JSON files
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>None</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setPreviewReport(report)}
                            style={{
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            👁️ Preview HTML
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Send Results Report (if available) */}
        {sendResult && (
          <div
            className="email-composer-card"
            style={{
              marginTop: '1.75rem',
              borderLeft: `4px solid ${sendResult.success ? '#22c55e' : '#ef4444'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{sendResult.success ? '✓' : '⚠️'}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    {sendResult.message}
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Batch ID: #{sendResult.batchId} • Successful: {sendResult.successfulCount} • Failed: {sendResult.failedCount}
                  </p>
                </div>
              </div>
            </div>

            {sendResult.results && sendResult.results.length > 0 && (
              <div className="email-table-container">
                <table className="email-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Recipient Email</th>
                      <th>Status</th>
                      <th>Message ID</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sendResult.results.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{item.studentId}</td>
                        <td style={{ fontSize: '0.85rem' }}>{item.email}</td>
                        <td>
                          <span className={`status-pill ${item.status?.toLowerCase()}`}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                          {item.messageId || '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#dc2626' }}>
                          {item.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmModalOpen && (
          <div className="email-modal-overlay" onClick={() => setConfirmModalOpen(false)}>
            <div className="email-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="email-modal-header">
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Confirm Report Email Dispatch
                </h3>
                <button
                  type="button"
                  className="email-modal-close"
                  onClick={() => setConfirmModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="email-modal-body" style={{ padding: '1.25rem 1.5rem' }}>
                <p style={{ fontSize: '0.9rem', color: '#334155', margin: '0 0 1rem 0' }}>
                  Are you sure you want to dispatch evaluation reports via Gmail SMTP?
                </p>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#1e293b' }}>
                  <div style={{ marginBottom: '0.35rem' }}>
                    <strong>Total Reports:</strong> {selectedStudentIds.size} students
                  </div>
                  <div style={{ marginBottom: '0.35rem' }}>
                    <strong>Academic Context:</strong> {year} • {week} • Section {section}
                  </div>
                  <div style={{ marginBottom: '0.35rem' }}>
                    <strong>Destination Mode:</strong>{' '}
                    {dispatchMode === 'test_override' ? (
                      <span style={{ color: '#2563eb', fontWeight: 700 }}>
                        Safe Test: ALL {selectedStudentIds.size} sent to {targetOverrideEmail}
                      </span>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: 700 }}>
                        Live: Each student's detected institutional email
                      </span>
                    )}
                  </div>
                  {facultyMessage && (
                    <div>
                      <strong>Faculty Message:</strong> "{facultyMessage}"
                    </div>
                  )}
                </div>
              </div>

              <div className="email-modal-actions">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSend}
                  className="btn-primary"
                >
                  Confirm & Dispatch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-Flight Sending Progress Modal */}
        {isSending && (
          <div className="email-modal-overlay">
            <div className="email-modal-content" style={{ maxWidth: '440px', textAlign: 'center', padding: '2rem 1.5rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
                Transmitting Evaluation Reports...
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Dispatching reports via Gmail SMTP (smtp.gmail.com:587). Please do not close this window.
              </p>
            </div>
          </div>
        )}

        {/* HTML Preview Modal */}
        {previewReport && (
          <div className="email-modal-overlay" onClick={() => setPreviewReport(null)}>
            <div
              className="email-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '820px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="email-modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Report Preview: {previewReport.studentId}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{previewReport.htmlFileName}</span>
                </div>
                <button
                  type="button"
                  className="email-modal-close"
                  onClick={() => setPreviewReport(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f5f6f3' }}>
                <iframe
                  title="Report Preview Sandbox"
                  srcDoc={previewReport.htmlContent}
                  style={{
                    width: '100%',
                    minHeight: '520px',
                    border: '1px solid #d7dcd7',
                    borderRadius: '6px',
                    background: '#ffffff',
                  }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
