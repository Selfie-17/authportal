import React from 'react';
import AuthLayout from '../components/AuthLayout';
import LoginForm from '../components/LoginForm';
import GoogleButton from '../components/GoogleButton';

/**
 * Login Page view integrating form, Google button, and institutional layout.
 */
export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign in to your account"
      description="Enter your institutional credentials to continue"
      footerText="Don't have an account?"
      footerLinkText="Register here"
      footerLinkTo="/register"
    >
      <LoginForm />
      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton />
    </AuthLayout>
  );
}
