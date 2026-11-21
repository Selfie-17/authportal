import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { baselineThresholds } from '../config/thresholds.js';

export const options = {
  stages: [
    { duration: '15s', target: 5 },  // Warm-up to 5 VUs
    { duration: '30s', target: 5 },  // Hold steady at 5 VUs
    { duration: '15s', target: 0 },  // Ramp-down
  ],
  thresholds: baselineThresholds,
};

export default function () {
  // Public health endpoint check
  const healthRes = http.get(`${BASE_URL}/health`, {
    headers: getHeaders(),
    tags: { name: 'Baseline_Health' },
  });

  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
