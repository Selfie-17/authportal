import { API_ENDPOINTS } from '../config/api';
import { authService } from './authService';

/**
 * Service managing profile and credential API operations.
 */
export const profileService = {
  /**
   * Fetches current authenticated user profile.
   */
  async getProfile() {
    const res = await fetch(API_ENDPOINTS.PROFILE, {
      headers: authService.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch profile.');
    }
    return res.json();
  },

  /**
   * Updates allowed profile attributes (name, avatar).
   */
  async updateProfile(profileData) {
    const res = await fetch(API_ENDPOINTS.PROFILE, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update profile.');
    }
    const updatedUser = await res.json();
    // Keep local storage synchronized
    const currentUser = authService.getUser();
    if (currentUser) {
      authService.setUser({ ...currentUser, ...updatedUser });
    }
    return updatedUser;
  },

  /**
   * Changes password for local email/password users.
   */
  async changePassword(passwordData) {
    const res = await fetch(API_ENDPOINTS.PROFILE_PASSWORD, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(passwordData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to change password.');
    }
    return res.json();
  },
};
