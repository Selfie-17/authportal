import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';

/**
 * Service managing communication with the Gmail SMTP Email API endpoints.
 */
export const emailService = {
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
   * Checks whether Gmail SMTP credentials are configured on the backend.
   */
  async getStatus() {
    try {
      const response = await fetch(API_ENDPOINTS.EMAIL_STATUS, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Status check failed: HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn('Failed to retrieve Gmail SMTP email status:', err);
      return { configured: false, provider: 'GMAIL_SMTP', message: err.message };
    }
  },

  /**
   * Retrieves dashboard KPI metrics.
   */
  async getStatistics() {
    const response = await fetch(API_ENDPOINTS.EMAIL_STATISTICS, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to load email statistics: HTTP ${response.status}`);
    }
    return await response.json();
  },

  /**
   * Sends a generic email with subject, body, and attachments via Gmail SMTP.
   */
  async sendEmail(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_SEND, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Email failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Sends an evaluated student report (HTML, Gemini JSON, Ollama JSON, or all) via Gmail SMTP.
   */
  async sendStudentReport(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_SEND_STUDENT_REPORT, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Email transmission failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Sends a real test email via Gmail SMTP.
   */
  async sendTestReport(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_TEST_REPORT, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Test email failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Previews candidate recipients for a batch email operation.
   */
  async previewBatch(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_BATCH_PREVIEW, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Batch preview failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Triggers an asynchronous email batch send via Gmail SMTP.
   */
  async sendBatch(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_BATCH_SEND, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Batch send initiation failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Retrieves full history of individual email dispatches.
   */
  async getHistory() {
    const response = await fetch(API_ENDPOINTS.EMAIL_HISTORY, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to load email history: HTTP ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Retries an individual failed email delivery by its record ID.
   */
  async retryEmail(id) {
    const response = await fetch(API_ENDPOINTS.EMAIL_RETRY(id), {
      method: 'POST',
      headers: this.getHeaders(),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Retry failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Lists all past batch operations.
   */
  async getBatches() {
    const response = await fetch(API_ENDPOINTS.EMAIL_BATCHES, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to load email batches: HTTP ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Gets details and recipient outcomes for a specific batch.
   */
  async getBatchDetails(batchId) {
    const response = await fetch(API_ENDPOINTS.EMAIL_BATCH_DETAILS(batchId), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to load batch details: HTTP ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Retries all failed deliveries in a batch.
   */
  async retryBatch(batchId) {
    const response = await fetch(API_ENDPOINTS.EMAIL_BATCH_RETRY(batchId), {
      method: 'POST',
      headers: this.getHeaders(),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Batch retry failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Retrieves automation configurations.
   */
  async getAutomationConfig() {
    const response = await fetch(API_ENDPOINTS.EMAIL_AUTOMATION, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to load automation configuration: HTTP ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Saves automation configuration.
   */
  async saveAutomationConfig(payload) {
    const response = await fetch(API_ENDPOINTS.EMAIL_AUTOMATION, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Failed to save automation: HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Uploads and emails any arbitrary HTML file or JSON evaluation report directly to a recipient.
   */
  async sendCustomFileReport({ file, recipientEmail, subject, message }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipientEmail', recipientEmail);
    if (subject) formData.append('subject', subject);
    if (message) formData.append('message', message);

    const response = await fetch(API_ENDPOINTS.EMAIL_SEND_CUSTOM_FILE, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Custom file email failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Sends raw HTML or JSON content directly as an attached document.
   */
  async sendRawReport({ recipientEmail, subject, filename, content, message }) {
    const response = await fetch(API_ENDPOINTS.EMAIL_SEND_RAW, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ recipientEmail, subject, filename, content, message }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Raw report email failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },

  /**
   * Analyzes an uploaded ZIP archive or local path containing student HTML evaluation reports.
   * Accepts FormData (with file) or a payload object { filePath: '...' }.
   */
  async parseZipReports(input) {
    let headers;
    let body;

    if (input instanceof FormData) {
      headers = this.getHeaders(true);
      body = input;
    } else {
      headers = this.getHeaders(false);
      body = JSON.stringify(input || {});
    }

    const response = await fetch(API_ENDPOINTS.EMAIL_REPORTS_ZIP_PARSE, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMsg = data?.errorMessage || data?.message || `Failed to analyze ZIP: HTTP ${response.status}`;
      throw new Error(errorMsg);
    }
    return data;
  },

  /**
   * Sends student HTML reports extracted from a ZIP archive directly via Gmail SMTP.
   * Accepts FormData containing file, year, week, section, facultyMessage, targetOverrideEmail, selectedStudentIds.
   */
  async sendZipReports(formData) {
    const response = await fetch(API_ENDPOINTS.EMAIL_REPORTS_ZIP_SEND, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMsg = data?.message || data?.errorMessage || `Failed to dispatch ZIP reports: HTTP ${response.status}`;
      throw new Error(errorMsg);
    }
    return data;
  },

  /**
   * Retrieves Google OAuth consent URL for Gmail REST API (Port 443 HTTPS).
   */
  async getOAuthConnectUrl(redirectUri) {
    const response = await fetch(API_ENDPOINTS.EMAIL_OAUTH_CONNECT_URL(redirectUri), {
      method: 'GET',
      headers: this.getHeaders(false),
    });
    if (!response.ok) {
      throw new Error(`Failed to generate Gmail OAuth URL: HTTP ${response.status}`);
    }
    return await response.json();
  },

  /**
   * Exchanges authorization code for persistent Gmail API refresh token.
   */
  async exchangeOAuthCode(code, redirectUri) {
    const response = await fetch(API_ENDPOINTS.EMAIL_OAUTH_EXCHANGE_CODE, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ code, redirectUri }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `Failed to authorize Gmail: HTTP ${response.status}`);
    }
    return data;
  },

  /**
   * Checks Gmail REST API OAuth status.
   */
  async getOAuthStatus() {
    try {
      const response = await fetch(API_ENDPOINTS.EMAIL_OAUTH_STATUS, {
        method: 'GET',
        headers: this.getHeaders(false),
      });
      if (!response.ok) return { configured: false };
      return await response.json();
    } catch {
      return { configured: false };
    }
  },
};
