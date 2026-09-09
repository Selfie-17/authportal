import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import LoginForm from '../components/LoginForm';
import GoogleButton from '../components/GoogleButton';

/**
 * Login Page view integrating form, Google button, and institutional layout.
 */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('message') || (searchParams.get('error') ? 'Google authentication failed. Please verify your institutional account or contact administrator.' : null);

  return (
    <AuthLayout
      title="Sign in to your account"
      description="Enter your institutional credentials to continue"
      footerText="Don't have an account?"
      footerLinkText="Register here"
      footerLinkTo="/register"
    >
      {oauthError && (
        <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Authentication Failed</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>{oauthError}</p>
          </div>
        </div>
      )}
      <LoginForm />
      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton />
    </AuthLayout>
  );
}
