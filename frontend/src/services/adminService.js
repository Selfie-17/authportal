import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';

/**
 * Service handling administrator API operations.
 */
export const adminService = {
  /**
   * Fetches aggregate system metrics.
   */
  async getStats() {
    const res = await fetch(API_ENDPOINTS.ADMIN_STATS, {
      headers: authService.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch admin stats.');
    }
    return res.json();
  },

  /**
   * Fetches system users with optional search and role filter.
   */
  async getUsers(params = {}) {
    const url = new URL(API_ENDPOINTS.ADMIN_USERS);
    if (params.query) url.searchParams.set('query', params.query);
    if (params.role) url.searchParams.set('role', params.role);

    const res = await fetch(url.toString(), {
      headers: authService.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch users.');
    }
    return res.json();
  },

  /**
   * Provisions a new user.
   */
  async createUser(userData) {
    const res = await fetch(API_ENDPOINTS.ADMIN_USERS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create user.');
    }
    return res.json();
  },

  /**
   * Updates a user's system role.
   */
  async updateRole(userId, role) {
    const res = await fetch(API_ENDPOINTS.ADMIN_USER_ROLE(userId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update user role.');
    }
    return res.json();
  },

  /**
   * Updates a user's enabled status.
   */
  async updateStatus(userId, enabled) {
    const res = await fetch(API_ENDPOINTS.ADMIN_USER_STATUS(userId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update user status.');
    }
    return res.json();
  },

  /**
   * Fetches all submissions with optional filters.
   */
  async getSubmissions(params = {}) {
    const url = new URL(API_ENDPOINTS.ADMIN_SUBMISSIONS);
    if (params.week) url.searchParams.set('week', params.week);
    if (params.year) url.searchParams.set('year', params.year);
    if (params.section) url.searchParams.set('section', params.section);
    if (params.studentId) url.searchParams.set('studentId', params.studentId);

    const res = await fetch(url.toString(), {
      headers: authService.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch submissions.');
    }
    return res.json();
  },

  /**
   * Deletes a submission and purges its stored files.
   */
  async deleteSubmission(id) {
    const res = await fetch(API_ENDPOINTS.ADMIN_SUBMISSION_DELETE(id), {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to delete submission.');
    }
    return res.json();
  },
};
