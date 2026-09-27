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
   * Derives default student ID and profile metadata from the server.
   * Returns { studentId, branch, academicYear, section }
   */
  async getDefaultStudentId() {
    const response = await fetch(API_ENDPOINTS.DEFAULT_STUDENT_ID, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to fetch default student data.');
    }
    return response.json();
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
    const headers = this.getHeaders();
    headers['Accept'] = 'application/octet-stream, application/pdf, text/plain, */*';

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMsg = 'Failed to download file.';
      try {
        const data = await response.json();
        if (data && data.message) errorMsg = data.message;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = originalFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  },

  /**
   * Deletes a submission by ID.
   * @param {number|string} submissionId
   */
  async deleteSubmission(submissionId) {
    const url = `${API_ENDPOINTS.SUBMISSIONS}/${submissionId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Failed to delete submission.');
      error.status = response.status;
      throw error;
    }
    return data;
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
    const headers = this.getHeaders();
    headers['Accept'] = 'application/zip, application/octet-stream, */*';

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMsg = 'Failed to download submissions ZIP archive.';
      try {
        const data = await response.json();
        if (data && data.message) errorMsg = data.message;
      } catch (_) {}
      throw new Error(errorMsg);
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
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  },

  /**
   * Fetches paginated student submissions with PDF metadata and teacher feedback.
   */
  async getPaginatedSubmissions({ page = 0, size = 20, week, search } = {}) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('size', size);
    if (week && week !== 'ALL' && week.trim() !== '') params.append('week', week);
    if (search && search.trim() !== '') params.append('search', search.trim());

    const url = `${API_ENDPOINTS.TEACHER_SUBMISSIONS_PAGE}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Failed to load paginated submissions.');
    }
    return await response.json();
  },

  /**
   * Streams an authenticated PDF file and opens it in a new browser tab.
   * If popup blockers interfere, falls back to direct blob navigation.
   */
  async openSubmissionPdfInNewTab(submissionId, fileId, filename) {
    if (!submissionId || !fileId) {
      throw new Error('Submission ID and File ID are required to open PDF.');
    }

    // Open target tab immediately during user click event to prevent browser popup blockers
    const newTab = window.open('about:blank', '_blank');
    if (newTab) {
      newTab.document.write(
        `<!DOCTYPE html><html><head><title>Loading ${filename || 'PDF'}...</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155;}</style></head><body><div style="text-align:center;"><div style="font-size:2.5rem;margin-bottom:1rem;">📄</div><h3 style="margin:0 0 0.5rem;">Loading Student PDF Report...</h3><p style="color:#64748b;font-size:0.9rem;margin:0;">Streaming securely from storage...</p></div></body></html>`
      );
    }

    try {
      const url = API_ENDPOINTS.SUBMISSION_FILE_STREAM(submissionId, fileId);
      const headers = this.getHeaders();
      headers['Accept'] = 'application/pdf, */*';

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let msg = 'Failed to load student PDF.';
        try {
          const errData = await response.json();
          if (errData && errData.message) msg = errData.message;
        } catch (_) {}
        throw new Error(msg);
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);

      if (newTab && !newTab.closed) {
        newTab.location.href = blobUrl;
      } else {
        window.open(blobUrl, '_blank');
      }

      // Cleanup object URL after tab has loaded
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }, 60000);
    } catch (err) {
      if (newTab && !newTab.closed) {
        newTab.document.body.innerHTML = `<div style="text-align:center;padding:2rem;font-family:system-ui,sans-serif;color:#dc2626;"><h3>Failed to Load PDF</h3><p>${err.message}</p></div>`;
      }
      throw err;
    }
  },
};
