import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import {
  durationStudentLogin,
  durationMetadata,
  durationSubmissions,
  durationProfile,
  durationRoleVerify,
} from '../config/metrics.js';

/**
 * Scenario A — Realistic Student User Flow:
 * 1. Authenticate with institutional credentials
 * 2. Fetch default student ID and academic metadata
 * 3. Fetch submission history list (/api/submissions/my)
 * 4. Fetch self profile details (/api/profile)
 * 5. Verify role access (/api/test/student)
 *
 * Each request records its execution latency into dedicated k6 Trend metrics
 * for precise per-endpoint diagnostic analysis.
 */
export function studentUserFlow(userCredentials) {
  // Step 1: Login
  const loginPayload = JSON.stringify({
    email: userCredentials.email,
    password: userCredentials.password,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: getHeaders(),
    tags: { name: 'Student_Login' },
  });

  durationStudentLogin.add(loginRes.timings.duration);

  const loginSuccess = check(loginRes, {
    'student login status is 200': (r) => r.status === 200,
    'student received auth token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    return;
  }

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  sleep(1);

  // Step 2: Get default student ID & academic metadata
  const metaRes = http.get(`${BASE_URL}/api/submissions/default-student-id`, {
    headers: authHeaders,
    tags: { name: 'Student_GetMetadata' },
  });

  durationMetadata.add(metaRes.timings.duration);

  check(metaRes, {
    'student metadata status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 3: Retrieve student's submissions history
  const subsRes = http.get(`${BASE_URL}/api/submissions/my`, {
    headers: authHeaders,
    tags: { name: 'Student_GetSubmissions' },
  });

  durationSubmissions.add(subsRes.timings.duration);

  check(subsRes, {
    'get student submissions status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 4: Retrieve profile details
  const profileRes = http.get(`${BASE_URL}/api/profile`, {
    headers: authHeaders,
    tags: { name: 'Student_GetProfile' },
  });

  durationProfile.add(profileRes.timings.duration);

  check(profileRes, {
    'get student profile status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 5: Verify role endpoint
  const testRes = http.get(`${BASE_URL}/api/test/student`, {
    headers: authHeaders,
    tags: { name: 'Student_VerifyRole' },
  });

  durationRoleVerify.add(testRes.timings.duration);

  check(testRes, {
    'verify student role status is 200': (r) => r.status === 200,
  });

  sleep(2);
}
