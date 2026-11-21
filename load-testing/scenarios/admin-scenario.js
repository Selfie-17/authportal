import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';

/**
 * Scenario C — Realistic Administrator User Flow:
 * 1. Authenticate with admin credentials
 * 2. Fetch aggregated system statistics (/api/admin/stats)
 * 3. List managed users with role filtering (/api/admin/users?role=STUDENT)
 * 4. List all student submissions (/api/admin/submissions)
 * 5. Review feedback log registry (/api/admin/feedbacks)
 */
export function adminUserFlow(userCredentials) {
  // Step 1: Login
  const loginPayload = JSON.stringify({
    email: userCredentials.email,
    password: userCredentials.password,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: getHeaders(),
    tags: { name: 'Admin_Login' },
  });

  const loginSuccess = check(loginRes, {
    'admin login status is 200': (r) => r.status === 200,
    'admin received auth token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    return;
  }

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  sleep(1);

  // Step 2: System statistics
  const statsRes = http.get(`${BASE_URL}/api/admin/stats`, {
    headers: authHeaders,
    tags: { name: 'Admin_GetStats' },
  });

  check(statsRes, {
    'get system stats status is 200': (r) => r.status === 200,
    'system stats contains totals': (r) => r.json('totalUsers') !== undefined,
  });

  sleep(1);

  // Step 3: List users with student filter
  const usersRes = http.get(`${BASE_URL}/api/admin/users?role=STUDENT`, {
    headers: authHeaders,
    tags: { name: 'Admin_ListUsers' },
  });

  check(usersRes, {
    'list users status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 4: List submissions
  const subsRes = http.get(`${BASE_URL}/api/admin/submissions`, {
    headers: authHeaders,
    tags: { name: 'Admin_ListSubmissions' },
  });

  check(subsRes, {
    'list admin submissions status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 5: Review feedback records
  const feedbackRes = http.get(`${BASE_URL}/api/admin/feedbacks`, {
    headers: authHeaders,
    tags: { name: 'Admin_ListFeedbacks' },
  });

  check(feedbackRes, {
    'list feedbacks status is 200': (r) => r.status === 200,
  });

  sleep(2);
}
