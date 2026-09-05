import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Common layout wrapper for authentication pages (Login and Register).
 * Provides institutional branding, card elevation, and responsive container.
 */
export default function AuthLayout({
  title,
  description,
  footerText,
  footerLinkText,
  footerLinkTo,
  children,
}) {
  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        {/* Brand Header */}
        <header className="auth-header">
          <Link to="/login" className="auth-brand" aria-label="AuthPortal Home">
            <div className="auth-logo-icon" aria-hidden="true">
              AP
            </div>
            <span className="auth-brand-name">AuthPortal</span>
          </Link>
          <p className="auth-subtitle">RGUKT Nuzvid Institutional Gateway</p>
        </header>

        {/* Authentication Card */}
        <main className="auth-card">
          <h1 className="auth-card-title">{title}</h1>
          {description && <p className="auth-card-desc">{description}</p>}
          {children}
        </main>

        {/* Footer Link */}
        {footerText && footerLinkTo && (
          <footer className="auth-footer">
            <span>{footerText}</span>
            <Link to={footerLinkTo}>{footerLinkText}</Link>
          </footer>
        )}
      </div>
    </div>
  );
}
