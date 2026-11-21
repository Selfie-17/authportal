import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/authService';
import './styles/index.css';
import './styles/auth.css';
import './styles/portal.css';

// Route-level code splitting: lazy load pages on demand
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const StudentSubmissionPage = lazy(() => import('./pages/StudentSubmissionPage'));
const TeacherSubmissionsPage = lazy(() => import('./pages/TeacherSubmissionsPage'));
const TeacherFeedbackPage = lazy(() => import('./pages/TeacherFeedbackPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EmailReportsPage = lazy(() => import('./pages/EmailReportsPage'));
const EmailTestsPage = lazy(() => import('./pages/EmailTestsPage'));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));
const GmailOAuthCallbackPage = lazy(() => import('./pages/GmailOAuthCallbackPage'));

/**
 * Lightweight accessible page fallback during route transitions.
 */
function PageLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⏳</div>
        <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>Loading page...</p>
      </div>
    </div>
  );
}

/**
 * Route protection wrapper verifying JWT authentication and optional role access.
 */
function ProtectedRoute({ children, allowedRoles }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = authService.getAuthUser();
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    // If unauthorized for this specific view, redirect to their primary role page
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />;
    return <Navigate to="/student" replace />;
  }

  return children;
}

/**
 * Directs authenticated users to their corresponding dashboard upon visiting root.
 */
function RootRedirect() {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  const user = authService.getAuthUser();
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user?.role === 'TEACHER') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}

/**
 * Root Application component configuring client-side routing.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/oauth2/callback" element={<OAuthCallbackPage />} />

          {/* Student Portal */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN']}>
                <StudentSubmissionPage />
              </ProtectedRoute>
            }
          />

          {/* Teacher Portal */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <TeacherSubmissionsPage />
              </ProtectedRoute>
            }
          />

          {/* Student Feedback & PDF Review Page */}
          <Route
            path="/teacher/feedback"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <TeacherFeedbackPage />
              </ProtectedRoute>
            }
          />

          {/* Email Reports Distribution Center */}
          <Route
            path="/email-reports"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <EmailReportsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/email_reports" element={<Navigate to="/email-reports" replace />} />

          {/* Email Testing Center */}
          <Route
            path="/email-tests"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <EmailTestsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/email_tests" element={<Navigate to="/email-tests" replace />} />
          <Route path="/oauth/gmail-callback" element={<GmailOAuthCallbackPage />} />

          {/* Admin Console */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* User Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
