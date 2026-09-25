import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Navbar from '../components/Navbar';
import AdminStatCard from '../components/admin/AdminStatCard';
import RoleBadge from '../components/admin/RoleBadge';
import StatusBadge from '../components/admin/StatusBadge';
import UserActionsMenu from '../components/admin/UserActionsMenu';
import Pagination from '../components/admin/Pagination';
import { adminService } from '../services/adminService';
import { authService } from '../services/authService';
import { evaluationService } from '../services/evaluationService';
import { submissionService } from '../services/submissionService';
import { extractStudentIdFromEmail } from '../utils/studentDataHelper';
import '../styles/portal.css';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'submissions' | 'feedbacks'
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentCount: 0,
    teacherCount: 0,
    adminCount: 0,
    totalSubmissions: 0,
    totalFeedbacks: 0,
  });

  // Feedback Logs State
  const [feedbacks, setFeedbacks] = useState([]);
  const [fbQuery, setFbQuery] = useState('');
  const [fbWeek, setFbWeek] = useState('');
  const [fbReviewed, setFbReviewed] = useState('');
  const [fbLoading, setFbLoading] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState(null);
  const [deletingFbId, setDeletingFbId] = useState(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Pagination State for Users
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 8;

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('STUDENT');
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState(null);

  // Submissions State
  const [submissions, setSubmissions] = useState([]);
  const [subWeek, setSubWeek] = useState('');
  const [subYear, setSubYear] = useState('');
  const [subSection, setSubSection] = useState('');
  const [subStudentId, setSubStudentId] = useState('');
  const [subLoading, setSubLoading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Evaluation JSON Upload State (Admin Only)
  const [uploadingJson, setUploadingJson] = useState(false);
  const [uploadTargetProvider, setUploadTargetProvider] = useState('gemini');
  const fileInputRef = useRef(null);

  // Action Feedback
  const [bannerMsg, setBannerMsg] = useState(null);
  const [bannerErr, setBannerErr] = useState(null);

  const currentUser = authService.getUser() || {};

  const loadStats = useCallback(async () => {
    try {
      const data = await adminService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await adminService.getUsers({
        query: userQuery,
        role: userRoleFilter || undefined,
      });
      setUsers(data);
      setCurrentPage(1); // Reset to page 1 on query/filter change
    } catch (err) {
      setBannerErr(err.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [userQuery, userRoleFilter]);

  const loadSubmissions = useCallback(async () => {
    setSubLoading(true);
    try {
      const data = await adminService.getSubmissions({
        week: subWeek || undefined,
        year: subYear || undefined,
        section: subSection || undefined,
        studentId: subStudentId || undefined,
      });
      setSubmissions(data);
    } catch (err) {
      setBannerErr(err.message || 'Failed to load submissions.');
    } finally {
      setSubLoading(false);
    }
  }, [subWeek, subYear, subSection, subStudentId]);

  const loadFeedbacks = useCallback(async () => {
    setFbLoading(true);
    try {
      const data = await adminService.getFeedbacks({
        query: fbQuery || undefined,
        week: fbWeek || undefined,
        reviewed: fbReviewed !== '' ? fbReviewed : undefined,
      });
      setFeedbacks(data);
    } catch (err) {
      setBannerErr(err.message || 'Failed to load teacher feedback logs.');
    } finally {
      setFbLoading(false);
    }
  }, [fbQuery, fbWeek, fbReviewed]);


  const handleDownloadZip = async () => {
    if (!subWeek) {
      alert('Please select a specific week from the filters to download the batch ZIP archive.');
      return;
    }

    try {
      setDownloadingZip(true);
      await submissionService.downloadSubmissionsZip({
        week: Number(subWeek),
        year: subYear || undefined,
        section: subSection ? Number(subSection) : undefined,
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

  const suggestedZipName = subWeek
    ? (subSection ? `week-${subWeek}-sec-${subSection}.zip` : `week-${subWeek}.zip`)
    : 'Select week for ZIP';

  const handleDeleteFeedback = async (id, studentId, week) => {
    if (!window.confirm(`Are you sure you want to delete the feedback record for ${studentId} (${week})?`)) {
      return;
    }
    setDeletingFbId(id);
    try {
      await adminService.deleteFeedback(id);
      setBannerMsg(`Teacher feedback for ${studentId} (${week}) deleted successfully.`);
      await loadFeedbacks();
      await loadStats();
      if (viewingFeedback?.id === id) {
        setViewingFeedback(null);
      }
    } catch (err) {
      setBannerErr(err.message || 'Failed to delete feedback record.');
    } finally {
      setDeletingFbId(null);
    }
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'submissions') {
      loadSubmissions();
    } else if (activeTab === 'feedbacks') {
      loadFeedbacks();
    }
  }, [activeTab, loadUsers, loadSubmissions, loadFeedbacks]);

  // Client-side pagination slicing
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return users.slice(start, start + USERS_PER_PAGE);
  }, [users, currentPage]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAddUserError(null);
    setAddUserLoading(true);

    try {
      await adminService.createUser({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      });
      setShowAddUserModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('STUDENT');
      setBannerMsg('User account successfully provisioned.');
      loadUsers();
      loadStats();
    } catch (err) {
      setAddUserError(err.message || 'Failed to create user.');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleRoleChange = async (userId, targetRole) => {
    setBannerMsg(null);
    setBannerErr(null);
    try {
      await adminService.updateRole(userId, targetRole);
      setBannerMsg('User role updated successfully.');
      loadUsers();
      loadStats();
    } catch (err) {
      setBannerErr(err.message || 'Failed to change role.');
    }
  };

  const handleStatusToggle = async (userId, currentEnabled) => {
    setBannerMsg(null);
    setBannerErr(null);
    try {
      await adminService.updateStatus(userId, !currentEnabled);
      setBannerMsg(`User account ${!currentEnabled ? 'enabled' : 'disabled'} successfully.`);
      loadUsers();
    } catch (err) {
      setBannerErr(err.message || 'Failed to toggle account status.');
    }
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!window.confirm('Are you sure you want to permanently delete this submission and all associated files?')) {
      return;
    }
    setBannerMsg(null);
    setBannerErr(null);
    try {
      await adminService.deleteSubmission(submissionId);
      setBannerMsg('Submission and physical files deleted successfully.');
      loadSubmissions();
      loadStats();
    } catch (err) {
      setBannerErr(err.message || 'Failed to delete submission.');
    }
  };

  const handleUploadButtonClick = (provider = 'gemini') => {
    setUploadTargetProvider(provider);
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
      setBannerMsg(null);
      setBannerErr(null);

      const resp = await evaluationService.uploadJsonFile(file, uploadTargetProvider);
      setBannerMsg(
        `${resp.message || 'JSON processed successfully!'} Processed ${resp.processedCount} ${uploadTargetProvider.toUpperCase()} evaluations for ${resp.weeks?.join(', ') || 'selected weeks'}.`
      );
      loadStats();
    } catch (err) {
      setBannerErr(err.message || 'Failed to upload and parse JSON file.');
    } finally {
      setUploadingJson(false);
    }
  };

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Top Header with Primary Action Button */}
        <div className="admin-header-row">
          <div className="admin-header-info">
            <h1 className="portal-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Administrator Console
            </h1>
            <p className="portal-subtitle" style={{ fontSize: '0.9rem', color: '#64748b', margin: '0.35rem 0 0' }}>
              Manage institutional users, roles, account statuses, and oversee laboratory submissions.
            </p>
          </div>

          <div className="admin-header-toolbar">
            <button
              type="button"
              className="btn-admin-add-user"
              onClick={() => setShowAddUserModal(true)}
              id="admin-btn-add-user"
              title="Provision a new user account"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add New User</span>
            </button>
            <button
              type="button"
              className="btn-upload-gemini"
              onClick={() => handleUploadButtonClick('gemini')}
              disabled={uploadingJson}
              id="admin-btn-upload-gemini"
              title="Upload Google Gemini AI evaluation JSON report"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>{uploadingJson && uploadTargetProvider === 'gemini' ? 'Uploading...' : 'Upload Gemini JSON'}</span>
            </button>
            <button
              type="button"
              className="btn-upload-ollama"
              onClick={() => handleUploadButtonClick('ollama')}
              disabled={uploadingJson}
              id="admin-btn-upload-ollama"
              title="Upload Ollama (local model) evaluation JSON report"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>{uploadingJson && uploadTargetProvider === 'ollama' ? 'Uploading...' : 'Upload Ollama JSON'}</span>
            </button>
          </div>
        </div>

        {/* Global Hidden File Input for Header & Tab Upload Actions */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleJsonFileSelected}
        />

        {/* Global Feedback Banners */}
        {bannerMsg && (
          <div className="alert-message success" style={{ marginBottom: '1.5rem' }}>
            <span>✅</span>
            <div>{bannerMsg}</div>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}
        {bannerErr && (
          <div className="alert-message error" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️</span>
            <div>{bannerErr}</div>
            <button
              type="button"
              onClick={() => setBannerErr(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Five Modern Metric Cards */}
        <div className="admin-stats-grid">
          <AdminStatCard
            icon="👥"
            label="Total Users"
            value={stats.totalUsers}
            subtitle="All registered accounts"
            accentColor="#2563eb"
          />
          <AdminStatCard
            icon="🎓"
            label="Students"
            value={stats.studentCount}
            subtitle="Active lab learners"
            accentColor="#3b82f6"
          />
          <AdminStatCard
            icon="👨‍🏫"
            label="Teachers"
            value={stats.teacherCount}
            subtitle="Faculty & evaluators"
            accentColor="#10b981"
          />
          <AdminStatCard
            icon="🛡️"
            label="Administrators"
            value={stats.adminCount}
            subtitle="System controllers"
            accentColor="#8b5cf6"
          />
          <AdminStatCard
            icon="📦"
            label="Submissions"
            value={stats.totalSubmissions}
            subtitle="C-program submissions"
            accentColor="#f59e0b"
          />
          <AdminStatCard
            icon="📝"
            label="Feedbacks Given"
            value={stats.totalFeedbacks || 0}
            subtitle="Teacher reviews & remarks"
            accentColor="#06b6d4"
          />
        </div>

        {/* Modern Tabs Navigation */}
        <div className="admin-tabs-nav">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span>User Accounts</span>
            <span className="admin-tab-badge">{stats.totalUsers}</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            <span>📁 Student File Submissions & Batch ZIP</span>
            <span className="admin-tab-badge">{stats.totalSubmissions}</span>
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'feedbacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedbacks')}
          >
            <span>Teacher Feedback Logs</span>
            <span className="admin-tab-badge">{stats.totalFeedbacks !== undefined ? stats.totalFeedbacks : feedbacks.length}</span>
          </button>
        </div>

        {/* ====================================================================== */}
        {/* TAB 1: USER MANAGEMENT (MODERN HYBRID CARD/TABLE)                      */}
        {/* ====================================================================== */}
        {activeTab === 'users' && (
          <div className="admin-card-container">
            {/* Header Description */}
            <div className="admin-card-header-bar">
              <h2 className="admin-card-header-title">User Management</h2>
              <p className="admin-card-header-desc">
                View, filter, provision, update roles, and manage active status for all institutional users.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="admin-filters-bar">
              <div className="admin-search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search by name, email, or Student ID..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
                {userQuery && (
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => setUserQuery('')}
                    title="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div>
                <select
                  className="admin-role-select"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="STUDENT">Students</option>
                  <option value="TEACHER">Teachers</option>
                  <option value="ADMIN">Administrators</option>
                </select>
              </div>
            </div>

            {/* Users Table / Loading / Empty */}
            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: '#64748b' }}>Loading institutional user accounts...</p>
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <h4 style={{ color: '#1e293b', marginBottom: '0.25rem' }}>No user accounts found</h4>
                <p style={{ fontSize: '0.85rem' }}>No institutional accounts matched your current query or role filter.</p>
                {(userQuery || userRoleFilter) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setUserQuery('');
                      setUserRoleFilter('');
                    }}
                    style={{ marginTop: '1rem', padding: '0.4rem 0.85rem' }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="modern-table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right', paddingRight: '1.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((u, idx) => {
                      const absoluteIndex = (currentPage - 1) * USERS_PER_PAGE + idx + 1;
                      const studentId = extractStudentIdFromEmail(u.email);
                      const isCurrentUser = u.id === currentUser.id;

                      // Initials for avatar
                      const initials = u.name
                        ? u.name
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((n) => n[0].toUpperCase())
                            .join('')
                        : 'U';

                      return (
                        <tr key={u.id}>
                          <td style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem' }}>
                            {absoluteIndex}
                          </td>

                          {/* User Identity Column: Avatar + Name + Student ID underneath */}
                          <td>
                            <div className="user-identity-cell">
                              {u.profilePicture ? (
                                <img
                                  src={u.profilePicture}
                                  alt={u.name}
                                  className="user-avatar-circle"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="user-avatar-circle" aria-hidden="true">
                                  {initials}
                                </div>
                              )}

                              <div className="user-identity-text">
                                <div className="user-name-row">
                                  <span className="user-name-bold">{u.name}</span>
                                  {isCurrentUser && <span className="user-you-tag">(You)</span>}
                                </div>
                                {studentId ? (
                                  <span className="user-id-subtext">{studentId}</span>
                                ) : (
                                  <span className="user-id-subtext" style={{ opacity: 0.6 }}>
                                    {u.role ? u.role.toLowerCase() : 'user'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td style={{ color: '#475569', fontSize: '0.85rem' }}>{u.email}</td>

                          {/* Role Badge */}
                          <td>
                            <RoleBadge role={u.role} />
                          </td>

                          {/* Auth Provider */}
                          <td>
                            <span className={`provider-badge ${u.authProvider === 'GOOGLE' ? 'google' : ''}`}>
                              {u.authProvider === 'GOOGLE' ? 'G Google' : u.authProvider || 'LOCAL'}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <StatusBadge enabled={u.enabled} />
                          </td>

                          {/* Actions: Three-dot menu */}
                          <td style={{ textAlign: 'right', paddingRight: '1.75rem' }}>
                            <UserActionsMenu
                              user={u}
                              isCurrentUser={isCurrentUser}
                              onRoleChange={handleRoleChange}
                              onStatusToggle={handleStatusToggle}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalItems={users.length}
              itemsPerPage={USERS_PER_PAGE}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}

        {/* ====================================================================== */}
        {/* TAB 2: STUDENT FILE SUBMISSIONS & BATCH ZIP                            */}
        {/* ====================================================================== */}
        {activeTab === 'submissions' && (
          <div className="admin-card-container">
            {/* Header with Title & Batch ZIP Action */}
            <div className="admin-card-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="admin-card-header-title">Student File Submissions & Batch ZIP</h2>
                <p className="admin-card-header-desc">
                  Filter and oversee student laboratory C-program uploads, download individual files, or batch download structured ZIP archives for any week and section.
                </p>
              </div>

              <div className="zip-download-box" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span
                  className="zip-badge"
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  📁 {suggestedZipName}
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownloadZip}
                  disabled={downloadingZip || submissions.length === 0}
                  title={subWeek ? `Download batch ZIP for Week ${subWeek}` : 'Select a week in the filters below to download batch ZIP'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                >
                  {downloadingZip ? '📦 Creating ZIP...' : '⬇️ Download Batch ZIP'}
                </button>
              </div>
            </div>

            {/* Submissions Filter Bar */}
            <div className="admin-filters-bar">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', width: '100%' }}>
                <div>
                  <label className="filter-label" style={{ fontSize: '0.75rem' }}>Week</label>
                  <select
                    className="filter-select"
                    value={subWeek}
                    onChange={(e) => setSubWeek(e.target.value)}
                  >
                    <option value="">All Weeks</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="filter-label" style={{ fontSize: '0.75rem' }}>Year</label>
                  <select
                    className="filter-select"
                    value={subYear}
                    onChange={(e) => setSubYear(e.target.value)}
                  >
                    <option value="">All Years</option>
                    <option value="E1">Engineering 1 (E1)</option>
                    <option value="E2">Engineering 2 (E2)</option>
                    <option value="E3">Engineering 3 (E3)</option>
                    <option value="E4">Engineering 4 (E4)</option>
                  </select>
                </div>

                <div>
                  <label className="filter-label" style={{ fontSize: '0.75rem' }}>Section</label>
                  <select
                    className="filter-select"
                    value={subSection}
                    onChange={(e) => setSubSection(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    {[1, 2, 3, 4, 5, 6].map((s) => (
                      <option key={s} value={s}>Section {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="filter-label" style={{ fontSize: '0.75rem' }}>Student ID</label>
                  <input
                    type="text"
                    className="filter-search-input"
                    placeholder="e.g. N210001"
                    value={subStudentId}
                    onChange={(e) => setSubStudentId(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Submissions Table */}
            {subLoading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: '#64748b' }}>Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <h4 style={{ color: '#1e293b', marginBottom: '0.25rem' }}>No submissions found</h4>
                <p style={{ fontSize: '0.85rem' }}>No student submissions matched the selected filter criteria.</p>
              </div>
            ) : (
              <div className="modern-table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Week</th>
                      <th>Year</th>
                      <th>Section</th>
                      <th>Files ({submissions.reduce((acc, s) => acc + (s.files?.length || 0), 0)})</th>
                      <th>Rev</th>
                      <th>Submitted</th>
                      <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <code className="student-id-badge">{sub.studentId}</code>
                          {sub.userName && (
                            <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {sub.userName}
                            </div>
                          )}
                        </td>
                        <td>Week {sub.week}</td>
                        <td>{sub.year}</td>
                        <td>Sec {sub.section}</td>
                        <td>
                          <div className="file-chips" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {sub.files && sub.files.length > 0 ? (
                              sub.files.map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  className="btn-file-chip"
                                  onClick={() => handleDownloadSingleFile(sub.id, f.id, f.originalFilename)}
                                  title={`Download ${f.originalFilename}`}
                                  style={{
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    transition: 'all 150ms ease',
                                  }}
                                >
                                  ⬇️ {f.originalFilename}
                                </button>
                              ))
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No files</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="revision-badge">v{sub.version}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(sub.updatedAt || sub.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubmission(sub.id)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================== */}
        {/* TAB 3: TEACHER FEEDBACK LOGS (SEARCH, INSPECT, MANAGE)                */}
        {/* ====================================================================== */}
        {activeTab === 'feedbacks' && (
          <div className="admin-card-container">
            {/* Header Description */}
            <div className="admin-card-header-bar">
              <div>
                <h2 className="admin-card-header-title">Teacher Feedback Logs</h2>
                <p className="admin-card-header-desc">
                  Inspect, search, review, and manage all evaluation feedback comments and review statuses submitted by teachers.
                </p>
              </div>
              <button
                type="button"
                className="btn-sync-action"
                onClick={() => { loadFeedbacks(); loadStats(); }}
                disabled={fbLoading}
                title="Refresh feedback logs"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                <span>🔄</span>
                <span>{fbLoading ? 'Refreshing...' : 'Refresh Logs'}</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="admin-filters-bar">
              <div className="admin-search-wrapper" style={{ flex: '1 1 320px' }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="admin-search-input"
                  placeholder="Search by student ID, teacher email, or feedback keywords..."
                  value={fbQuery}
                  onChange={(e) => setFbQuery(e.target.value)}
                />
                {fbQuery && (
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => setFbQuery('')}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="admin-filter-group" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <select
                    className="filter-select"
                    value={fbWeek}
                    onChange={(e) => setFbWeek(e.target.value)}
                  >
                    <option value="">All Weeks</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={`Week ${i + 1}`}>Week {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    className="filter-select"
                    value={fbReviewed}
                    onChange={(e) => setFbReviewed(e.target.value)}
                  >
                    <option value="">All Review Statuses</option>
                    <option value="true">Reviewed Only (✅)</option>
                    <option value="false">Pending Review (⏳)</option>
                  </select>
                </div>

                {(fbQuery || fbWeek || fbReviewed) && (
                  <button
                    type="button"
                    onClick={() => { setFbQuery(''); setFbWeek(''); setFbReviewed(''); }}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Feedback Logs Table */}
            {fbLoading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p style={{ color: '#64748b' }}>Loading teacher feedback records...</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📝</div>
                <h4 style={{ color: '#1e293b', marginBottom: '0.25rem' }}>No feedback logs found</h4>
                <p style={{ fontSize: '0.85rem' }}>
                  {fbQuery || fbWeek || fbReviewed
                    ? 'No teacher feedback matches the applied filters.'
                    : 'No teacher reviews or feedbacks have been submitted yet.'}
                </p>
              </div>
            ) : (
              <div className="modern-table-responsive">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Student</th>
                      <th style={{ width: '90px' }}>Week</th>
                      <th style={{ width: '120px' }}>Status</th>
                      <th>Evaluator (Teacher)</th>
                      <th>Feedback Comments</th>
                      <th style={{ width: '150px' }}>Updated</th>
                      <th style={{ width: '140px', textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.map((fb) => (
                      <tr key={fb.id || `${fb.studentId}-${fb.week}`}>
                        <td>
                          <code className="student-id-badge" style={{ fontWeight: 700 }}>
                            {fb.studentId}
                          </code>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: '#334155',
                          }}>
                            {fb.week}
                          </span>
                        </td>
                        <td>
                          {fb.reviewed ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.6rem',
                              background: '#dcfce7',
                              color: '#166534',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid #bbf7d0',
                            }}>
                              ✓ Reviewed
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.2rem 0.6rem',
                              background: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid #fde68a',
                            }}>
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                          {fb.teacherEmail ? (
                            <span style={{ fontFamily: 'monospace', color: '#0369a1', fontWeight: 500 }}>
                              {fb.teacherEmail}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>System / Unassigned</span>
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              maxWidth: '320px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '0.85rem',
                              color: fb.feedbackText ? '#334155' : '#94a3b8',
                              cursor: fb.feedbackText ? 'pointer' : 'default',
                            }}
                            onClick={() => fb.feedbackText && setViewingFeedback(fb)}
                            title={fb.feedbackText ? 'Click to read full feedback' : 'No comments provided'}
                          >
                            {fb.feedbackText || '(No comments provided)'}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {fb.updatedAt ? new Date(fb.updatedAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            {fb.feedbackText && (
                              <button
                                type="button"
                                onClick={() => setViewingFeedback(fb)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                                title="View full feedback note"
                              >
                                View Note
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteFeedback(fb.id, fb.studentId, fb.week)}
                              disabled={deletingFbId === fb.id}
                              style={{
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                opacity: deletingFbId === fb.id ? 0.6 : 1,
                              }}
                              title="Delete this feedback entry"
                            >
                              {deletingFbId === fb.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View Full Feedback Note Modal */}
        {viewingFeedback && (
          <div className="admin-modal-overlay" onClick={() => setViewingFeedback(null)}>
            <div className="admin-modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-info">
                  <div className="admin-modal-icon-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                    <span>📝</span>
                  </div>
                  <div>
                    <h2 className="admin-modal-title">Teacher Feedback Note</h2>
                    <p className="admin-modal-subtitle">
                      Student: <strong style={{ color: '#0284c7' }}>{viewingFeedback.studentId}</strong> &bull; {viewingFeedback.week}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setViewingFeedback(null)}
                  title="Close modal"
                >
                  &times;
                </button>
              </div>

              <div style={{ padding: '1.25rem 1.75rem' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</span>
                    {viewingFeedback.reviewed ? (
                      <span style={{ color: '#166534', fontWeight: 700 }}>✓ Reviewed</span>
                    ) : (
                      <span style={{ color: '#92400e', fontWeight: 700 }}>⏳ Pending Review</span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Evaluator</span>
                    <span style={{ color: '#0369a1', fontFamily: 'monospace', fontWeight: 600 }}>
                      {viewingFeedback.teacherEmail || 'System / Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Created At</span>
                    <span style={{ color: '#334155' }}>
                      {viewingFeedback.createdAt ? new Date(viewingFeedback.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Last Updated</span>
                    <span style={{ color: '#334155' }}>
                      {viewingFeedback.updatedAt ? new Date(viewingFeedback.updatedAt).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.5rem' }}>
                    Feedback Comments
                  </label>
                  <div style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    minHeight: '120px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {viewingFeedback.feedbackText || '(No comments entered)'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteFeedback(viewingFeedback.id, viewingFeedback.studentId, viewingFeedback.week)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Delete Feedback
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingFeedback(null)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal (Modernized & Formatted) */}
        {showAddUserModal && (
          <div className="admin-modal-overlay" onClick={() => setShowAddUserModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div className="admin-modal-header-info">
                  <div className="admin-modal-icon-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                  </div>
                  <div>
                    <h2 className="admin-modal-title">Provision New User</h2>
                    <p className="admin-modal-subtitle">Register a new student, faculty evaluator, or system administrator.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setShowAddUserModal(false)}
                  title="Close dialog"
                >
                  &times;
                </button>
              </div>

              {addUserError && (
                <div className="alert-message error" style={{ margin: '1rem 1.5rem 0' }}>
                  <span>⚠️</span>
                  <span>{addUserError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                <div className="admin-modal-body">
                  <div className="admin-modal-field">
                    <label className="admin-modal-label" htmlFor="new-user-name">
                      Full Name <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-user-name"
                      type="text"
                      className="admin-modal-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                  </div>

                  <div className="admin-modal-field">
                    <label className="admin-modal-label" htmlFor="new-user-email">
                      Institutional Email <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-user-email"
                      type="email"
                      className="admin-modal-input"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. user@rguktn.ac.in, faculty@rguktrkv.ac.in"
                      required
                    />
                  </div>

                  <div className="admin-modal-field">
                    <label className="admin-modal-label" htmlFor="new-user-password">
                      Initial Password <span className="required-star">*</span>
                    </label>
                    <input
                      id="new-user-password"
                      type="password"
                      className="admin-modal-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                    <div className="admin-modal-helper">Minimum 8 characters. Users can change this in their Profile settings.</div>
                  </div>

                  <div className="admin-modal-field" style={{ marginBottom: 0 }}>
                    <label className="admin-modal-label" htmlFor="new-user-role">
                      System Role <span className="required-star">*</span>
                    </label>
                    <select
                      id="new-user-role"
                      className="admin-modal-select"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      <option value="STUDENT">STUDENT — Lab Learner & Submissions</option>
                      <option value="TEACHER">TEACHER — Faculty & Rubric Evaluator</option>
                      <option value="ADMIN">ADMIN — Institutional System Controller</option>
                    </select>
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-modal-btn-cancel"
                    onClick={() => setShowAddUserModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-modal-btn-submit"
                    disabled={addUserLoading}
                  >
                    {addUserLoading ? (
                      <>
                        <span>⏳</span>
                        <span>Provisioning...</span>
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>Create Account</span>
                      </>
                    )}
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
