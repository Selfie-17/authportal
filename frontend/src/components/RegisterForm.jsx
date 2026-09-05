import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from './InputField';
import { authService } from '../services/authService';

/**
 * Registration form component connected to POST /api/auth/register.
 * CRITICAL: Strictly contains NO role selection dropdown.
 * Roles (STUDENT, TEACHER, ADMIN) are determined exclusively server-side.
 */
export default function RegisterForm() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear errors when the user edits
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Institutional email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await authService.register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      const assignedRole = response.user?.role || 'User';
      setSuccessMessage(
        `Account created successfully as ${assignedRole}! Redirecting to login...`
      );

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });

      // Redirect to login after brief success notification
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      // Map server validation errors to individual fields if available
      if (err.errors && typeof err.errors === 'object') {
        setErrors((prev) => ({
          ...prev,
          ...err.errors,
        }));
      }

      if (err.code === 'USER_ALREADY_EXISTS') {
        setErrors((prev) => ({
          ...prev,
          email: err.message || 'This email is already registered.',
        }));
      } else if (err.code === 'INVALID_INSTITUTIONAL_EMAIL') {
        setErrors((prev) => ({
          ...prev,
          email: err.message,
        }));
      }

      setGeneralError(err.message || 'Registration failed. Please try again.');
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
        label="Full Name"
        id="register-name"
        name="name"
        type="text"
        value={formData.name}
        onChange={handleChange}
        placeholder="e.g., John"
        error={errors.name}
        required
        disabled={isLoading}
        autoComplete="name"
      />

      <InputField
        label="Institutional Email"
        id="register-email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="e.g., n260001@rguktn.ac.in"
        helperText="Students use N/n + 6 digits (e.g., N210001@rguktn.ac.in)"
        error={errors.email}
        required
        disabled={isLoading}
        autoComplete="email"
      />

      <InputField
        label="Password"
        id="register-password"
        name="password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Minimum 8 characters"
        error={errors.password}
        required
        disabled={isLoading}
        autoComplete="new-password"
      />

      <InputField
        label="Confirm Password"
        id="register-confirm-password"
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Re-enter password"
        error={errors.confirmPassword}
        required
        disabled={isLoading}
        autoComplete="new-password"
      />

      <button
        type="submit"
        className="btn-primary"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Creating Account...</span>
          </>
        ) : (
          <span>Create Account</span>
        )}
      </button>
    </form>
  );
}
