import React, { useState, useEffect } from 'react';
import { emailService } from '../../services/emailService';

/**
 * Modal dialog for dispatching evaluation reports (HTML, Gemini/Ollama JSON, or arbitrary files)
 * directly to students or faculty via Gmail SMTP.
 */
export default function EmailReportModal({
  isOpen,
  onClose,
  studentId = '',
  week = '',
  provider = '',
  availableProviders = [],
}) {
  const [activeTab, setActiveTab] = useState(studentId && week ? 'student' : 'custom');

  // Gmail SMTP configuration status
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Student report form state
  const [targetStudentId, setTargetStudentId] = useState(studentId);
  const [targetWeek, setTargetWeek] = useState(week);
  const [targetProvider, setTargetProvider] = useState(provider);
  const [studentRecipientEmail, setStudentRecipientEmail] = useState('');
  const [reportFormat, setReportFormat] = useState('html'); // 'html' | 'gemini' | 'ollama' | 'all'
  const [teacherMessage, setTeacherMessage] = useState('');

  // Custom file report form state
  const [customFile, setCustomFile] = useState(null);
  const [customRecipientEmail, setCustomRecipientEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Sending states & alerts
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success' | 'error', message: string, details?: any }

  // Sync state whenever props change
  useEffect(() => {
    if (studentId) {
      setTargetStudentId(studentId);
      const defaultEmail = `${studentId.trim().toLowerCase()}@rguktn.ac.in`;
      setStudentRecipientEmail(defaultEmail);
    }
    if (week) setTargetWeek(week);
    if (provider) setTargetProvider(provider);
    if (studentId && week) setActiveTab('student');
  }, [studentId, week, provider]);

  // Check SMTP status on open
  useEffect(() => {
    if (isOpen) {
      setAlert(null);
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await emailService.getStatus();
      setSmtpStatus(res);
    } catch {
      setSmtpStatus({ configured: false, provider: 'GMAIL_SMTP' });
    } finally {
      setLoadingStatus(false);
    }
  };

  if (!isOpen) return null;

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!targetStudentId || !targetWeek) {
      setAlert({ type: 'error', message: 'Student ID and Week are required.' });
      return;
    }
    if (!studentRecipientEmail) {
      setAlert({ type: 'error', message: 'Recipient email address is required.' });
      return;
    }

    try {
      setSending(true);
      setAlert(null);
      const res = await emailService.sendStudentReport({
        studentId: targetStudentId,
        week: targetWeek,
        provider: targetProvider || undefined,
        recipientEmail: studentRecipientEmail,
        reportFormat,
        customMessage: teacherMessage,
        forceResend: true,
      });

      setAlert({
        type: 'success',
        message: `Evaluation report dispatched to ${res.recipientEmail}!`,
        details: res.attachedFiles && res.attachedFiles.length > 0 ? `Attached: ${res.attachedFiles.join(', ')}` : null,
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to dispatch email via Gmail SMTP.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    if (!customFile) {
      setAlert({ type: 'error', message: 'Please select an HTML or JSON report file to attach.' });
      return;
    }
    if (!customRecipientEmail) {
      setAlert({ type: 'error', message: 'Recipient email address is required.' });
      return;
    }

    try {
      setSending(true);
      setAlert(null);
      const res = await emailService.sendCustomFileReport({
        file: customFile,
        recipientEmail: customRecipientEmail,
        subject: customSubject,
        message: customMessage,
      });

      setAlert({
        type: 'success',
        message: `Report file '${customFile.name}' dispatched to ${res.recipientEmail}!`,
      });
      setCustomFile(null);
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.message || 'Failed to send custom report file.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="email-modal-overlay" onClick={onClose}>
      <div
        className="email-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emailModalTitle"
      >
        {/* Header */}
        <div className="email-modal-header">
          <div className="email-modal-title-group">
            <div className="email-modal-icon">📧</div>
            <div>
              <h3 id="emailModalTitle" className="email-modal-title">
                Send Evaluation Report via Email
              </h3>
              <p className="email-modal-subtitle">
                Institutional Delivery via Gmail SMTP (smtp.gmail.com:587)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="email-modal-close"
            onClick={onClose}
            aria-label="Close email modal"
          >
            ✕
          </button>
        </div>

        {/* Gmail SMTP Configuration Status Banner */}
        {!loadingStatus && smtpStatus && (
          <div
            className={`email-smtp-status-bar ${smtpStatus.configured ? 'status-ready' : 'status-warning'}`}
          >
            {smtpStatus.configured ? (
              <>
                <span className="status-dot green"></span>
                <span>
                  Gmail SMTP Connected • Sender: <strong>{smtpStatus.sender || 'Institutional Account'}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="status-dot amber"></span>
                <span>
                  <strong>Gmail SMTP credentials not set.</strong> Add <code>MAIL_USERNAME</code> and <code>MAIL_PASSWORD</code> to your <code>.env</code> file.
                </span>
              </>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="email-modal-tabs">
          <button
            type="button"
            className={`email-tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('student');
              setAlert(null);
            }}
          >
            <span>📊 Student Report</span>
          </button>
          <button
            type="button"
            className={`email-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('custom');
              setAlert(null);
            }}
          >
            <span>📁 Send Any HTML / JSON File</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {alert && (
          <div className={`email-modal-alert alert-${alert.type}`}>
            <div className="alert-content">
              <strong>{alert.type === 'success' ? '✅ Success' : '⚠️ Error'}:</strong> {alert.message}
              {alert.details && <div className="alert-details">{alert.details}</div>}
            </div>
          </div>
        )}

        {/* Tab 1: Student Report */}
        {activeTab === 'student' && (
          <form onSubmit={handleStudentSubmit} className="email-form">
            <div className="email-field-row">
              <div className="email-field">
                <label className="email-label">Student ID *</label>
                <input
                  type="text"
                  className="email-input"
                  value={targetStudentId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetStudentId(val);
                    if (!studentRecipientEmail || studentRecipientEmail.endsWith('@rguktn.ac.in')) {
                      setStudentRecipientEmail(`${val.trim().toLowerCase()}@rguktn.ac.in`);
                    }
                  }}
                  placeholder="N210001"
                  required
                />
              </div>

              <div className="email-field">
                <label className="email-label">Lab Week *</label>
                <input
                  type="text"
                  className="email-input"
                  value={targetWeek}
                  onChange={(e) => setTargetWeek(e.target.value)}
                  placeholder="Week 1"
                  required
                />
              </div>

              {availableProviders && availableProviders.length > 0 && (
                <div className="email-field">
                  <label className="email-label">AI Provider</label>
                  <select
                    className="email-select"
                    value={targetProvider}
                    onChange={(e) => setTargetProvider(e.target.value)}
                  >
                    <option value="">Default (Gemini)</option>
                    {availableProviders.map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="email-field">
              <label className="email-label">Recipient Email Address *</label>
              <input
                type="email"
                className="email-input"
                value={studentRecipientEmail}
                onChange={(e) => setStudentRecipientEmail(e.target.value)}
                placeholder="student@rguktn.ac.in"
                required
              />
              <span className="email-hint">
                Auto-filled with student's institutional RGUKT address. Can be modified.
              </span>
            </div>

            <div className="email-field">
              <label className="email-label">Report Attachment Format *</label>
              <div className="email-format-grid">
                <label className={`email-format-card ${reportFormat === 'html' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reportFormat"
                    value="html"
                    checked={reportFormat === 'html'}
                    onChange={() => setReportFormat('html')}
                  />
                  <div className="format-info">
                    <span className="format-title">📄 Visual HTML Report</span>
                    <span className="format-desc">Standalone offline interactive HTML report</span>
                  </div>
                </label>

                <label className={`email-format-card ${reportFormat === 'gemini' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reportFormat"
                    value="gemini"
                    checked={reportFormat === 'gemini'}
                    onChange={() => setReportFormat('gemini')}
                  />
                  <div className="format-info">
                    <span className="format-title">🤖 Gemini JSON Report</span>
                    <span className="format-desc">Raw Gemini model analysis JSON file</span>
                  </div>
                </label>

                <label className={`email-format-card ${reportFormat === 'ollama' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reportFormat"
                    value="ollama"
                    checked={reportFormat === 'ollama'}
                    onChange={() => setReportFormat('ollama')}
                  />
                  <div className="format-info">
                    <span className="format-title">🦙 Ollama JSON Report</span>
                    <span className="format-desc">Raw Ollama evaluation JSON file</span>
                  </div>
                </label>

                <label className={`email-format-card ${reportFormat === 'all' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reportFormat"
                    value="all"
                    checked={reportFormat === 'all'}
                    onChange={() => setReportFormat('all')}
                  />
                  <div className="format-info">
                    <span className="format-title">📦 Complete Bundle (All)</span>
                    <span className="format-desc">Attaches styled HTML + Gemini + Ollama JSONs</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="email-field">
              <label className="email-label">Teacher Note / Instructions (Optional)</label>
              <textarea
                className="email-textarea"
                rows={3}
                value={teacherMessage}
                onChange={(e) => setTeacherMessage(e.target.value)}
                placeholder="Add any instructions, revision advice, or personal feedback..."
              />
            </div>

            <div className="email-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending via Gmail SMTP...' : '🚀 Send Report Email'}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Custom File Report */}
        {activeTab === 'custom' && (
          <form onSubmit={handleCustomSubmit} className="email-form">
            <div className="email-field">
              <label className="email-label">Select Report File (.html, .json, .pdf, .txt) *</label>
              <div className="custom-file-upload-box">
                <input
                  type="file"
                  id="customReportFile"
                  accept=".html,.htm,.json,.pdf,.txt"
                  onChange={(e) => setCustomFile(e.target.files[0] || null)}
                  className="file-input-hidden"
                />
                <label htmlFor="customReportFile" className="custom-file-dropzone">
                  <div className="file-drop-icon">📎</div>
                  {customFile ? (
                    <div className="file-drop-selected">
                      <strong>{customFile.name}</strong>
                      <span>({(customFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div className="file-drop-prompt">
                      <span>Click to choose an HTML or JSON report file</span>
                      <span className="file-drop-hint">Supports Ollama JSON, Gemini JSON, or any custom HTML report</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="email-field">
              <label className="email-label">Recipient Email Address *</label>
              <input
                type="email"
                className="email-input"
                value={customRecipientEmail}
                onChange={(e) => setCustomRecipientEmail(e.target.value)}
                placeholder="recipient@rguktn.ac.in"
                required
              />
            </div>

            <div className="email-field">
              <label className="email-label">Email Subject (Optional)</label>
              <input
                type="text"
                className="email-input"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="[RGUKT Lab Portal] Laboratory Evaluation Report"
              />
            </div>

            <div className="email-field">
              <label className="email-label">Custom Message (Optional)</label>
              <textarea
                className="email-textarea"
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Write any instructions or remarks for the recipient..."
              />
            </div>

            <div className="email-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={sending || !customFile}>
                {sending ? 'Sending via Gmail SMTP...' : '🚀 Send Custom File'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
