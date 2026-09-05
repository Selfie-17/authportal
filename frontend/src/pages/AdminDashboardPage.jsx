import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import { adminService } from '../services/adminService';
import { authService } from '../services/authService';


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
      setBannerMsg('User successfully provisioned.');
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

      <main className="portal-container" style={{ maxWidth: '1200px', margin: '2rem auto' }}>
        <div className="portal-header">
          <div>
            <h1 className="portal-title">Administrator Console</h1>
            <p className="portal-subtitle">Institutional user administration and submission oversight</p>
          </div>

        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddUserModal(true)}
            style={{ width: 'auto', padding: '0.65rem 1.25rem' }}
          >
            + Add New User
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <span className="alert-icon">✓</span>
          <span>{bannerMsg}</span>
          <button type="button" onClick={() => setBannerMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}>×</button>
        </div>
      )}
      {bannerErr && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <span className="alert-icon">⚠️</span>
          <span>{bannerErr}</span>
          <button type="button" onClick={() => setBannerErr(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{stats.totalUsers}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{stats.studentCount}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teachers</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{stats.teacherCount}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Administrators</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>{stats.adminCount}</p>
        </div>
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submissions</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{stats.totalSubmissions}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'users' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          User Accounts ({stats.totalUsers})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'submissions' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'submissions' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          All Submissions ({stats.totalSubmissions})
        </button>
      </div>

      {/* User Management Tab Content */}
      {activeTab === 'users' && (
        <div className="card">
          {/* User Filters */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by name or email..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
              />
            </div>
            <div style={{ width: '180px' }}>
              <select
                className="form-select"
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

          {/* Users Table */}
          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading user accounts...</p>
            </div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
              No user accounts found matching your search.
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--color-primary)',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span>{u.name}</span>
                          {u.id === currentUser.id && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(You)</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                      <td>
                        <select
                          className="form-select"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="TEACHER">TEACHER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td>
                        <span className="file-chip" style={{ fontSize: '0.75rem' }}>
                          {u.authProvider}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.85rem',
                            color: u.enabled ? '#10b981' : '#ef4444',
                            fontWeight: 500,
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: u.enabled ? '#10b981' : '#ef4444' }} />
                          {u.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleStatusToggle(u.id, u.enabled)}
                          disabled={u.id === currentUser.id && u.enabled}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
                        >
                          {u.enabled ? 'Disable' : 'Enable'}
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

      {/* Submissions Management Tab Content */}
      {activeTab === 'submissions' && (
        <div className="card">
          {/* Submissions Filter Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Week</label>
              <select className="form-select" value={subWeek} onChange={(e) => setSubWeek(e.target.value)}>
                <option value="">All Weeks</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Year</label>
              <select className="form-select" value={subYear} onChange={(e) => setSubYear(e.target.value)}>
                <option value="">All Years</option>
                <option value="E1">E1</option>
                <option value="E2">E2</option>
                <option value="E3">E3</option>
                <option value="E4">E4</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Section</label>
              <select className="form-select" value={subSection} onChange={(e) => setSubSection(e.target.value)}>
                <option value="">All Sections</option>
                {[1, 2, 3, 4, 5, 6].map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Student ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. N210001"
                value={subStudentId}
                onChange={(e) => setSubStudentId(e.target.value)}
              />
            </div>
          </div>

          {/* Submissions Table */}
          {subLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)' }}>
              No submissions found matching criteria.
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Week</th>
                    <th>Year</th>
                    <th>Section</th>
                    <th>Files</th>
                    <th>Rev</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 600 }}>{sub.studentId}</td>
                      <td>Week {sub.week}</td>
                      <td>{sub.year}</td>
                      <td>Sec {sub.section}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {sub.files?.map((f) => (
                            <span key={f.id} className="file-chip" style={{ fontSize: '0.75rem' }}>
                              {f.originalFilename}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>v{sub.version}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleDeleteSubmission(sub.id)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.8rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '480px', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Provision New User</h2>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {addUserError && (
              <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
                <span className="alert-icon">⚠️</span>
                <span>{addUserError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="new-user-name">Full Name</label>
                <input
                  id="new-user-name"
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="new-user-email">Institutional Email</label>
                <input
                  id="new-user-email"
                  type="email"
                  className="form-input"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. user@rguktn.ac.in"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="new-user-password">Initial Password</label>
                <input
                  id="new-user-password"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" htmlFor="new-user-role">System Role</label>
                <select
                  id="new-user-role"
                  className="form-select"
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
                  style={{ width: 'auto', padding: '0.65rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addUserLoading}
                  style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
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

