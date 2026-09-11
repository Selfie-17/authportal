import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from '../components/Navbar';
import AdminStatCard from '../components/admin/AdminStatCard';
import RoleBadge from '../components/admin/RoleBadge';
import StatusBadge from '../components/admin/StatusBadge';
import UserActionsMenu from '../components/admin/UserActionsMenu';
import Pagination from '../components/admin/Pagination';
import { adminService } from '../services/adminService';
import { authService } from '../services/authService';
import { extractStudentIdFromEmail } from '../utils/studentDataHelper';
import '../styles/portal.css';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'submissions'
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentCount: 0,
    teacherCount: 0,
    adminCount: 0,
    totalSubmissions: 0,
  });

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

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else {
      loadSubmissions();
    }
  }, [activeTab, loadUsers, loadSubmissions]);

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

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Top Header with Primary Action Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          <div>
            <h1 className="portal-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Administrator Console
            </h1>
            <p className="portal-subtitle" style={{ fontSize: '0.9rem', color: '#64748b', margin: '0.35rem 0 0' }}>
              Manage institutional users, roles, account statuses, and oversee laboratory submissions.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddUserModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.35rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <span>+</span> Add New User
            </button>
          </div>
        </div>

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
            <span>All Submissions</span>
            <span className="admin-tab-badge">{stats.totalSubmissions}</span>
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
        {/* TAB 2: ALL SUBMISSIONS (MODERNIZED CARD/TABLE)                         */}
        {/* ====================================================================== */}
        {activeTab === 'submissions' && (
          <div className="admin-card-container">
            {/* Header */}
            <div className="admin-card-header-bar">
              <h2 className="admin-card-header-title">All Lab Submissions</h2>
              <p className="admin-card-header-desc">
                Filter and oversee student laboratory C-program uploads across curriculum weeks, years, and sections.
              </p>
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
                        </td>
                        <td>Week {sub.week}</td>
                        <td>{sub.year}</td>
                        <td>Sec {sub.section}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {sub.files?.map((f) => (
                              <span
                                key={f.id}
                                className="file-chip"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.2rem 0.5rem',
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                }}
                              >
                                {f.originalFilename}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className="revision-badge">v{sub.version}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(sub.createdAt).toLocaleDateString()}
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

        {/* Add User Modal (Modernized) */}
        {showAddUserModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="admin-card-container"
              style={{ width: '100%', maxWidth: '480px', margin: '1rem', padding: '1.75rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Provision New User</h2>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              {addUserError && (
                <div className="alert-message error" style={{ marginBottom: '1.25rem' }}>
                  <span>⚠️</span>
                  <span>{addUserError}</span>
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="filter-label" htmlFor="new-user-name">Full Name</label>
                  <input
                    id="new-user-name"
                    type="text"
                    className="filter-search-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="filter-label" htmlFor="new-user-email">Institutional Email</label>
                  <input
                    id="new-user-email"
                    type="email"
                    className="filter-search-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. user@rguktn.ac.in"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="filter-label" htmlFor="new-user-password">Initial Password</label>
                  <input
                    id="new-user-password"
                    type="password"
                    className="filter-search-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="filter-label" htmlFor="new-user-role">System Role</label>
                  <select
                    id="new-user-role"
                    className="filter-select"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddUserModal(false)}
                    style={{ padding: '0.65rem 1.25rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addUserLoading}
                    style={{ padding: '0.65rem 1.5rem' }}
                  >
                    {addUserLoading ? 'Creating...' : 'Create Account'}
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
