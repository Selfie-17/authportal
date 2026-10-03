import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Modern Hamburger Menu Sidebar.
 * Features:
 * - Floating hamburger trigger with animated 3-bar icon
 * - Slide-out drawer with backdrop blur
 * - User card with avatar, role badge, and email
 * - Role-based navigation with SVG icons and active state indicators
 * - Dedicated Email Reports navigation for faculty & admins
 * - Keyboard (ESC) and backdrop click dismissal
 */
export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getAuthUser();

  const handleLogout = () => {
    authService.clearAuth();
    navigate('/login');
  };

  // Close sidebar automatically when user navigates
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent background scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const role = user?.role || 'STUDENT';
  const isStudent = role === 'STUDENT';
  const isTeacher = role === 'TEACHER';
  const isAdmin = role === 'ADMIN';

  return (
    <>
      {/* Top Floating Hamburger Control Bar */}
      <header className="hamburger-top-bar" role="banner">
        <div className="hamburger-top-content">
          <div className="hamburger-top-left">
            <button
              type="button"
              id="hamburgerMenuTrigger"
              className={`hamburger-trigger-btn ${isOpen ? 'open' : ''}`}
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
              aria-expanded={isOpen}
            >
              <span className="hamburger-bar top-bar"></span>
              <span className="hamburger-bar middle-bar"></span>
              <span className="hamburger-bar bottom-bar"></span>
            </button>

            <Link to={isTeacher ? '/teacher' : '/student'} className="hamburger-brand-mini">
              <div className="portal-logo-icon mini">C</div>
              <div className="hamburger-brand-mini-text">
                <span className="brand-title">RGUKT Lab Portal</span>
                <span className="brand-role-tag">{role}</span>
              </div>
            </Link>
          </div>

          <div className="hamburger-top-right">
            <Link to="/profile" className="hamburger-user-pill" title="My Profile">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name || 'User'}
                  referrerPolicy="no-referrer"
                  className="hamburger-user-avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="hamburger-user-avatar-placeholder"
                style={{ display: user?.profilePicture ? 'none' : 'flex' }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="hamburger-user-name-short">{user?.name?.split(' ')[0] || 'User'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Sidebar Drawer */}
      <aside
        id="appSidebarDrawer"
        className={`portal-sidebar-drawer ${isOpen ? 'open' : ''}`}
        aria-label="Main Navigation"
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <Link
            to={isTeacher ? '/teacher' : '/student'}
            className="sidebar-brand"
            onClick={() => setIsOpen(false)}
          >
            <div className="portal-logo-icon">C</div>
            <div className="sidebar-brand-text">
              <h2>RGUKT Lab Portal</h2>
              <span>C-Program Submission System</span>
            </div>
          </Link>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="sidebar-user-card">
          <Link
            to="/profile"
            className="sidebar-user-link"
            onClick={() => setIsOpen(false)}
            title="Edit Profile"
          >
            <div className="sidebar-avatar-wrapper">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name || 'User'}
                  referrerPolicy="no-referrer"
                  className="sidebar-user-avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="sidebar-user-avatar-placeholder"
                style={{ display: user?.profilePicture ? 'none' : 'flex' }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>

            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user?.name || 'Authenticated User'}</span>
              <span className="sidebar-user-email">{user?.email || ''}</span>
              <span className={`portal-user-role ${role.toLowerCase()}`}>{role}</span>
            </div>
          </Link>
        </div>

        {/* Navigation Menu Links */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Navigation</div>

          {(isStudent || isAdmin) && (
            <Link
              to="/student"
              className={`sidebar-nav-item ${location.pathname === '/student' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Lab Submission</span>
            </Link>
          )}

          {(isTeacher || isAdmin) && (
            <Link
              to="/teacher"
              className={`sidebar-nav-item ${location.pathname === '/teacher' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <span>Teacher Dashboard</span>
            </Link>
          )}

          {(isTeacher || isAdmin) && (
            <Link
              to="/teacher/feedback"
              className={`sidebar-nav-item ${location.pathname === '/teacher/feedback' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Student Feedback</span>
            </Link>
          )}

          {(isTeacher || isAdmin) && (
            <Link
              to="/email-reports"
              className={`sidebar-nav-item ${location.pathname === '/email-reports' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              <span>Email Reports</span>
            </Link>
          )}

          {(isTeacher || isAdmin) && (
            <Link
              to="/email-tests"
              className={`sidebar-nav-item ${location.pathname === '/email-tests' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.31L4.69 16.5A2 2 0 0 0 6.32 19.5h11.36a2 2 0 0 0 1.63-3L14 9.31V2"></path>
                <line x1="8.5" y1="2" x2="15.5" y2="2"></line>
                <line x1="14" y1="9.31" x2="10" y2="9.31"></line>
              </svg>
              <span>Email Tests</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              className={`sidebar-nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Admin Console</span>
            </Link>
          )}

          <Link
            to="/profile"
            className={`sidebar-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
            onClick={() => setIsOpen(false)}
          >
            <svg className="sidebar-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>My Profile</span>
          </Link>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-logout-btn"
            title="Sign out of RGUKT Portal"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
