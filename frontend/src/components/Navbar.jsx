import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getAuthUser();

  const handleLogout = () => {
    authService.clearAuth();
    navigate('/login');
  };

  const role = user?.role || 'STUDENT';
  const isStudent = role === 'STUDENT';
  const isTeacher = role === 'TEACHER';
  const isAdmin = role === 'ADMIN';

  return (
    <header className="portal-navbar">
      <div className="portal-nav-content">
        <Link to={isTeacher ? '/teacher' : '/student'} className="portal-brand">
          <div className="portal-logo-icon">C</div>
          <div className="portal-brand-text">
            <h1>RGUKT Lab Portal</h1>
            <span>C-Program Submission System</span>
          </div>
        </Link>

        <div className="portal-nav-actions">
          <nav className="portal-nav-links">
            {(isStudent || isAdmin) && (
              <Link
                to="/student"
                className={`portal-nav-link ${location.pathname === '/student' ? 'active' : ''}`}
              >
                Lab Submission
              </Link>
            )}
            {(isTeacher || isAdmin) && (
              <Link
                to="/teacher"
                className={`portal-nav-link ${location.pathname === '/teacher' ? 'active' : ''}`}
              >
                Teacher Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className={`portal-nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
              >
                Admin Console
              </Link>
            )}
            <Link
              to="/profile"
              className={`portal-nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
            >
              Profile
            </Link>
          </nav>


          <div className="portal-user-badge">
            <Link to="/profile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} title="View Profile">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user.name || 'User'}
                  referrerPolicy="no-referrer"
                  className="portal-user-avatar"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className="portal-user-avatar-placeholder"
                style={{ display: user?.profilePicture ? 'none' : 'flex' }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </Link>
            <div className="portal-user-info">
              <div className="portal-user-name">{user?.name || 'Authenticated User'}</div>
              <span className={`portal-user-role ${role.toLowerCase()}`}>
                {role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="portal-btn-logout"
              title="Sign out of your session"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
