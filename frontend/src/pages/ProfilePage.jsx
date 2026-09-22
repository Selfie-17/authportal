import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { profileService } from '../services/profileService';
import { authService } from '../services/authService';

const BRANCH_OPTIONS = [
  { code: 'CSE', name: 'Computer Science & Engineering (CSE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/cse' },
  { code: 'ECE', name: 'Electronics & Communication Engineering (ECE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/ece' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering (EEE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/eee' },
  { code: 'ME', name: 'Mechanical Engineering (ME)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/me' },
  { code: 'CE', name: 'Civil Engineering (CE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/ce' },
  { code: 'CHE', name: 'Chemical Engineering (CHE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/che' },
  { code: 'MME', name: 'Metallurgical & Materials Engineering (MME)', type: 'ENGG' },
  { code: 'PUC', name: 'Pre University Course (PUC)', type: 'PUC' },
];

const ENGG_YEAR_OPTIONS = [
  { code: 'E1', label: 'Engineering 1 (E1)' },
  { code: 'E2', label: 'Engineering 2 (E2)' },
  { code: 'E3', label: 'Engineering 3 (E3)' },
  { code: 'E4', label: 'Engineering 4 (E4)' },
];

const PUC_YEAR_OPTIONS = [
  { code: 'PUC 1', label: 'PUC 1 (Pre-University Year 1)' },
  { code: 'PUC 2', label: 'PUC 2 (Pre-University Year 2)' },
];

const ENGG_SECTION_OPTIONS = [
  'Section 1',
  'Section 2',
  'Section 3',
  'Section 4',
  'Section 5',
  'Section 6',
];

/**
 * Normalizes section string to guarantee clean dropdown matching ("Section 1" - "Section 6", or "G 10" for PUC).
 */
export function normalizeSection(val, branch) {
  if (!val) return '';
  const str = String(val).trim();
  if (branch === 'PUC') {
    return str.toUpperCase();
  }
  const match = str.match(/\b([1-6])\b|section\s*([1-6])/i);
  if (match) {
    const num = match[1] || match[2];
    return `Section ${num}`;
  }
  const digitMatch = str.match(/[1-6]/);
  if (digitMatch) {
    return `Section ${digitMatch[0]}`;
  }
  return str;
}

export default function ProfilePage() {
  const [user, setUser] = useState(authService.getUser() || {});
  const [name, setName] = useState(user.name || '');
  const [branch, setBranch] = useState(user.branch || (user.role === 'STUDENT' ? 'CSE' : ''));
  const [academicYear, setAcademicYear] = useState(user.academicYear || '');
  const [section, setSection] = useState(normalizeSection(user.section, user.branch));
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdErr, setPwdErr] = useState(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    profileService.getProfile()
      .then((data) => {
        setUser(data);
        setName(data.name || '');
        const currentBranch = data.branch || (data.role === 'STUDENT' ? 'CSE' : '');
        setBranch(currentBranch);
        setAcademicYear(data.academicYear || '');
        setSection(normalizeSection(data.section, currentBranch));
      })
      .catch(() => {});
  }, []);

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch);
    if (newBranch === 'PUC') {
      if (!academicYear.startsWith('PUC')) {
        setAcademicYear('PUC 1');
      }
      if (ENGG_SECTION_OPTIONS.includes(normalizeSection(section, 'ENGG'))) {
        setSection('');
      }
    } else {
      if (academicYear.startsWith('PUC')) {
        setAcademicYear('E1');
      }
      if (!ENGG_SECTION_OPTIONS.includes(normalizeSection(section, newBranch))) {
        setSection('Section 1');
      }
    }
  };

  const isFormDirty =
    name.trim() !== (user.name || '').trim() ||
    branch !== (user.branch || (user.role === 'STUDENT' ? 'CSE' : '')) ||
    academicYear !== (user.academicYear || '') ||
    normalizeSection(section, branch) !== normalizeSection(user.section, user.branch);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    if (!name.trim()) {
      setProfileErr('Name cannot be empty.');
      return;
    }

    const finalSection = branch === 'PUC'
      ? (section ? section.trim().toUpperCase() : null)
      : (section ? normalizeSection(section, branch) : null);

    setProfileLoading(true);
    try {
      const updated = await profileService.updateProfile({
        name: name.trim(),
        branch: branch || null,
        academicYear: academicYear || null,
        section: finalSection,
      });
      setUser(updated);
      setName(updated.name || '');
      const updatedBranch = updated.branch || (updated.role === 'STUDENT' ? 'CSE' : '');
      setBranch(updatedBranch);
      setAcademicYear(updated.academicYear || '');
      setSection(normalizeSection(updated.section, updatedBranch));
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileErr(err.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    setPwdErr(null);

    if (!currentPassword) {
      setPwdErr('Current password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdErr('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdErr('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwdErr('New password cannot be identical to current password.');
      return;
    }

    setPwdLoading(true);
    try {
      await profileService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPwdMsg('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdErr(err.message || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  const isGoogleUser = user.authProvider === 'GOOGLE';

  return (
    <div className="portal-layout">
      <Navbar />

      <main className="portal-container profile-container">
        {/* Top Header / Breadcrumb */}
        <div className="profile-top-bar">
          <div className="profile-top-left">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="profile-back-btn"
              title="Return to previous page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back</span>
            </button>
            <div className="profile-title-block">
              <h1 className="profile-title">Profile</h1>
              <p className="profile-subtitle">Account settings & academic information</p>
            </div>
          </div>

          <div className="profile-top-portal-tag">
            RGUKT Lab Portal
          </div>
        </div>

        {/* Profile Header Identity Card */}
        <div className="profile-header-card">
          <div className="profile-header-photo-wrapper">
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.name || 'User'}
                referrerPolicy="no-referrer"
                className="profile-header-photo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    e.currentTarget.nextElementSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              className="profile-header-initials"
              style={{ display: user.profilePicture ? 'none' : 'flex' }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>

          <div className="profile-header-content">
            <div className="profile-header-top-row">
              <h2 className="profile-header-name">{user.name || 'User Profile'}</h2>
              <span className={`role-badge role-badge-${(user.role || 'student').toLowerCase()}`}>
                {user.role || 'STUDENT'}
              </span>
            </div>

            <div className="profile-header-email">
              {user.email}
            </div>

            <div className="profile-header-badges">
              {user.branch ? (
                <span className="profile-badge-pill" title="Academic Branch">
                  🏛️ {user.branch}
                </span>
              ) : (
                <span className="profile-badge-pill muted">🏛️ Branch not set</span>
              )}

              {user.academicYear ? (
                <span className="profile-badge-pill" title="Academic Year">
                  📅 {user.academicYear}
                </span>
              ) : (
                <span className="profile-badge-pill muted">📅 Year not set</span>
              )}

              {user.section ? (
                <span className="profile-badge-pill" title="Section / Classroom">
                  🏷️ {user.section}
                </span>
              ) : (
                <span className="profile-badge-pill muted">🏷️ Section not set</span>
              )}
            </div>
          </div>
        </div>

        {/* Middle 2-Column Dashboard Grid */}
        <div className="profile-dashboard-grid">
          {/* Card 1: Personal & Academic Details */}
          <div className="profile-dash-card">
            <div className="profile-card-header">
              <h3 className="profile-card-title">Personal & Academic Details</h3>
              <p className="profile-card-desc">Update your academic information</p>
            </div>

            {profileMsg && (
              <div className="profile-alert success">
                <span className="profile-alert-icon">✓</span>
                <div className="profile-alert-content">{profileMsg}</div>
              </div>
            )}
            {profileErr && (
              <div className="profile-alert error">
                <span className="profile-alert-icon">⚠️</span>
                <div className="profile-alert-content">{profileErr}</div>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="profile-form-group">
                <label className="profile-form-label" htmlFor="profile-name">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className="profile-form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  required
                />
              </div>

              <div className="profile-form-group">
                <label className="profile-form-label" htmlFor="profile-email">
                  Institutional Email
                </label>
                <div className="profile-input-wrapper">
                  <input
                    id="profile-email"
                    type="email"
                    className="profile-form-input profile-input-readonly"
                    value={user.email || ''}
                    disabled
                  />
                  <span className="profile-verified-badge">
                    ✓ Verified
                  </span>
                </div>
              </div>

              <div className="profile-form-group">
                <label className="profile-form-label" htmlFor="profile-branch">
                  Academic Branch
                </label>
                <select
                  id="profile-branch"
                  className="profile-form-select"
                  value={branch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                >
                  <option value="">-- Select Branch --</option>
                  {BRANCH_OPTIONS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engineering Year & Section */}
              <div className="profile-form-grid">
                <div className="profile-form-group" style={{ marginBottom: 0 }}>
                  <label className="profile-form-label" htmlFor="profile-year">
                    {branch === 'PUC' ? 'PUC Year' : 'Engineering Year'}
                  </label>
                  <select
                    id="profile-year"
                    className="profile-form-select"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  >
                    <option value="">-- Select Year --</option>
                    {branch === 'PUC'
                      ? PUC_YEAR_OPTIONS.map((y) => (
                          <option key={y.code} value={y.code}>
                            {y.label}
                          </option>
                        ))
                      : ENGG_YEAR_OPTIONS.map((y) => (
                          <option key={y.code} value={y.code}>
                            {y.label}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="profile-form-group" style={{ marginBottom: 0 }}>
                  <label className="profile-form-label" htmlFor="profile-section">
                    Section
                  </label>
                  {branch === 'PUC' ? (
                    <input
                      id="profile-section"
                      type="text"
                      className="profile-form-input"
                      value={section}
                      onChange={(e) => setSection(e.target.value.toUpperCase())}
                      placeholder="e.g. G 10, F 1, S 4, T 9"
                      maxLength={10}
                      style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                  ) : (
                    <select
                      id="profile-section"
                      className="profile-form-select"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                    >
                      <option value="">-- Select Section --</option>
                      {ENGG_SECTION_OPTIONS.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="profile-actions-bottom-right">
                {isFormDirty && (
                  <span className="profile-unsaved-dot">
                    ● Unsaved changes
                  </span>
                )}
                <button
                  type="submit"
                  className="btn-profile-save"
                  disabled={profileLoading || !isFormDirty}
                  id="profile-btn-save"
                >
                  {profileLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Account Security */}
          <div className="profile-dash-card">
            <div className="profile-card-header">
              <h3 className="profile-card-title">ACCOUNT SECURITY</h3>
              <p className="profile-card-desc">Authentication</p>
            </div>

            {isGoogleUser ? (
              <div className="profile-security-content">
                <div className="profile-security-active-box">
                  <div className="profile-sec-box-header">
                    <span className="profile-sec-dot-green">🟢</span>
                    <span className="profile-sec-provider-name">Google OAuth2</span>
                  </div>
                  <span className="profile-active-tag">Active</span>
                </div>

                <div className="profile-sec-notes">
                  <p style={{ margin: 0 }}>
                    Your account is secured through Google Single Sign-On.
                  </p>
                  <p style={{ margin: '0.65rem 0 0' }}>
                    Password management, recovery and 2FA are managed by Google.
                  </p>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-manage-google"
                    id="profile-btn-manage-google"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Manage Google Account</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}>
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {pwdMsg && (
                  <div className="profile-alert success">
                    <span className="profile-alert-icon">✓</span>
                    <div className="profile-alert-content">{pwdMsg}</div>
                  </div>
                )}
                {pwdErr && (
                  <div className="profile-alert error">
                    <span className="profile-alert-icon">⚠️</span>
                    <div className="profile-alert-content">{pwdErr}</div>
                  </div>
                )}

                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="current-password">
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    className="profile-form-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="new-password">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    className="profile-form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <div className="profile-form-group">
                  <label className="profile-form-label" htmlFor="confirm-new-password">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    className="profile-form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="profile-actions-bottom-right">
                  <button
                    type="submit"
                    className="btn-profile-save"
                    disabled={pwdLoading}
                    id="profile-btn-change-password"
                  >
                    {pwdLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Account Information Card */}
        <div className="profile-account-info-card">
          <h3 className="profile-account-info-title">ACCOUNT INFORMATION</h3>

          <div className="profile-account-info-grid">
            <div className="profile-info-stat">
              <span className="profile-info-label">Role</span>
              <div className="profile-info-value">
                <span className={`role-badge role-badge-${(user.role || 'student').toLowerCase()}`}>
                  {user.role || 'STUDENT'}
                </span>
              </div>
            </div>

            <div className="profile-info-stat">
              <span className="profile-info-label">Authentication</span>
              <div className="profile-info-value">
                {user.authProvider === 'GOOGLE' ? 'Google OAuth2' : 'Local Credentials'}
              </div>
            </div>

            <div className="profile-info-stat">
              <span className="profile-info-label">Account Status</span>
              <div className="profile-info-value">
                <span className="profile-status-active-pill">
                  <span className="profile-status-dot" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

