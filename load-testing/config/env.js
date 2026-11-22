/**
 * Centralized environment configuration loader for k6 tests.
 * Resolves TARGET_ENV ('local', 'staging', 'production') and exposes base URLs,
 * timeouts, and safety guards.
 */

export const TARGET_ENV = __ENV.TARGET_ENV || 'local';
export const BASE_URL = __ENV.BASE_URL || (TARGET_ENV === 'staging' || TARGET_ENV === 'production' ? 'https://authportal-5gnm.onrender.com' : 'http://localhost:8080');

const configs = {
  local: {
    baseUrl: BASE_URL,
    timeout: '15s',
    allowMutations: true,
  },
  staging: {
    baseUrl: BASE_URL,
    timeout: '30s',
    allowMutations: false, // Prevents unintended data mutation on shared staging
  },
  production: {
    baseUrl: BASE_URL,
    timeout: '30s',
    allowMutations: false, // Strict safety guard
  }
};

export const currentConfig = configs[TARGET_ENV] || configs.local;

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
