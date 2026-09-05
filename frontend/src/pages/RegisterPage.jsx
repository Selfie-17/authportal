import React from 'react';
import AuthLayout from '../components/AuthLayout';
import RegisterForm from '../components/RegisterForm';
import GoogleButton from '../components/GoogleButton';

/**
 * Register Page view integrating form, Google button, and institutional layout.
 * Role selection is strictly omitted as the backend handles role resolution.
 */
export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      description="Register using your institutional @rguktn.ac.in address"
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkTo="/login"
    >
      <RegisterForm />
      <div className="auth-divider">
        <span>or</span>
      </div>
      <GoogleButton />
    </AuthLayout>
  );
}
