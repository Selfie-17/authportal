import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { profileService } from '../services/profileService';
import { authService } from '../services/authService';

export const BRANCH_OPTIONS = [
  { code: 'CSE', name: 'Computer Science & Engineering (CSE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/cse' },
  { code: 'ECE', name: 'Electronics & Communication Engineering (ECE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/ece' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering (EEE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/eee' },
  { code: 'ME', name: 'Mechanical Engineering (ME)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/me' },
  { code: 'CE', name: 'Civil Engineering (CE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/ce' },
  { code: 'CHE', name: 'Chemical Engineering (CHE)', type: 'ENGG', url: 'https://rguktn.ac.in/departments/che' },
  { code: 'MME', name: 'Metallurgical & Materials Engineering (MME)', type: 'ENGG' },
  { code: 'PUC', name: 'Pre University Course (PUC)', type: 'PUC' },
];

export const ENGG_YEAR_OPTIONS = [
  { code: 'E1', label: 'Engineering 1 (E1)' },
  { code: 'E2', label: 'Engineering 2 (E2)' },
  { code: 'E3', label: 'Engineering 3 (E3)' },
  { code: 'E4', label: 'Engineering 4 (E4)' },
];

export const PUC_YEAR_OPTIONS = [
  { code: 'PUC 1', label: 'PUC 1 (Pre-University Year 1)' },
  { code: 'PUC 2', label: 'PUC 2 (Pre-University Year 2)' },
];

export const ENGG_SECTION_OPTIONS = [
  'Section 1',
  'Section 2',
  'Section 3',
  'Section 4',
  'Section 5',
  'Section 6',
];

export default function ProfilePage() {
  const [user, setUser] = useState(authService.getUser() || {});
  const [name, setName] = useState(user.name || '');
  const [branch, setBranch] = useState(user.branch || (user.role === 'STUDENT' ? 'CSE' : ''));
  const [academicYear, setAcademicYear] = useState(user.academicYear || '');
  const [section, setSection] = useState(user.section || '');
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
        setBranch(data.branch || (data.role === 'STUDENT' ? 'CSE' : ''));
        setAcademicYear(data.academicYear || '');
        setSection(data.section || '');
      })
      .catch(() => {});
  }, []);

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch);
    if (newBranch === 'PUC') {
      if (!academicYear.startsWith('PUC')) {
        setAcademicYear('PUC 1');
      }
      if (ENGG_SECTION_OPTIONS.includes(section)) {
        setSection('');
      }
    } else {
      if (academicYear.startsWith('PUC')) {
        setAcademicYear('E1');
      }
      if (!ENGG_SECTION_OPTIONS.includes(section)) {
        setSection('Section 1');
      }
    }
  };

  const isFormDirty =
    name !== (user.name || '') ||
    branch !== (user.branch || (user.role === 'STUDENT' ? 'CSE' : '')) ||
    academicYear !== (user.academicYear || '') ||
    section !== (user.section || '');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileErr(null);

    if (!name.trim()) {
      setProfileErr('Name cannot be empty.');
      return;
    }

    setProfileLoading(true);
    try {
      const updated = await profileService.updateProfile({
        name: name.trim(),
        branch: branch || null,
        academicYear: academicYear || null,
        section: section ? section.trim().toUpperCase() : null,
      });
      setUser(updated);
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

      <main className="portal-container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <div className="portal-header">
          <div>
            <h1 className="portal-title">Account Profile</h1>
            <p className="portal-subtitle">Manage your personal information and credentials</p>
          </div>
        </div>


      {/* Account Overview Card */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.name || 'User'}
              referrerPolicy="no-referrer"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #3b82f6',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-primary), #6366f1)',
              display: user.profilePicture ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600 }}>{user.name}</h2>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
              {user.email}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`role-badge role-${(user.role || 'student').toLowerCase()}`}>
                {user.role}
              </span>
              {user.branch && (
                <span
                  className="file-chip"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}
                  title="Academic Branch"
                >
                  🏛️ {user.branch}
                </span>
              )}
              {user.academicYear && (
                <span
                  className="file-chip"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#475569',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                  title="Academic Year"
                >
                  📅 {user.academicYear}
                </span>
              )}
              {user.section && (
                <span
                  className="file-chip"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#047857',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                  }}
                  title="Section / Classroom"
                >
                  🏷️ {user.section}
                </span>
              )}
              <span className="file-chip" style={{ fontSize: '0.75rem' }}>
                Auth: {user.authProvider}
              </span>
              <span className="file-chip" style={{ fontSize: '0.75rem', color: '#10b981' }}>
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleUpdateProfile} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Personal & Academic Details</h3>

          {profileMsg && (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
              <span className="alert-icon">✓</span>
              <span>{profileMsg}</span>
            </div>
          )}
          {profileErr && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <span className="alert-icon">⚠️</span>
              <span>{profileErr}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" htmlFor="profile-email">Institutional Email</label>
            <input
              id="profile-email"
              type="email"
              className="form-input"
              value={user.email || ''}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Institutional emails are verified and managed by RGUKT administrative policy.
            </span>
          </div>

          {/* Academic Branch Selection */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" htmlFor="profile-branch">Academic Branch</label>
            <select
              id="profile-branch"
              className="form-input"
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
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
              Select your academic branch. Registered students default to CSE.
            </span>
          </div>

          {/* Dynamic Academic Year & Section depending on Branch */}
          {branch && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Year Field */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-year">
                  {branch === 'PUC' ? 'PUC Year' : 'Engineering Year'}
                </label>
                <select
                  id="profile-year"
                  className="form-input"
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

              {/* Section / Classroom Field */}
              <div className="form-group">
                <label className="form-label" htmlFor="profile-section">
                  {branch === 'PUC' ? 'PUC Classroom / Room' : 'Section'}
                </label>
                {branch === 'PUC' ? (
                  <>
                    <input
                      id="profile-section"
                      type="text"
                      className="form-input"
                      value={section}
                      onChange={(e) => setSection(e.target.value.toUpperCase())}
                      placeholder="e.g. G 10, F 1, S 4, T 9"
                      maxLength={10}
                      style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                      Ground Floor to 3rd Floor, rooms 1–10 (e.g. G 10, F 1, S 3, T 8). Auto-capitalized.
                    </span>
                  </>
                ) : (
                  <>
                    <select
                      id="profile-section"
                      className="form-input"
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
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                      Sections 1 to 6 for Engineering courses.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={profileLoading || !isFormDirty}
            style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
          >
            {profileLoading ? 'Saving Changes...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>

      {/* Security & Password Card */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Security & Credentials</h3>

        {isGoogleUser ? (
          <div className="alert" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: 'var(--color-text-primary)' }}>
            <span className="alert-icon">ℹ️</span>
            <div>
              <strong>Google Account Authentication</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                You authenticate using Google OAuth2. Password management, two-factor verification, and recovery are managed directly through your Google account.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleChangePassword}>
            {pwdMsg && (
              <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                <span className="alert-icon">✓</span>
                <span>{pwdMsg}</span>
              </div>
            )}
            {pwdErr && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <span className="alert-icon">⚠️</span>
                <span>{pwdErr}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="current-password">Current Password</label>
              <input
                id="current-password"
                type="password"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={pwdLoading}
              style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
            >
              {pwdLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
      </main>
    </div>
  );
}

