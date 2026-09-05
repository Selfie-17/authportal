import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authService } from '../services/authService';

/**
 * Handles the secure OAuth2 callback flow.
 * Consumes the single-use authorization exchange code sent from the backend
 * and retrieves the application JWT in a secure POST body without leaking tokens in URLs.
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const exchangeAttemptedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const authError = searchParams.get('error');

    if (authError) {
      setError(decodeURIComponent(authError));
      setLoading(false);
      return;
    }

    if (!code) {
      setError('No authorization exchange code was provided. Please attempt to login again.');
      setLoading(false);
      return;
    }

    // In React 18/19 StrictMode, useEffect runs twice on mount in development.
    // Ensure the single-use exchange code is submitted strictly once.
    if (exchangeAttemptedRef.current) {
      return;
    }
    exchangeAttemptedRef.current = true;

    async function performExchange() {
      try {
        const authData = await authService.exchangeOAuthCode(code);
        authService.saveAuth(authData);

        const role = authData.user?.role;
        if (role === 'ADMIN') {
          navigate('/admin', { replace: true });
        } else if (role === 'TEACHER') {
          navigate('/teacher', { replace: true });
        } else {
          navigate('/student', { replace: true });
        }
      } catch (err) {
        setError(err.message || 'OAuth code exchange failed. The code may have expired.');
        setLoading(false);
      }
    }

    performExchange();

  }, [searchParams, navigate]);

  return (
    <div className="auth-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
      <div className="card-header">
        <h2 className="portal-title">Institutional Authentication</h2>
        <p className="portal-subtitle">Google OAuth2 Authorization Exchange</p>
      </div>

      {loading && (
        <div style={{ padding: '2.5rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Verifying institutional credentials and issuing session token...
          </p>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem 0' }}>
          <div className="alert alert-error" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Authentication Failed</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>{error}</p>
            </div>
          </div>
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-block', width: 'auto', padding: '0.75rem 2rem' }}>
            Return to Login
          </Link>
        </div>
      )}
    </div>
  );
}
