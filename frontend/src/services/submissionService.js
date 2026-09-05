import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';

/**
 * Service managing Academic C-Program Submissions with Spring Boot REST API.
 */
export const submissionService = {
  /**
   * Helper to build authenticated headers.
   */
  getHeaders(isMultipart = false) {
    const token = authService.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isMultipart) {
      headers['Accept'] = 'application/json';
    }
    return headers;
  },

  /**
   * Derives default student ID from institutional email on server.
   */
  async getDefaultStudentId() {
    const response = await fetch(API_ENDPOINTS.DEFAULT_STUDENT_ID, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch default student ID.');
    }
    const data = await response.json();
    return data.studentId || '';
  },

  /**
   * Submits files and metadata.
   * @param {FormData} formData Contains studentId, week, year, section, and files
   */
  async submitAssignment(formData) {
    const response = await fetch(API_ENDPOINTS.SUBMISSIONS, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Submission failed.');
      error.status = response.status;
      error.code = data.code;
      error.errors = data.errors || null;
      throw error;
    }
    return data;
  },

  /**
   * Lists the authenticated student's submissions.
   */
  async getMySubmissions() {
    const response = await fetch(API_ENDPOINTS.SUBMISSIONS_MY, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to fetch submission history.');
    }
    return await response.json();
  },

  /**
   * Downloads an individual file from a submission.
   */
  async downloadFile(submissionId, fileId, originalFilename) {
    const url = `${API_ENDPOINTS.SUBMISSIONS}/${submissionId}/files/${fileId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to download file.');
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = originalFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  /**
   * Teacher filter query.
   */
  async filterTeacherSubmissions({ week, year, section, studentId } = {}) {
    const params = new URLSearchParams();
    if (week) params.append('week', week);
    if (year) params.append('year', year);
    if (section) params.append('section', section);
    if (studentId && studentId.trim()) params.append('studentId', studentId.trim());

    const url = `${API_ENDPOINTS.TEACHER_SUBMISSIONS}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load teacher submissions.');
    }
    return await response.json();
  },

  /**
   * Downloads teacher ZIP archive preserving student ID directories.
   */
  async downloadSubmissionsZip({ week, year, section }) {
    const params = new URLSearchParams();
    params.append('week', week);
    if (year) params.append('year', year);
    if (section) params.append('section', section);

    const url = `${API_ENDPOINTS.TEACHER_DOWNLOAD_ZIP}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to download submissions ZIP archive.');
    }

    // Extract filename from Content-Disposition header if available
    const disposition = response.headers.get('Content-Disposition');
    let filename = section ? `week-${week}-sec-${section}.zip` : `week-${week}.zip`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};
