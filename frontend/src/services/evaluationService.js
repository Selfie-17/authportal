import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';

/**
 * Service managing Teacher Evaluation Spreadsheet Table, JSON uploads,
 * single-student evaluation reports, and persistent teacher feedback.
 */
export const evaluationService = {
  /**
   * Builds authenticated request headers.
   */
  getHeaders(isMultipart = false) {
    const token = authService.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isMultipart) {
      headers['Accept'] = 'application/json';
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  },

  /**
   * Fetches the dynamic evaluation table grid:
   * Dynamic weeks, dynamic student rows, and compact score summaries.
   */
  async getGrid() {
    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_GRID, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load evaluation table grid.');
    }
    return await response.json();
  },

  /**
   * Uploads an evaluation JSON file (multipart/form-data).
   */
  async uploadJsonFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const token = authService.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_UPLOAD, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload and process evaluation JSON file.');
    }
    return data;
  },

  /**
   * Uploads raw JSON string directly.
   */
  async uploadJsonString(jsonString) {
    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_UPLOAD_JSON, {
      method: 'POST',
      headers: this.getHeaders(),
      body: jsonString,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to process evaluation JSON data.');
    }
    return data;
  },

  /**
   * Fetches the detailed single-student report for a specific Student ID and Week.
   */
  async getStudentReport(studentId, week) {
    const params = new URLSearchParams({ studentId, week });
    const url = `${API_ENDPOINTS.TEACHER_EVALUATIONS_REPORT}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Failed to load evaluation report for ${studentId} (${week}).`);
    }
    return await response.json();
  },

  /**
   * Saves or updates teacher feedback (reviewed Yes/No, feedback text) for Student ID + Week.
   */
  async saveFeedback({ studentId, week, reviewed, feedbackText }) {
    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_FEEDBACK, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ studentId, week, reviewed, feedbackText }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to save teacher feedback.');
    }
    return data;
  },
};
