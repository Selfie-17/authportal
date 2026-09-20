import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';
import { reportCache } from './cache/reportCache';
import { pdfCache } from './cache/pdfCache';
import { gridCache } from './cache/gridCache';

// In-flight request deduplication map to prevent parallel duplicate GET requests
const pendingRequests = new Map();

/**
 * Service managing Teacher Evaluation Spreadsheet Table, JSON uploads,
 * single-student evaluation reports, and persistent teacher feedback.
 * Supports multi-provider AI evaluations (Gemini, Ollama), client-side memoization,
 * and instant 0ms report/PDF switching.
 */
export const evaluationService = {
  // Re-export cache instances for explicit invalidation when needed
  reportCache,
  pdfCache,
  gridCache,

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
   * Utilizes Stale-While-Revalidate caching for instant tab transitions.
   */
  async getGrid(forceRefresh = false) {
    if (!forceRefresh && gridCache.has()) {
      return gridCache.get();
    }

    const cacheKey = 'grid';
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_GRID, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load evaluation table grid.');
        }
        const data = await response.json();
        gridCache.set(data);
        return data;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  /**
   * Uploads an evaluation JSON file (multipart/form-data) with optional provider.
   */
  async uploadJsonFile(file, provider = null) {
    const formData = new FormData();
    formData.append('file', file);

    const token = authService.getAuthToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let url = API_ENDPOINTS.TEACHER_EVALUATIONS_UPLOAD;
    if (provider) {
      url += `?provider=${encodeURIComponent(provider)}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload and process evaluation JSON file.');
    }
    // Invalidate grid and report caches on new upload
    gridCache.invalidate();
    reportCache.clear();
    return data;
  },

  /**
   * Uploads raw JSON string directly with optional provider.
   */
  async uploadJsonString(jsonString, provider = null) {
    let url = API_ENDPOINTS.TEACHER_EVALUATIONS_UPLOAD_JSON;
    if (provider) {
      url += `?provider=${encodeURIComponent(provider)}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: jsonString,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to process evaluation JSON data.');
    }
    // Invalidate grid and report caches on new upload
    gridCache.invalidate();
    reportCache.clear();
    return data;
  },

  /**
   * Fetches the detailed multi-provider student report for a specific Student ID, Week, and optional Provider.
   * Caches response in memory so switching between Gemini & Ollama takes 0ms with zero network requests.
   */
  async getStudentReport(studentId, week, provider = null, forceRefresh = false) {
    if (!studentId || !week) {
      throw new Error('Student ID and week are required.');
    }

    const normId = studentId.trim().toUpperCase();
    const normWeek = week.trim();

    // 1. Check in-memory report cache (0ms instant return)
    if (!forceRefresh && reportCache.has(normId, normWeek)) {
      const cached = reportCache.get(normId, normWeek);
      if (provider && cached.reports && cached.reports[provider.toLowerCase()]) {
        return {
          ...cached.reports[provider.toLowerCase()],
          reports: cached.reports,
          availableProviders: cached.availableProviders || Object.keys(cached.reports),
        };
      }
      return cached;
    }

    // 2. Request deduplication
    const reqKey = `report:${normId}:${normWeek.toLowerCase()}`;
    if (pendingRequests.has(reqKey)) {
      return pendingRequests.get(reqKey);
    }

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams({ studentId: normId, week: normWeek });
        if (provider) {
          params.append('provider', provider);
        }
        const url = `${API_ENDPOINTS.TEACHER_EVALUATIONS_REPORT}?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || `Failed to load evaluation report for ${studentId} (${week}).`);
        }
        const data = await response.json();

        // Cache the multi-provider response
        reportCache.set(normId, normWeek, data);
        return data;
      } finally {
        pendingRequests.delete(reqKey);
      }
    })();

    pendingRequests.set(reqKey, fetchPromise);
    return fetchPromise;
  },

  /**
   * Saves or updates teacher feedback (reviewed Yes/No, feedback text, optional score & sections) for Student ID + Week.
   */
  async saveFeedback(payload) {
    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_FEEDBACK, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to save teacher feedback.');
    }

    // Update in-memory cache with new feedback state
    if (payload.studentId && payload.week && reportCache.has(payload.studentId, payload.week)) {
      const cached = reportCache.get(payload.studentId, payload.week);
      cached.reviewed = payload.reviewed;
      cached.feedbackText = payload.feedbackText;
      if (cached.reports) {
        Object.values(cached.reports).forEach((r) => {
          r.reviewed = payload.reviewed;
          r.feedbackText = payload.feedbackText;
        });
      }
      reportCache.set(payload.studentId, payload.week, cached);
    }

    return data;
  },

  /**
   * Updates the final awarded score and section-by-section breakdown for a student's evaluation report.
   */
  async updateScore(payload) {
    const response = await fetch(API_ENDPOINTS.TEACHER_EVALUATIONS_SCORE, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update marks.');
    }

    // Invalidate grid cache so table updates on next review
    gridCache.invalidate();

    return data;
  },

  /**
   * Deletes a student's evaluation report for a specific week (optionally provider-scoped), or all reports if week is omitted.
   */
  async deleteStudentReport(studentId, week, provider = null) {
    const params = new URLSearchParams({ studentId });
    if (week) params.append('week', week);
    if (provider) params.append('provider', provider);
    const url = `${API_ENDPOINTS.TEACHER_EVALUATIONS_REPORT}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Failed to delete evaluation report for ${studentId}.`);
    }

    // Invalidate caches
    if (studentId && week) {
      reportCache.invalidate(studentId, week);
      pdfCache.revoke(studentId, week);
    } else {
      reportCache.clear();
      pdfCache.clear();
    }
    gridCache.invalidate();

    return await response.json();
  },

  /**
   * Fetches the student's uploaded PDF report as both a secure Blob URL and Uint8Array data.
   * Memoizes in pdfCache to completely eliminate repeated multi-MB downloads from cloud storage.
   */
  async getStudentPdfData(studentId, week, forceRefresh = false) {
    const normId = (studentId || '').trim().toUpperCase();
    const normWeek = (week || '').trim();

    // 1. Check in-memory PDF cache
    if (!forceRefresh && pdfCache.has(normId, normWeek)) {
      const cached = pdfCache.get(normId, normWeek);
      if (cached && (cached.blobUrl || typeof cached === 'string')) {
        return typeof cached === 'string'
          ? { blobUrl: cached, uint8Array: null }
          : cached;
      }
    }

    // 2. Request deduplication
    const pdfKey = `pdf:${normId}:${normWeek.toLowerCase()}`;
    if (pendingRequests.has(pdfKey)) {
      return pendingRequests.get(pdfKey);
    }

    const fetchPromise = (async () => {
      try {
        const url = API_ENDPOINTS.TEACHER_EVALUATIONS_PDF(normId, normWeek);
        const headers = this.getHeaders();
        headers['Accept'] = 'application/pdf, */*';

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          let errorMsg = `PDF not found for student ${normId} (${normWeek}).`;
          try {
            const data = await response.json();
            if (data && data.message) errorMsg = data.message;
          } catch (_) {}
          const error = new Error(errorMsg);
          error.status = response.status;
          throw error;
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        const uint8Array = new Uint8Array(arrayBuffer);

        const pdfData = {
          blobUrl,
          blob,
          uint8Array,
          arrayBuffer,
        };

        pdfCache.set(normId, normWeek, pdfData);
        return pdfData;
      } finally {
        pendingRequests.delete(pdfKey);
      }
    })();

    pendingRequests.set(pdfKey, fetchPromise);
    return fetchPromise;
  },

  /**
   * Fetches the student's uploaded PDF report as a secure Blob URL for inline viewing.
   */
  async getStudentPdfBlobUrl(studentId, week, forceRefresh = false) {
    const data = await this.getStudentPdfData(studentId, week, forceRefresh);
    return data.blobUrl;
  },

  /**
   * Downloads the student's uploaded PDF report.
   */
  async downloadStudentPdf(studentId, week, filename = 'observation_report.pdf') {
    const blobUrl = await this.getStudentPdfBlobUrl(studentId, week);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};
