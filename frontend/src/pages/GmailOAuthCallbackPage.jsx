import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { emailService } from '../services/emailService';
import '../styles/portal.css';

/**
 * Handles the Google OAuth callback specifically for authorizing Gmail REST API
 * over HTTPS (Port 443). Exchanges the authorization code for a persistent refresh
 * token that completely solves Render Free Tier outbound SMTP port restrictions.
 */
export default function GmailOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState('');
  const exchangeAttemptedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const authError = searchParams.get('error');

    if (authError) {
      setError(`Google authorization was cancelled or denied: ${authError}`);
      return;
    }

    if (!code) {
      setError('No authorization code was returned by Google.');
      return;
    }

    if (exchangeAttemptedRef.current) return;
    exchangeAttemptedRef.current = true;

    async function authorizeGmail() {
      try {
        const redirectUri = `${window.location.origin}/oauth/gmail-callback`;
        const res = await emailService.exchangeOAuthCode(code, redirectUri);
        setSuccess(true);
        setConnectedEmail(res.connectedEmail || 'Gmail Account');
        setTimeout(() => {
          navigate('/email-reports', { replace: true });
        }, 2200);
      } catch (err) {
        setError(err.message || 'Failed to exchange authorization code for Gmail API token.');
      }
    }

    authorizeGmail();
  }, [searchParams, navigate]);

  return (
    <div className="portal-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div className="email-composer-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
        {error ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.75rem' }}>
              Gmail Authorization Failed
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {error}
            </p>
            <Link to="/email-reports" className="btn-primary" style={{ textDecoration: 'none' }}>
              Return to Email Reports
            </Link>
          </div>
        ) : success ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534', marginBottom: '0.5rem' }}>
              Gmail REST API Connected!
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600, marginBottom: '0.35rem' }}>
              {connectedEmail}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Emails will now dispatch directly over HTTPS (Port 443). 100% compatible with Render Free Tier! Redirecting...
            </p>
            <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto' }} />
          </div>
        ) : (
          <div>
            <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              Connecting Gmail Account...
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              Exchanging authorization code for persistent Gmail REST API credentials over HTTPS...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
