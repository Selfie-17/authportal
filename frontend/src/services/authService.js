import { API_ENDPOINTS } from '../config/api';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Authentication service handling communication with Spring Boot backend endpoints.
 */
export const authService = {
  /**
   * Register a new user with name, email, and password.
   * Note: Role is strictly determined server-side from institutional email.
   * @param {Object} credentials { name, email, password }
   * @returns {Promise<Object>} AuthResponse { token, tokenType, expiresIn, user }
   */
  async register({ name, email, password }) {
    try {
      const response = await fetch(API_ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || 'Registration failed');
        error.status = response.status;
        error.code = data.code;
        error.errors = data.errors || null;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Unable to connect to authentication server. Please verify the backend is running.');
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  },

  /**
   * Authenticate an existing user with email and password.
   * @param {Object} credentials { email, password }
   * @returns {Promise<Object>} AuthResponse { token, tokenType, expiresIn, user }
   */
  async login({ email, password }) {
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || 'Login failed');
        error.status = response.status;
        error.code = data.code;
        error.errors = data.errors || null;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Unable to connect to authentication server. Please verify the backend is running.');
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  },

  /**
   * Persist authenticated token and user profile in browser storage.
   * Aligns with backend stateless JWT architecture.
   */
  saveAuth(authResponse) {
    if (authResponse?.token) {
      localStorage.setItem(TOKEN_KEY, authResponse.token);
    }
    if (authResponse?.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    }
  },

  /**
   * Retrieve currently stored JWT token.
   */
  getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Retrieve currently stored user profile.
   */
  getAuthUser() {
    try {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Clear session upon logout.
   */
  clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Exchanges a single-use OAuth authorization code for an application JWT.
   * @param {string} code One-time authorization code
   * @returns {Promise<Object>} AuthResponse { token, tokenType, expiresIn, user }
   */
  async exchangeOAuthCode(code) {
    try {
      const response = await fetch(API_ENDPOINTS.OAUTH2_EXCHANGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || 'OAuth code exchange failed.');
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Unable to connect to authentication server. Please verify backend is running.');
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  },

  /**
   * Builds Authorization headers for authenticated requests.
   */
  getAuthHeaders() {
    const token = this.getAuthToken();
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  /**
   * Check if an active token exists.
   */
  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },

  /**
   * Alias for getAuthUser.
   */
  getUser() {
    return this.getAuthUser();
  },

  /**
   * Updates stored user profile in local storage.
   */
  setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
};

