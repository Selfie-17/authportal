import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from '../components/Navbar';
import { emailService } from '../services/emailService';
import { evaluationService } from '../services/evaluationService';
import { authService } from '../services/authService';
import '../styles/portal.css';

const BRANCH_OPTIONS = [
  { code: 'ALL', name: 'All Branches' },
  { code: 'CSE', name: 'Computer Science (CSE)' },
  { code: 'ECE', name: 'Electronics (ECE)' },
  { code: 'EEE', name: 'Electrical (EEE)' },
  { code: 'ME', name: 'Mechanical (ME)' },
  { code: 'CE', name: 'Civil (CE)' },
  { code: 'CHE', name: 'Chemical (CHE)' },
  { code: 'MME', name: 'Metallurgy (MME)' },
];

const YEAR_OPTIONS = [
  { code: 'ALL', name: 'All Years' },
  { code: 'E1', name: 'Engineering 1 (E1)' },
  { code: 'E2', name: 'Engineering 2 (E2)' },
  { code: 'E3', name: 'Engineering 3 (E3)' },
  { code: 'E4', name: 'Engineering 4 (E4)' },
];

const SECTION_OPTIONS = ['ALL', '1', '2', '3', '4', '5', '6', '7', '8'];

const WEEKS = Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`);

export default function EmailReportsPage() {
  const currentUser = authService.getAuthUser();

  // Navigation tab: 'send' | 'history' | 'failed' | 'settings'
  const [activeTab, setActiveTab] = useState('send');

  // Backend Gmail SMTP Status
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Recipient Selection Filters
  const [selectedWeek, setSelectedWeek] = useState('Week 1');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Recipients data
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  // Email Content Composer
  const [subject, setSubject] = useState(`Lab Evaluation Report - Week 1`);
  const [facultyMessage, setFacultyMessage] = useState('');

  // Attachments Configuration
  const [attachHtmlReport, setAttachHtmlReport] = useState(true);
  const [attachEvaluationSummary, setAttachEvaluationSummary] = useState(true);
  const [attachJsonReport, setAttachJsonReport] = useState(false);

  // Send Flow Dialog States
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, currentStudent: '' });
  const [sendSummary, setSendSummary] = useState(null); // { successCount, failedCount, failedItems: [] }

  // Email History State
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilterTerm, setHistoryFilterTerm] = useState('');
  const [retryingId, setRetryingId] = useState(null);
  const [viewHistoryItem, setViewHistoryItem] = useState(null);

  // Test Email State (Settings tab)
  const [testEmailRecipient, setTestEmailRecipient] = useState(currentUser?.email || '');
  const [testStudentId, setTestStudentId] = useState('N210001');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Automation State (Settings tab)
  const [automationConfig, setAutomationConfig] = useState(null);
  const [savingAutomation, setSavingAutomation] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string }

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // --------------------------------------------------------------------------
  // ZIP HTML Reports Dispatcher State
  // --------------------------------------------------------------------------
  const [zipFile, setZipFile] = useState(null);
  const [zipSamplePath] = useState('C:\\Users\\kampa\\Downloads\\lab_notebook_reports (2).zip');
  const [usingZipSample, setUsingZipSample] = useState(false);
  const [zipYear, setZipYear] = useState('E2');
  const [zipWeek, setZipWeek] = useState('Week 4');
  const [zipSection, setZipSection] = useState('1');
  const [zipFacultyMessage, setZipFacultyMessage] = useState('Please review your lab notebook evaluation summary attached below.');
  const [analyzingZip, setAnalyzingZip] = useState(false);
  const [zipParsedData, setZipParsedData] = useState(null);
  const [selectedZipStudentIds, setSelectedZipStudentIds] = useState(new Set());
  const [previewZipReport, setPreviewZipReport] = useState(null);
  const [isZipConfirmOpen, setIsZipConfirmOpen] = useState(false);
  const [isZipSending, setIsZipSending] = useState(false);
  const [zipSendProgress, setZipSendProgress] = useState({ current: 0, total: 0 });
  const [zipSendResult, setZipSendResult] = useState(null);
  const zipFileInputRef = useRef(null);

  const analyzeZipArchive = async (fileObj, localFilePath) => {
    setAnalyzingZip(true);
    setZipSendResult(null);

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
        setZipParsedData(result);
        setSelectedZipStudentIds(new Set(result.reports.map((r) => r.studentId)));
        showToast('success', `ZIP analyzed successfully: detected ${result.reports.length} HTML evaluation reports.`);
      } else {
        setZipParsedData(null);
        showToast('error', result.message || result.errorMessage || 'No HTML reports found in the ZIP.');
      }
    } catch (err) {
      console.error('ZIP Analysis error:', err);
      showToast('error', err.message || 'Failed to inspect ZIP archive.');
      setZipParsedData(null);
    } finally {
      setAnalyzingZip(false);
    }
  };

  const handleZipFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setUsingZipSample(false);
      analyzeZipArchive(file, null);
    }
  };

  const handleLoadZipSample = () => {
    setUsingZipSample(true);
    setZipFile(null);
    if (zipFileInputRef.current) {
      zipFileInputRef.current.value = '';
    }
    analyzeZipArchive(null, zipSamplePath);
  };

  const handleToggleZipSelectAll = () => {
    if (!zipParsedData?.reports) return;
    if (selectedZipStudentIds.size === zipParsedData.reports.length) {
      setSelectedZipStudentIds(new Set());
    } else {
      setSelectedZipStudentIds(new Set(zipParsedData.reports.map((r) => r.studentId)));
    }
  };

  const handleToggleZipStudent = (sId) => {
    const next = new Set(selectedZipStudentIds);
    if (next.has(sId)) {
      next.delete(sId);
    } else {
      next.add(sId);
    }
    setSelectedZipStudentIds(next);
  };

  const handleExecuteZipSend = async () => {
    setIsZipConfirmOpen(false);
    setIsZipSending(true);
    setZipSendResult(null);
    setZipSendProgress({ current: 0, total: selectedZipStudentIds.size });

    try {
      const formData = new FormData();
      if (zipFile) {
        formData.append('file', zipFile);
      } else {
        formData.append('filePath', zipSamplePath);
      }
      formData.append('year', zipYear);
      formData.append('week', zipWeek);
      formData.append('section', zipSection);
      if (zipFacultyMessage) {
        formData.append('facultyMessage', zipFacultyMessage);
      }
      Array.from(selectedZipStudentIds).forEach((id) => {
        formData.append('selectedStudentIds', id);
      });

      const response = await emailService.sendZipReports(formData);
      setZipSendResult(response);
      showToast('success', response.message || 'HTML reports dispatched successfully.');
      loadHistory();
    } catch (err) {
      console.error('ZIP Send error:', err);
      showToast('error', err.message || 'Failed to dispatch ZIP reports.');
    } finally {
      setIsZipSending(false);
    }
  };

  // --------------------------------------------------------------------------
  // 1. Initial Load: Status & Automation
  // --------------------------------------------------------------------------
  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await emailService.getStatus();
      setSmtpStatus(res);
    } catch {
      setSmtpStatus({ configured: false, provider: 'GMAIL_SMTP' });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Update default subject whenever selectedWeek changes
  useEffect(() => {
    setSubject(`Lab Evaluation Report - ${selectedWeek}`);
  }, [selectedWeek]);

  // --------------------------------------------------------------------------
  // 2. Fetch Candidate Recipients
  // --------------------------------------------------------------------------
  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const res = await emailService.previewBatch({
        week: selectedWeek,
        year: selectedYear,
        branch: selectedBranch,
        section: selectedSection,
        provider: 'all',
        reportFormat: 'html',
      });
      const list = res?.recipients || [];
      setRecipients(list);

      // Pre-select all ready recipients by default
      const readyIds = new Set(
        list.filter((r) => r.hasReport && r.hasEmail && !r.alreadySent).map((r) => r.studentId)
      );
      setSelectedStudentIds(readyIds);
    } catch (err) {
      console.error('Failed to load recipients:', err);
      showToast('error', `Could not load recipients: ${err.message}`);
    } finally {
      setLoadingRecipients(false);
    }
  }, [selectedWeek, selectedYear, selectedBranch, selectedSection]);

  useEffect(() => {
    if (activeTab === 'send') {
      loadRecipients();
    }
  }, [activeTab, loadRecipients]);

  // Filtered recipient list based on search term
  const filteredRecipients = useMemo(() => {
    if (!searchTerm.trim()) return recipients;
    const term = searchTerm.trim().toLowerCase();
    return recipients.filter(
      (r) =>
        r.studentId.toLowerCase().includes(term) ||
        (r.name && r.name.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term))
    );
  }, [recipients, searchTerm]);

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all visible eligible/filtered students
      const allIds = new Set(selectedStudentIds);
      filteredRecipients.forEach((r) => {
        if (r.hasReport && r.hasEmail) allIds.add(r.studentId);
      });
      setSelectedStudentIds(allIds);
    } else {
      // Deselect visible students
      const nextIds = new Set(selectedStudentIds);
      filteredRecipients.forEach((r) => nextIds.delete(r.studentId));
      setSelectedStudentIds(nextIds);
    }
  };

  const handleToggleStudent = (studentId) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // --------------------------------------------------------------------------
  // 3. Email History Loading & Retrying
  // --------------------------------------------------------------------------
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const items = await emailService.getHistory();
      setHistoryItems(items || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      showToast('error', `Could not load email history: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'failed') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleRetryRecipient = async (recipientId) => {
    try {
      setRetryingId(recipientId);
      const res = await emailService.retryEmail(recipientId);
      showToast('success', `Retry completed: Status is ${res.status}`);
      loadHistory();
    } catch (err) {
      showToast('error', `Retry failed: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // 4. Send Reports Execution Flow
  // --------------------------------------------------------------------------
  const selectedCount = selectedStudentIds.size;

  const handleInitiateSend = () => {
    if (selectedCount === 0) {
      showToast('error', 'Please select at least one recipient to send reports.');
      return;
    }
    if (!smtpStatus?.configured) {
      showToast('error', 'Gmail SMTP is not configured. Please supply credentials in .env.');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleExecuteSend = async () => {
    setIsConfirmOpen(false);
    setIsSending(true);
    setSendSummary(null);

    const targetStudents = recipients.filter((r) => selectedStudentIds.has(r.studentId));
    const total = targetStudents.length;
    setSendProgress({ current: 0, total, currentStudent: '' });

    let successCount = 0;
    let failedCount = 0;
    const failedItems = [];

    const formatChoice =
      attachHtmlReport && attachJsonReport ? 'all' : attachJsonReport ? 'gemini' : 'html';

    for (let i = 0; i < targetStudents.length; i++) {
      const student = targetStudents[i];
      setSendProgress({
        current: i + 1,
        total,
        currentStudent: `${student.studentId} (${student.email})`,
      });

      try {
        await emailService.sendStudentReport({
          studentId: student.studentId,
          week: selectedWeek,
          recipientEmail: student.email,
          reportFormat: formatChoice,
          customMessage: facultyMessage.trim() || undefined,
          forceResend: true, // User explicitly clicked Send Reports for these students
        });
        successCount++;
      } catch (err) {
        failedCount++;
        failedItems.push({
          studentId: student.studentId,
          email: student.email,
          error: err.message,
        });
      }

      // Small throttle between Gmail SMTP messages
      await new Promise((r) => setTimeout(r, 200));
    }

    setIsSending(false);
    setSendSummary({ successCount, failedCount, failedItems });

    // Refresh recipient statuses and history
    loadRecipients();
    loadHistory();
  };

  // --------------------------------------------------------------------------
  // 5. Test Email Dispatch (Settings Tab)
  // --------------------------------------------------------------------------
  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailRecipient) {
      showToast('error', 'Please enter a test recipient email address.');
      return;
    }
    try {
      setTestSending(true);
      setTestResult(null);
      const res = await emailService.sendTestReport({
        studentId: testStudentId,
        week: selectedWeek,
        testRecipientEmail: testEmailRecipient.trim(),
        reportFormat: 'html',
        customMessage: 'This is a test evaluation transmission sent via Gmail SMTP.',
        provider: 'all',
      });
      setTestResult({ success: true, message: res.message, id: res.messageId });
      showToast('success', `Test email dispatched to ${testEmailRecipient}!`);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      showToast('error', `Test email failed: ${err.message}`);
    } finally {
      setTestSending(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. Automation Config (Settings Tab)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (activeTab === 'settings') {
      emailService.getAutomationConfig().then(setAutomationConfig).catch(() => {});
    }
  }, [activeTab]);

  const handleToggleAutomation = async () => {
    if (!automationConfig) return;
    try {
      setSavingAutomation(true);
      const updated = await emailService.saveAutomationConfig({
        ...automationConfig,
        enabled: !automationConfig.enabled,
      });
      setAutomationConfig(updated);
      showToast('success', `Automated dispatch ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      showToast('error', `Failed to update automation: ${err.message}`);
    } finally {
      setSavingAutomation(false);
    }
  };

  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const handleConnectGmailOAuth = async () => {
    try {
      setConnectingOAuth(true);
      const redirectUri = `${window.location.origin}/oauth/gmail-callback`;
      const res = await emailService.getOAuthConnectUrl(redirectUri);
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to initiate Google OAuth.');
      setConnectingOAuth(false);
    }
  };

  // Attachment count calculation
  const attachmentCount =
    (attachHtmlReport ? 1 : 0) + (attachEvaluationSummary ? 1 : 0) + (attachJsonReport ? 1 : 0);

  // Status Pill component
  const isConnected = smtpStatus?.configured;

  return (
    <div className="portal-page-container">
      {/* Universal Sidebar Navigation */}
      <Navbar />

      <main className="email-reports-main" role="main">
        {/* Toast Notification */}
        {toast && (
          <div className={`portal-toast toast-${toast.type}`} role="alert">
            <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} className="toast-close-btn">
              ✕
            </button>
          </div>
        )}

        {/* ================================================================== */}
        {/* Section A: Page Header */}
        {/* ================================================================== */}
        <header className="email-page-header">
          <div className="header-text-block">
            <h1 className="email-page-title">Email Reports</h1>
            <p className="email-page-subtitle">
              Send evaluation reports and feedback to students.
            </p>
          </div>

          <div className="header-status-indicator">
            <div className={`smtp-status-pill ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="smtp-status-dot"></span>
              <span className="smtp-status-text">
                {isConnected ? '● Gmail SMTP Connected' : '● Gmail SMTP Not Configured'}
              </span>
              {isConnected && smtpStatus?.sender && (
                <span className="smtp-sender-tag" title="Sender Email">
                  {smtpStatus.sender}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Tab Controls: [Send Reports] [History] [Failed] [Settings] */}
        <div className="email-nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'send'}
            className={`email-nav-tab ${activeTab === 'send' ? 'active' : ''}`}
            onClick={() => setActiveTab('send')}
          >
            <span className="tab-icon">✉️</span>
            <span>Send Reports</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'zipReports'}
            className={`email-nav-tab ${activeTab === 'zipReports' ? 'active' : ''}`}
            onClick={() => setActiveTab('zipReports')}
          >
            <span className="tab-icon">📦</span>
            <span>Send HTML Reports (ZIP)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`email-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="tab-icon">📋</span>
            <span>History</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'failed'}
            className={`email-nav-tab ${activeTab === 'failed' ? 'active' : ''}`}
            onClick={() => setActiveTab('failed')}
          >
            <span className="tab-icon">⚠️</span>
            <span>Failed</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            className={`email-nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
            <span>Settings</span>
          </button>
        </div>

        {/* ================================================================== */}
        {/* Tab 1: Send Reports Workspace */}
        {/* ================================================================== */}
        {activeTab === 'send' && (
          <div className="email-workspace-grid">
            {/* Left Column: Recipient Selection & Content */}
            <div className="workspace-column-left">
              {/* Subheading: Send Email Reports of HTML (ZIP Archive) */}
              <div
                className="academic-card"
                style={{
                  marginBottom: '1.25rem',
                  borderLeft: '4px solid #2563eb',
                  background: '#f8fafc',
                  padding: '1.1rem 1.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span>📦</span>
                      <span>Send Email Reports of HTML (ZIP Archive)</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569' }}>
                      Have an evaluated lab notebook archive (e.g. <code>lab_notebook_reports (2).zip</code>)? Upload or load the ZIP to automatically extract student IDs, detect emails, and dispatch directly via Gmail SMTP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zipReports')}
                    className="btn-primary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <span>Launch ZIP Dispatcher</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* B. Recipient Selection */}
              <section className="academic-card recipient-section">
                <div className="card-header">
                  <div className="card-header-title">
                    <h2>Recipient Selection</h2>
                    <span className="selection-count-badge">
                      {selectedCount} of {filteredRecipients.length} Selected
                    </span>
                  </div>
                </div>

                {/* Filters Row */}
                <div className="recipient-filter-bar">
                  <div className="filter-group">
                    <label htmlFor="filterWeek">Week</label>
                    <select
                      id="filterWeek"
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                    >
                      {WEEKS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="filterYear">Year</label>
                    <select
                      id="filterYear"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y.code} value={y.code}>
                          {y.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="filterBranch">Branch</label>
                    <select
                      id="filterBranch"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                      {BRANCH_OPTIONS.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label htmlFor="filterSection">Section</label>
                    <select
                      id="filterSection"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      {SECTION_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search & Select All Bar */}
                <div className="search-and-select-bar">
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search students by ID, Name, or Email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="student-search-input"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="clear-search-btn"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <label className="select-all-checkbox-label">
                    <input
                      type="checkbox"
                      checked={
                        filteredRecipients.length > 0 &&
                        filteredRecipients.every((r) => selectedStudentIds.has(r.studentId))
                      }
                      onChange={handleToggleSelectAll}
                    />
                    <span>Select All</span>
                  </label>
                </div>

                {/* Student Table / Cards */}
                <div className="recipient-table-container">
                  {loadingRecipients ? (
                    <div className="recipient-loading-state">
                      <div className="loading-spinner"></div>
                      <span>Loading candidate recipients...</span>
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="recipient-empty-state">
                      <p>No students match the selected filters or search query.</p>
                    </div>
                  ) : (
                    <table className="recipient-compact-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}></th>
                          <th>Student</th>
                          <th>Email</th>
                          <th>Report</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((r) => {
                          const isSelected = selectedStudentIds.has(r.studentId);
                          const isEligible = r.hasReport && r.hasEmail;
                          return (
                            <tr
                              key={r.studentId}
                              className={`recipient-row ${isSelected ? 'row-selected' : ''}`}
                              onClick={() => isEligible && handleToggleStudent(r.studentId)}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isEligible}
                                  onChange={() => handleToggleStudent(r.studentId)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td>
                                <div className="student-id-cell">
                                  <strong>{r.studentId}</strong>
                                  {r.name && r.name !== r.studentId && (
                                    <span className="student-name-sub">{r.name}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className="email-address-text">{r.email}</span>
                              </td>
                              <td>
                                {r.hasReport ? (
                                  <span className="status-tag tag-available">✓ Available</span>
                                ) : (
                                  <span className="status-tag tag-missing">✕ Missing</span>
                                )}
                              </td>
                              <td>
                                {r.status === 'Ready' && (
                                  <span className="status-tag tag-ready">Ready</span>
                                )}
                                {r.status === 'Already Sent' && (
                                  <span className="status-tag tag-sent">Already Sent</span>
                                )}
                                {r.status === 'Missing Report' && (
                                  <span className="status-tag tag-disabled">No Report</span>
                                )}
                                {r.status === 'Missing Email' && (
                                  <span className="status-tag tag-disabled">No Email</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* C. Email Content Composer */}
              <section className="academic-card composer-section">
                <div className="card-header">
                  <h2>Email Content</h2>
                </div>

                <div className="composer-body">
                  <div className="form-field">
                    <label htmlFor="emailSubject">Subject</label>
                    <input
                      id="emailSubject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Lab Evaluation Report - Week 1"
                      className="form-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="facultyMessage">
                      Faculty Message <span className="label-optional">(Optional)</span>
                    </label>
                    <textarea
                      id="facultyMessage"
                      rows={4}
                      value={facultyMessage}
                      onChange={(e) => setFacultyMessage(e.target.value)}
                      placeholder="Enter your message to the student..."
                      className="form-textarea"
                    />
                    <span className="form-help-text">
                      This message appears prominently at the top of the student's email body.
                    </span>
                  </div>
                </div>
              </section>

              {/* D. Attachments */}
              <section className="academic-card attachments-section">
                <div className="card-header">
                  <h2>Attachments</h2>
                </div>
                <div className="attachments-body">
                  <label className="attachment-toggle-item">
                    <input
                      type="checkbox"
                      checked={attachHtmlReport}
                      onChange={(e) => setAttachHtmlReport(e.target.checked)}
                    />
                    <div className="attachment-info">
                      <strong>✓ HTML Report</strong>
                      <span>Standalone offline interactive HTML report file</span>
                    </div>
                  </label>

                  <label className="attachment-toggle-item">
                    <input
                      type="checkbox"
                      checked={attachEvaluationSummary}
                      onChange={(e) => setAttachEvaluationSummary(e.target.checked)}
                    />
                    <div className="attachment-info">
                      <strong>✓ Evaluation Report</strong>
                      <span>Formatted rubric evaluation document</span>
                    </div>
                  </label>

                  <label className="attachment-toggle-item">
                    <input
                      type="checkbox"
                      checked={attachJsonReport}
                      onChange={(e) => setAttachJsonReport(e.target.checked)}
                    />
                    <div className="attachment-info">
                      <strong>✓ Evaluation JSON</strong>
                      <span>Raw Gemini / Ollama criteria breakdown data (JSON format)</span>
                    </div>
                  </label>
                </div>
              </section>
            </div>

            {/* Right Column: Live Email Preview & Primary Action */}
            <div className="workspace-column-right">
              {/* E. Email Preview */}
              <section className="academic-card preview-section">
                <div className="card-header">
                  <div className="card-header-title">
                    <h2>Live Email Preview</h2>
                    <span className="preview-tag">Actual Template</span>
                  </div>
                </div>

                <div className="email-preview-scroll-container">
                  {/* Real Email Template Preview */}
                  <div className="email-template-preview-box">
                    {/* Header */}
                    <div className="email-preview-header">
                      <div className="header-brand-title">RGUKT Academic Portal</div>
                      <div className="header-subtitle">
                        Lab Evaluation Report • {selectedWeek}
                      </div>
                    </div>

                    <div className="email-preview-content">
                      <p className="salutation-text">
                        Dear <strong>Student</strong>,
                      </p>

                      {facultyMessage.trim() ? (
                        <div className="preview-faculty-message-box">
                          <div className="message-label">Message from Faculty:</div>
                          <div className="message-text">{facultyMessage.trim()}</div>
                        </div>
                      ) : (
                        <p className="preview-lead-text">
                          Please find your laboratory evaluation details and performance breakdown
                          below.
                        </p>
                      )}

                      {/* Rendered Student Report Preview */}
                      <div className="preview-report-rendered">
                        <div className="report-preview-score-card">
                          <div className="score-label">Awarded Marks</div>
                          <div className="score-value">28 / 30</div>
                          <div className="score-badges">
                            <span className="score-badge grade">Grade: A</span>
                            <span className="score-badge status">Approved</span>
                            <span className="score-badge provider">AI Evaluated</span>
                          </div>
                        </div>

                        <div className="preview-section-title">Criteria Breakdown</div>
                        <table className="preview-rubric-table">
                          <tbody>
                            <tr>
                              <td>Objective of the Lab</td>
                              <td align="right">
                                <strong>5 / 5</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Problem Understanding</td>
                              <td align="right">
                                <strong>5 / 5</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Logic & Approach Used</td>
                              <td align="right">
                                <strong>8 / 10</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Variables & Structure</td>
                              <td align="right">
                                <strong>5 / 5</strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Observations / Output</td>
                              <td align="right">
                                <strong>5 / 5</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className="preview-section-title">Assessment Summary</div>
                        <p className="preview-assessment-text">
                          Clear program execution with well-structured logic. All corner test cases
                          passed successfully.
                        </p>
                      </div>

                      {/* Attached files indicator */}
                      <div className="preview-attached-files-box">
                        <span className="paperclip-icon">📎</span>
                        <span>
                          {attachmentCount} attached file{attachmentCount === 1 ? '' : 's'} included
                          with this email.
                        </span>
                      </div>

                      <div className="preview-signoff">
                        <p>
                          Regards,
                          <br />
                          <strong>RGUKT Academic Portal</strong>
                          <br />
                          <span className="sub-dept">
                            Rajiv Gandhi University of Knowledge Technologies
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="email-preview-footer">
                      Rajiv Gandhi University of Knowledge Technologies (RGUKT) • Academic
                      Evaluation Portal
                    </div>
                  </div>
                </div>

                {/* Send Reports Action Footer */}
                <div className="preview-action-footer">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => {
                      setSelectedStudentIds(new Set());
                      setFacultyMessage('');
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-send-reports"
                    disabled={selectedCount === 0 || !isConnected || isSending}
                    onClick={handleInitiateSend}
                  >
                    <span>🚀</span>
                    <span>
                      Send Reports ({selectedCount} Student{selectedCount === 1 ? '' : 's'})
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Tab 2: Email History */}
        {/* ================================================================== */}
        {activeTab === 'history' && (
          <div className="history-tab-container">
            <div className="history-header-bar">
              <div className="history-title-group">
                <h2>Email Transmission History</h2>
                <p>Complete record of evaluation reports dispatched via Gmail SMTP.</p>
              </div>

              <div className="history-actions-group">
                <input
                  type="text"
                  placeholder="Filter history by Student ID or Email..."
                  value={historyFilterTerm}
                  onChange={(e) => setHistoryFilterTerm(e.target.value)}
                  className="history-search-input"
                />
                <button
                  type="button"
                  onClick={loadHistory}
                  className="btn-refresh"
                  title="Reload history records"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <div className="history-table-wrapper academic-card">
              {loadingHistory ? (
                <div className="history-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading email history records...</span>
                </div>
              ) : historyItems.length === 0 ? (
                <div className="history-empty">
                  <p>No email history records available yet.</p>
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Subject</th>
                      <th>Sent At</th>
                      <th>Status</th>
                      <th>Error</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems
                      .filter((item) => {
                        if (!historyFilterTerm.trim()) return true;
                        const term = historyFilterTerm.toLowerCase();
                        return (
                          item.studentId?.toLowerCase().includes(term) ||
                          item.email?.toLowerCase().includes(term) ||
                          item.studentName?.toLowerCase().includes(term)
                        );
                      })
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.studentId}</strong>
                            {item.studentName && item.studentName !== item.studentId && (
                              <div className="history-student-sub">{item.studentName}</div>
                            )}
                          </td>
                          <td>
                            <span className="mono-text small">{item.email}</span>
                          </td>
                          <td>{item.subject}</td>
                          <td>
                            <span className="history-time-text">
                              {item.sentAt
                                ? new Date(item.sentAt).toLocaleString([], {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })
                                : '-'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge badge-${item.status?.toLowerCase()}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            {item.errorMessage ? (
                              <span className="history-error-snippet" title={item.errorMessage}>
                                {item.errorMessage.length > 40
                                  ? `${item.errorMessage.substring(0, 40)}...`
                                  : item.errorMessage}
                              </span>
                            ) : (
                              <span className="history-no-error">-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="history-row-actions">
                              <button
                                type="button"
                                className="btn-table-action view"
                                onClick={() => setViewHistoryItem(item)}
                              >
                                View
                              </button>

                              {item.status === 'FAILED' && (
                                <button
                                  type="button"
                                  className="btn-table-action retry"
                                  disabled={retryingId === item.id}
                                  onClick={() => handleRetryRecipient(item.id)}
                                >
                                  {retryingId === item.id ? 'Retrying...' : 'Retry'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Tab 3: Failed Deliveries */}
        {/* ================================================================== */}
        {activeTab === 'failed' && (
          <div className="failed-tab-container">
            <div className="history-header-bar">
              <div className="history-title-group">
                <h2>Failed Email Deliveries</h2>
                <p>Deliveries that encountered Gmail SMTP issues or invalid destination addresses.</p>
              </div>

              <button type="button" onClick={loadHistory} className="btn-refresh">
                ↻ Refresh
              </button>
            </div>

            <div className="history-table-wrapper academic-card">
              {(() => {
                const failed = historyItems.filter((i) => i.status === 'FAILED');
                if (loadingHistory) {
                  return (
                    <div className="history-loading">
                      <div className="loading-spinner"></div>
                      <span>Checking failed deliveries...</span>
                    </div>
                  );
                }
                if (failed.length === 0) {
                  return (
                    <div className="history-empty">
                      <p>✓ Excellent! There are currently no failed email transmissions.</p>
                    </div>
                  );
                }
                return (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Subject</th>
                        <th>Failed At</th>
                        <th>Error Message</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failed.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.studentId}</strong>
                          </td>
                          <td>
                            <span className="mono-text small">{item.email}</span>
                          </td>
                          <td>{item.subject}</td>
                          <td>
                            {item.sentAt ? new Date(item.sentAt).toLocaleString() : 'Recent'}
                          </td>
                          <td>
                            <span className="failed-error-callout">{item.errorMessage}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-table-action retry"
                              disabled={retryingId === item.id}
                              onClick={() => handleRetryRecipient(item.id)}
                            >
                              {retryingId === item.id ? 'Retrying...' : 'Retry'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Tab 4: Settings & Diagnostics */}
        {/* ================================================================== */}
        {activeTab === 'settings' && (
          <div className="settings-tab-container">
            <div className="settings-grid">
              {/* Card 1: Gmail Service & Integration Status */}
              <div className="academic-card settings-card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>Gmail Service & Transport Status</h2>
                  {smtpStatus?.renderFreeTierCompatible ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                      ⚡ Render Free Tier Compatible (Port 443)
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
                      ⚠️ Port 587 (Blocked on Render Free Tier)
                    </span>
                  )}
                </div>
                <div className="settings-body">
                  <div className="smtp-diagnostic-list">
                    <div className="diagnostic-item">
                      <span className="diag-label">Active Transport</span>
                      <strong className="diag-value">
                        {smtpStatus?.transport === 'GMAIL_REST_API'
                          ? 'Gmail REST API (HTTPS Port 443)'
                          : 'Gmail SMTP (Port 587)'}
                      </strong>
                    </div>
                    <div className="diagnostic-item">
                      <span className="diag-label">Host / Endpoint</span>
                      <strong className="diag-value">{smtpStatus?.host || 'smtp.gmail.com'}</strong>
                    </div>
                    <div className="diagnostic-item">
                      <span className="diag-label">Port & Security</span>
                      <strong className="diag-value">
                        {smtpStatus?.transport === 'GMAIL_REST_API' ? '443 (HTTPS TLS)' : `${smtpStatus?.port || 587} (STARTTLS)`}
                      </strong>
                    </div>
                    <div className="diagnostic-item">
                      <span className="diag-label">Sender Account</span>
                      <strong className="diag-value">
                        {smtpStatus?.sender || 'Not configured in .env'}
                      </strong>
                    </div>
                    <div className="diagnostic-item">
                      <span className="diag-label">Connection Status</span>
                      <span
                        className={`diag-pill ${smtpStatus?.configured ? 'status-ok' : 'status-err'}`}
                      >
                        {smtpStatus?.configured ? 'Connected & Ready' : 'Credentials Missing'}
                      </span>
                    </div>
                  </div>

                  {/* Connect with Google OAuth Action Card */}
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '1.25rem',
                      background: '#f0f7ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>🌐</span>
                          <span>Bypass Render Outbound SMTP Block (Port 443 HTTPS)</span>
                        </h4>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#475569' }}>
                          Render Free Tier blocks outbound SMTP ports (25, 465, 587). Authorize Google Gmail REST API to send directly over port 443 without paying!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConnectGmailOAuth}
                        disabled={connectingOAuth}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
                      >
                        {connectingOAuth ? 'Redirecting...' : '🔗 Connect Gmail Account (Port 443)'}
                      </button>
                    </div>
                  </div>

                  <div className="smtp-help-box" style={{ marginTop: '1.25rem' }}>
                    <h4>💡 How to configure for Render Free Tier:</h4>
                    <ol>
                      <li>
                        <strong>Option 1 (One-Click):</strong> Click the <strong>"Connect Gmail Account"</strong> button above, sign in with your Google account, and grant access. The token is saved automatically!
                      </li>
                      <li>
                        <strong>Option 2 (Render Environment):</strong> Visit{' '}
                        <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer">
                          Google OAuth Playground
                        </a>
                        , select scope <code>https://www.googleapis.com/auth/gmail.send</code> with your Client ID/Secret, authorize, and set <code>GMAIL_REFRESH_TOKEN</code> in your Render Environment Variables.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Card 2: Send Test Email */}
              <div className="academic-card settings-card">
                <div className="card-header">
                  <h2>Send Test Email</h2>
                </div>
                <form onSubmit={handleSendTestEmail} className="settings-body">
                  <div className="form-field">
                    <label htmlFor="testRecipient">Test Recipient Email</label>
                    <input
                      id="testRecipient"
                      type="email"
                      required
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="e.g. your-email@gmail.com"
                      className="form-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="testStudent">Student ID for Sample Data</label>
                    <input
                      id="testStudent"
                      type="text"
                      value={testStudentId}
                      onChange={(e) => setTestStudentId(e.target.value)}
                      placeholder="e.g. N210001"
                      className="form-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={testSending || !isConnected}
                    className="btn-primary"
                  >
                    {testSending ? 'Sending via Gmail SMTP...' : '✉️ Dispatch Test Email'}
                  </button>

                  {testResult && (
                    <div
                      className={`test-result-box ${testResult.success ? 'success' : 'failure'}`}
                    >
                      {testResult.success ? (
                        <>
                          <div>✓ Test email sent successfully!</div>
                          <small>Message ID: {testResult.id}</small>
                        </>
                      ) : (
                        <div>✕ Error: {testResult.error}</div>
                      )}
                    </div>
                  )}
                </form>
              </div>

              {/* Card 3: Automated Dispatch */}
              <div className="academic-card settings-card">
                <div className="card-header">
                  <h2>Automated Report Dispatch</h2>
                </div>
                <div className="settings-body">
                  <p>
                    Automatically email evaluation reports to students as soon as a teacher saves
                    or finalizes rubric feedback.
                  </p>

                  <div className="automation-toggle-row">
                    <span>Automated Sending</span>
                    <button
                      type="button"
                      disabled={savingAutomation}
                      onClick={handleToggleAutomation}
                      className={`toggle-switch-btn ${automationConfig?.enabled ? 'enabled' : 'disabled'}`}
                    >
                      {automationConfig?.enabled ? 'ACTIVE (ON)' : 'PAUSED (OFF)'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Tab: Send Email Reports of HTML (ZIP Archive) */}
        {/* ================================================================== */}
        {activeTab === 'zipReports' && (
          <div className="zip-reports-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header Box */}
            <div className="academic-card" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📦</span>
                  <span>Send Email Reports of HTML</span>
                </h2>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: '#64748b' }}>
                  Upload a ZIP archive containing evaluated student HTML lab notebook reports (e.g. <code>lab_notebook_reports.zip</code>). The system automatically analyzes the archive, extracts student IDs, detects registered or institutional emails, and dispatches the HTML reports directly via Gmail SMTP.
                </p>
              </div>

              {/* Grid for Upload & Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
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
                    onClick={() => zipFileInputRef.current?.click()}
                  >
                    <input
                      ref={zipFileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleZipFileChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>📁</div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>
                      {zipFile ? zipFile.name : (usingZipSample ? 'Sample ZIP Loaded' : 'Click to Browse ZIP Archive')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Select ZIP containing student HTML lab notebook reports
                    </div>
                  </div>

                  <div style={{ marginTop: '0.65rem' }}>
                    <button
                      type="button"
                      onClick={handleLoadZipSample}
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

                {/* Selectors: Year, Week, Section & Faculty Message */}
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                        Year Level
                      </label>
                      <select
                        value={zipYear}
                        onChange={(e) => setZipYear(e.target.value)}
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
                        value={zipWeek}
                        onChange={(e) => setZipWeek(e.target.value)}
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
                        value={zipSection}
                        onChange={(e) => setZipSection(e.target.value)}
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

                  <div>
                    <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', marginBottom: '0.35rem' }}>
                      Faculty Custom Message <span style={{ fontWeight: 400, color: '#64748b' }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={zipFacultyMessage}
                      onChange={(e) => setZipFacultyMessage(e.target.value)}
                      placeholder="Message to prepend to student report emails..."
                      className="email-input-text"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Reports Table */}
            <div className="academic-card" style={{ padding: '1.5rem 1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    Analyzed Student Reports ({zipParsedData?.reports?.length || 0})
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Verified students detected from the HTML lab notebook files inside the archive.
                  </p>
                </div>

                {zipParsedData?.reports && zipParsedData.reports.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                      Selected: {selectedZipStudentIds.size} / {zipParsedData.reports.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedZipStudentIds.size === 0) {
                          showToast('error', 'Please select at least one student report.');
                          return;
                        }
                        setIsZipConfirmOpen(true);
                      }}
                      disabled={isZipSending || selectedZipStudentIds.size === 0}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1.25rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                    >
                      <span>✉️</span>
                      <span>Send HTML Reports to {selectedZipStudentIds.size} Students</span>
                    </button>
                  </div>
                )}
              </div>

              {analyzingZip ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Analyzing ZIP archive and resolving student emails...</p>
                </div>
              ) : !zipParsedData?.reports || zipParsedData.reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>📦</div>
                  <h4 style={{ color: '#1e293b', marginBottom: '0.25rem' }}>No Reports Loaded Yet</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '440px', margin: '0 auto 1rem auto' }}>
                    Upload an evaluation report ZIP file or click "Load Sample Archive" above to analyze reports.
                  </p>
                  <button
                    type="button"
                    onClick={handleLoadZipSample}
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
                    Load Sample Archive (lab_notebook_reports (2).zip)
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
                            checked={selectedZipStudentIds.size === zipParsedData.reports.length && zipParsedData.reports.length > 0}
                            onChange={handleToggleZipSelectAll}
                            style={{ cursor: 'pointer' }}
                            title="Select/Deselect All"
                          />
                        </th>
                        <th>Student ID</th>
                        <th>Detected Email</th>
                        <th>HTML Report File</th>
                        <th>Size</th>
                        <th>Companion Data</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {zipParsedData.reports.map((report) => {
                        const isSelected = selectedZipStudentIds.has(report.studentId);
                        return (
                          <tr key={report.studentId} className={isSelected ? 'selected-row' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleZipStudent(report.studentId)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1e3a8a', fontSize: '0.9rem' }}>
                                {report.studentId}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{report.email}</span>
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
                                >
                                  ✓ {report.companionFiles.length} JSONs
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>None</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewZipReport(report)}
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

            {/* ZIP Send Results Summary */}
            {zipSendResult && (
              <div
                className="academic-card"
                style={{
                  padding: '1.5rem',
                  borderLeft: `4px solid ${zipSendResult.success ? '#22c55e' : '#ef4444'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{zipSendResult.success ? '✓' : '⚠️'}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                      {zipSendResult.message}
                    </h3>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      Batch #{zipSendResult.batchId} • Successful: {zipSendResult.successfulCount} • Failed: {zipSendResult.failedCount}
                    </p>
                  </div>
                </div>

                {zipSendResult.results && zipSendResult.results.length > 0 && (
                  <div className="email-table-container">
                    <table className="email-table">
                      <thead>
                        <tr>
                          <th>Student ID</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Message ID</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zipSendResult.results.map((item, idx) => (
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
          </div>
        )}

        {/* ZIP Send Confirmation Dialog */}
        {isZipConfirmOpen && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="confirmation-modal-card">
              <div className="modal-header">
                <h3>Dispatch HTML Evaluation Reports?</h3>
                <button
                  type="button"
                  onClick={() => setIsZipConfirmOpen(false)}
                  className="modal-close-btn"
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="confirm-summary-list">
                  <div className="confirm-item">
                    <span className="item-label">Recipients:</span>
                    <strong className="item-value">{selectedZipStudentIds.size} students</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Context:</span>
                    <strong className="item-value">{zipYear} • {zipWeek} • Section {zipSection}</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Report Format:</span>
                    <strong className="item-value">Rendered HTML Body + Original HTML & JSON Attachments</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Transport:</span>
                    <strong className="item-value">Gmail SMTP (smtp.gmail.com:587)</strong>
                  </div>
                </div>

                <p className="confirm-note">
                  Each student will receive their evaluated lab notebook directly in the email body with academic styling and attached files.
                </p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsZipConfirmOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="button" onClick={handleExecuteZipSend} className="btn-primary">
                  Confirm & Dispatch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ZIP In-Flight Progress Modal */}
        {isZipSending && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="progress-modal-card">
              <h3>Dispatching HTML Reports via Gmail SMTP...</h3>
              <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                Sending {selectedZipStudentIds.size} evaluated reports. Please do not close this window.
              </p>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${selectedZipStudentIds.size > 0 ? (zipSendProgress.current / selectedZipStudentIds.size) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ZIP HTML Report Preview Modal */}
        {previewZipReport && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setPreviewZipReport(null)}>
            <div
              className="confirmation-modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '820px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    Report Preview: {previewZipReport.studentId}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{previewZipReport.htmlFileName}</span>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setPreviewZipReport(null)}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f5f6f3' }}>
                <iframe
                  title="Report Preview Sandbox"
                  srcDoc={previewZipReport.htmlContent}
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

        {/* ================================================================== */}
        {/* Send Confirmation Dialog */}
        {/* ================================================================== */}
        {isConfirmOpen && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="confirmation-modal-card">
              <div className="modal-header">
                <h3>Send evaluation reports?</h3>
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="modal-close-btn"
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="confirm-summary-list">
                  <div className="confirm-item">
                    <span className="item-label">Recipients:</span>
                    <strong className="item-value">{selectedCount} students</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Attachments:</span>
                    <strong className="item-value">{attachmentCount} per student</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Subject:</span>
                    <strong className="item-value">{subject}</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Transport:</span>
                    <strong className="item-value">Gmail SMTP (smtp.gmail.com:587)</strong>
                  </div>
                </div>

                <p className="confirm-note">
                  Each student will receive their evaluation report directly in their email body with
                  attached standalone files.
                </p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsConfirmOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="button" onClick={handleExecuteSend} className="btn-primary">
                  Confirm & Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Send Progress & Summary Modal */}
        {/* ================================================================== */}
        {(isSending || sendSummary) && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="progress-modal-card">
              {isSending ? (
                <>
                  <h3>Sending Evaluation Reports...</h3>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.round((sendProgress.current / Math.max(1, sendProgress.total)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="progress-counter">
                    Sending {sendProgress.current} / {sendProgress.total}
                  </div>
                  <div className="progress-current-student">{sendProgress.currentStudent}</div>
                </>
              ) : (
                <>
                  <h3>Transmission Summary</h3>
                  <div className="summary-results-box">
                    <div className="summary-stat-row success">
                      <span>✓ Successfully Sent:</span>
                      <strong>{sendSummary?.successCount} emails</strong>
                    </div>
                    {sendSummary?.failedCount > 0 && (
                      <div className="summary-stat-row failed">
                        <span>✕ Failed Deliveries:</span>
                        <strong>{sendSummary?.failedCount} emails</strong>
                      </div>
                    )}
                  </div>

                  {sendSummary?.failedItems?.length > 0 && (
                    <div className="failed-items-list">
                      <h4>Failed Recipient Details:</h4>
                      <ul>
                        {sendSummary.failedItems.map((f) => (
                          <li key={f.studentId}>
                            <strong>{f.studentId}</strong> ({f.email}): {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button
                      type="button"
                      onClick={() => setSendSummary(null)}
                      className="btn-primary"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* View History Record Detail Modal */}
        {/* ================================================================== */}
        {viewHistoryItem && (
          <div className="portal-modal-backdrop" role="dialog" aria-modal="true">
            <div className="history-detail-modal-card">
              <div className="modal-header">
                <h3>Email Delivery Details</h3>
                <button
                  type="button"
                  onClick={() => setViewHistoryItem(null)}
                  className="modal-close-btn"
                >
                  ✕
                </button>
              </div>

              <div className="modal-body">
                <div className="confirm-summary-list">
                  <div className="confirm-item">
                    <span className="item-label">Student ID:</span>
                    <strong>{viewHistoryItem.studentId}</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Recipient:</span>
                    <strong>{viewHistoryItem.email}</strong>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Subject:</span>
                    <span>{viewHistoryItem.subject}</span>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Status:</span>
                    <span
                      className={`status-badge badge-${viewHistoryItem.status?.toLowerCase()}`}
                    >
                      {viewHistoryItem.status}
                    </span>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Sent At:</span>
                    <span>
                      {viewHistoryItem.sentAt
                        ? new Date(viewHistoryItem.sentAt).toLocaleString()
                        : '-'}
                    </span>
                  </div>
                  <div className="confirm-item">
                    <span className="item-label">Message ID:</span>
                    <code className="mono-text small">{viewHistoryItem.messageId || 'N/A'}</code>
                  </div>
                  {viewHistoryItem.errorMessage && (
                    <div className="confirm-item">
                      <span className="item-label">Error Details:</span>
                      <span className="failed-error-callout">{viewHistoryItem.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setViewHistoryItem(null)}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
