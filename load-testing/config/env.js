/**
 * Centralized environment configuration loader for k6 tests.
 * Resolves TARGET_ENV ('local', 'staging', 'production') and exposes base URLs,
 * timeouts, and safety guards.
 */

export const TARGET_ENV = __ENV.TARGET_ENV || 'local';

const configs = {
  local: {
    baseUrl: __ENV.BASE_URL || 'http://localhost:8080',
    timeout: '15s',
    allowMutations: true,
  },
  staging: {
    baseUrl: __ENV.BASE_URL || 'https://authportal-backend.onrender.com',
    timeout: '30s',
    allowMutations: false, // Prevents unintended data mutation on shared staging
  },
  production: {
    baseUrl: __ENV.BASE_URL || 'https://authportal-backend.onrender.com',
    timeout: '30s',
    allowMutations: false, // Strict safety guard
  }
};

export const currentConfig = configs[TARGET_ENV] || configs.local;
export const BASE_URL = currentConfig.baseUrl;

export function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
