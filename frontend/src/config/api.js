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
  TEACHER_SUBMISSIONS_PAGE: `${API_BASE_URL}/api/teacher/submissions-page`,
  TEACHER_DOWNLOAD_ZIP: `${API_BASE_URL}/api/submissions/teacher/download-zip`,
  SUBMISSION_FILE_STREAM: (submissionId, fileId) =>
    `${API_BASE_URL}/api/submissions/${submissionId}/files/${fileId}?inline=true`,
  // Admin endpoints
  ADMIN_STATS: `${API_BASE_URL}/api/admin/stats`,
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_USER_ROLE: (id) => `${API_BASE_URL}/api/admin/users/${id}/role`,
  ADMIN_USER_STATUS: (id) => `${API_BASE_URL}/api/admin/users/${id}/status`,
  ADMIN_SUBMISSIONS: `${API_BASE_URL}/api/admin/submissions`,
  ADMIN_SUBMISSION_DELETE: (id) => `${API_BASE_URL}/api/admin/submissions/${id}`,
  ADMIN_FEEDBACKS: `${API_BASE_URL}/api/admin/feedbacks`,
  ADMIN_FEEDBACK_DELETE: (id) => `${API_BASE_URL}/api/admin/feedbacks/${id}`,
  // Profile endpoints
  PROFILE: `${API_BASE_URL}/api/profile`,
  PROFILE_PASSWORD: `${API_BASE_URL}/api/profile/change-password`,
  // Teacher Evaluation Table endpoints
  TEACHER_EVALUATIONS_UPLOAD: `${API_BASE_URL}/api/teacher/evaluations/upload`,
  TEACHER_EVALUATIONS_UPLOAD_JSON: `${API_BASE_URL}/api/teacher/evaluations/upload-json`,
  TEACHER_EVALUATIONS_GRID: `${API_BASE_URL}/api/teacher/evaluations/grid`,
  TEACHER_EVALUATIONS_REPORT: `${API_BASE_URL}/api/teacher/evaluations/report`,
  TEACHER_EVALUATIONS_FEEDBACK: `${API_BASE_URL}/api/teacher/evaluations/feedback`,
  TEACHER_EVALUATIONS_SCORE: `${API_BASE_URL}/api/teacher/evaluations/score`,
  TEACHER_EVALUATIONS_PDF: (studentId, week) =>
    `${API_BASE_URL}/api/teacher/evaluations/pdf?studentId=${encodeURIComponent(studentId)}&week=${encodeURIComponent(week)}`,
  // Gmail SMTP Email Report endpoints
  EMAIL_STATUS: `${API_BASE_URL}/api/email/status`,
  EMAIL_SEND: `${API_BASE_URL}/api/email/send`,
  EMAIL_SEND_STUDENT_REPORT: `${API_BASE_URL}/api/email/send-student-report`,
  EMAIL_SEND_CUSTOM_FILE: `${API_BASE_URL}/api/email/send-custom-file`,
  EMAIL_SEND_RAW: `${API_BASE_URL}/api/email/send-raw`,
  EMAIL_TEST_REPORT: `${API_BASE_URL}/api/email/test-report`,
  EMAIL_BATCH_PREVIEW: `${API_BASE_URL}/api/email/batch/preview`,
  EMAIL_BATCH_SEND: `${API_BASE_URL}/api/email/send-batch`,
  EMAIL_HISTORY: `${API_BASE_URL}/api/email/history`,
  EMAIL_RETRY: (id) => `${API_BASE_URL}/api/email/retry/${id}`,
  EMAIL_BATCHES: `${API_BASE_URL}/api/email/batches`,
  EMAIL_BATCH_DETAILS: (id) => `${API_BASE_URL}/api/email/batches/${id}`,
  EMAIL_BATCH_RETRY: (id) => `${API_BASE_URL}/api/email/batches/${id}/retry`,
  EMAIL_STATISTICS: `${API_BASE_URL}/api/email/statistics`,
  EMAIL_AUTOMATION: `${API_BASE_URL}/api/email/automation`,
  EMAIL_PREVIEW: (week, studentId) =>
    `${API_BASE_URL}/api/email/preview/${encodeURIComponent(week)}/${encodeURIComponent(studentId)}`,
  EMAIL_REPORTS_ZIP_PARSE: `${API_BASE_URL}/api/email/reports-zip/parse`,
  EMAIL_REPORTS_ZIP_SEND: `${API_BASE_URL}/api/email/reports-zip/send`,
};


