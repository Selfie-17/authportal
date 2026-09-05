import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from './InputField';
import { authService } from '../services/authService';

/**
 * Login form component connected to POST /api/auth/login.
 * Saves JWT token in local storage upon successful authentication.
 */
export default function LoginForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setSuccessMessage('');

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Save token and user details according to backend architecture
      authService.saveAuth(response);

      const user = response.user;
      setSuccessMessage(
        `Signed in successfully! Redirecting...`
      );

      setTimeout(() => {
        if (user?.role === 'TEACHER') {
          navigate('/teacher');
        } else {
          navigate('/student');
        }
      }, 500);
    } catch (err) {
      if (err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
        setGeneralError('Invalid email or password. Please verify your credentials.');
      } else if (err.code === 'ACCOUNT_DISABLED') {
        setGeneralError('Your account has been deactivated. Please contact an administrator.');
      } else {
        setGeneralError(err.message || 'Login failed. Please try again.');
      }

      if (err.errors && typeof err.errors === 'object') {
        setErrors((prev) => ({
          ...prev,
          ...err.errors,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      {/* General Error Alert */}
      {generalError && (
        <div className="alert-error" role="alert">
          <span className="notice-icon" aria-hidden="true">⚠️</span>
          <span>{generalError}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="alert-success" role="status">
          <span className="notice-icon" aria-hidden="true">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      <InputField
        label="Institutional Email"
        id="login-email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="e.g., n260001@rguktn.ac.in"
        helperText="Students use N/n + 6 digits (e.g., N210921@rguktn.ac.in)"
        error={errors.email}
        required
        disabled={isLoading}
        autoComplete="email"
      />

      <InputField
        label="Password"
        id="login-password"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="••••••••"
        error={errors.password}
        required
        disabled={isLoading}
        autoComplete="current-password"
      />

      <button
        type="submit"
        className="btn-primary"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Signing In...</span>
          </>
        ) : (
          <span>Sign In</span>
        )}
      </button>
    </form>
  );
}
