/**
 * API Configuration
 * Reads the backend base URL from Vite environment variables.
 * In development, defaults to http://localhost:8080.
 * In production, configured via VITE_API_BASE_URL.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export const API_ENDPOINTS = {
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  ME: `${API_BASE_URL}/api/auth/me`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  OAUTH2_EXCHANGE: `${API_BASE_URL}/api/auth/oauth2/exchange`,
  GOOGLE_AUTH: `${API_BASE_URL}/oauth2/authorization/google`,
  SUBMISSIONS: `${API_BASE_URL}/api/submissions`,
  SUBMISSIONS_MY: `${API_BASE_URL}/api/submissions/my`,
  DEFAULT_STUDENT_ID: `${API_BASE_URL}/api/submissions/default-student-id`,
  TEACHER_SUBMISSIONS: `${API_BASE_URL}/api/submissions/teacher`,
  TEACHER_DOWNLOAD_ZIP: `${API_BASE_URL}/api/submissions/teacher/download-zip`,
  // Admin endpoints
  ADMIN_STATS: `${API_BASE_URL}/api/admin/stats`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_USER_ROLE: (id) => `${API_BASE_URL}/api/admin/users/${id}/role`,
  ADMIN_USER_STATUS: (id) => `${API_BASE_URL}/api/admin/users/${id}/status`,
  ADMIN_SUBMISSIONS: `${API_BASE_URL}/api/admin/submissions`,
  ADMIN_SUBMISSION_DELETE: (id) => `${API_BASE_URL}/api/admin/submissions/${id}`,
  // Profile endpoints
  PROFILE: `${API_BASE_URL}/api/profile`,
  PROFILE_PASSWORD: `${API_BASE_URL}/api/profile/change-password`,
  // Teacher Evaluation Table endpoints
  TEACHER_EVALUATIONS_UPLOAD: `${API_BASE_URL}/api/teacher/evaluations/upload`,
  TEACHER_EVALUATIONS_UPLOAD_JSON: `${API_BASE_URL}/api/teacher/evaluations/upload-json`,
  TEACHER_EVALUATIONS_GRID: `${API_BASE_URL}/api/teacher/evaluations/grid`,
  TEACHER_EVALUATIONS_REPORT: `${API_BASE_URL}/api/teacher/evaluations/report`,
  TEACHER_EVALUATIONS_FEEDBACK: `${API_BASE_URL}/api/teacher/evaluations/feedback`,
};


