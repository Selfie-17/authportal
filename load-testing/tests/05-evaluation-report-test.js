import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { standardThresholds } from '../config/thresholds.js';

const users = JSON.parse(open('../data/users.json'));

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // 10 faculty users querying evaluations
    { duration: '30s', target: 25 }, // 25 concurrent teachers
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: standardThresholds,
};

export default function () {
  const teacher = users.teachers[__VU % users.teachers.length];

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: teacher.email,
    password: teacher.password,
  }), {
    headers: getHeaders(),
    tags: { name: 'Eval_Login' },
  });

  if (loginRes.status !== 200) return;

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  // 1. Fetch dynamic grid
  const gridRes = http.get(`${BASE_URL}/api/teacher/evaluations/grid`, {
    headers: authHeaders,
    tags: { name: 'Eval_Grid' },
  });

  check(gridRes, { 'grid status 200': (r) => r.status === 200 });

  sleep(1);

  // 2. Fetch single student report
  const reportRes = http.get(`${BASE_URL}/api/teacher/evaluations/report?studentId=B201001&week=1`, {
    headers: authHeaders,
    tags: { name: 'Eval_SingleReport' },
  });

  check(reportRes, { 'report status valid': (r) => r.status === 200 || r.status === 404 });

  sleep(1);

  // 3. Paginated submission search
  const pageRes = http.get(`${BASE_URL}/api/teacher/submissions-page?page=0&size=20&week=1`, {
    headers: authHeaders,
    tags: { name: 'Eval_SubmissionsPage' },
  });

  check(pageRes, { 'submissions page status 200': (r) => r.status === 200 });

  sleep(2);
}
