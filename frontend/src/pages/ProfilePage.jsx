import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { profileService } from '../services/profileService';
import { authService } from '../services/authService';

export default function ProfilePage() {
  const [user, setUser] = useState(authService.getUser() || {});
  const [name, setName] = useState(user.name || '');
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
      })
      .catch(() => {});
  }, []);

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
      const updated = await profileService.updateProfile({ name: name.trim() });
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
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span className={`role-badge role-${(user.role || 'student').toLowerCase()}`}>
                {user.role}
              </span>
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
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Personal Details</h3>

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

          <button
            type="submit"
            className="btn btn-primary"
            disabled={profileLoading || name === user.name}
            style={{ width: 'auto', padding: '0.65rem 1.5rem' }}
          >
            {profileLoading ? 'Saving...' : 'Save Profile Changes'}
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

