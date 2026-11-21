import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';

/**
 * Scenario B — Realistic Teacher User Flow:
 * 1. Authenticate with faculty credentials
 * 2. Retrieve paginated submissions console (/api/teacher/submissions-page?page=0&size=20)
 * 3. Access dynamic evaluation grid (/api/teacher/evaluations/grid)
 * 4. Retrieve single-student detailed evaluation report (/api/teacher/evaluations/report)
 * 5. Query teacher-filtered submissions (/api/submissions/teacher?week=1&section=1)
 * 6. Check email subsystem connectivity status (/api/email/status)
 */
export function teacherUserFlow(userCredentials) {
  // Step 1: Login
  const loginPayload = JSON.stringify({
    email: userCredentials.email,
    password: userCredentials.password,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: getHeaders(),
    tags: { name: 'Teacher_Login' },
  });

  const loginSuccess = check(loginRes, {
    'teacher login status is 200': (r) => r.status === 200,
    'teacher received auth token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    return;
  }

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  sleep(1);

  // Step 2: Retrieve paginated submissions console
  const pageRes = http.get(`${BASE_URL}/api/teacher/submissions-page?page=0&size=20`, {
    headers: authHeaders,
    tags: { name: 'Teacher_GetSubmissionsPage' },
  });

  check(pageRes, {
    'get teacher submissions page status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 3: Access dynamic evaluation grid
  const gridRes = http.get(`${BASE_URL}/api/teacher/evaluations/grid`, {
    headers: authHeaders,
    tags: { name: 'Teacher_GetEvaluationGrid' },
  });

  check(gridRes, {
    'get evaluation grid status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 4: Retrieve single-student detailed report
  const reportRes = http.get(`${BASE_URL}/api/teacher/evaluations/report?studentId=B201001&week=1`, {
    headers: authHeaders,
    tags: { name: 'Teacher_GetStudentReport' },
  });

  check(reportRes, {
    'get student report status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);

  // Step 5: Filter submissions across week & section
  const filterRes = http.get(`${BASE_URL}/api/submissions/teacher?week=1&section=1`, {
    headers: authHeaders,
    tags: { name: 'Teacher_FilterSubmissions' },
  });

  check(filterRes, {
    'filter submissions status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Step 6: Verify email status
  const emailRes = http.get(`${BASE_URL}/api/email/status`, {
    headers: authHeaders,
    tags: { name: 'Teacher_GetEmailStatus' },
  });

  check(emailRes, {
    'get email status is 200': (r) => r.status === 200,
  });

  sleep(2);
}
