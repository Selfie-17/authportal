import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { standardThresholds } from '../config/thresholds.js';

const users = JSON.parse(open('../data/users.json'));

export const options = {
  stages: [
    { duration: '20s', target: 20 }, // 20 concurrent students hitting dashboard
    { duration: '40s', target: 40 }, // 40 concurrent students
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: standardThresholds,
};

export default function () {
  const student = users.students[__VU % users.students.length];

  // Login once per iteration
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: student.email,
    password: student.password,
  }), {
    headers: getHeaders(),
    tags: { name: 'Dashboard_Login' },
  });

  if (loginRes.status !== 200) return;

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  // Parallel-like batch fetches representing student dashboard opening
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/profile`, null, { headers: authHeaders, tags: { name: 'Dashboard_Profile' } }],
    ['GET', `${BASE_URL}/api/submissions/my`, null, { headers: authHeaders, tags: { name: 'Dashboard_MySubmissions' } }],
    ['GET', `${BASE_URL}/api/submissions/default-student-id`, null, { headers: authHeaders, tags: { name: 'Dashboard_Meta' } }],
  ]);

  check(responses[0], { 'profile status 200': (r) => r.status === 200 });
  check(responses[1], { 'submissions status 200': (r) => r.status === 200 });
  check(responses[2], { 'metadata status 200': (r) => r.status === 200 });

  sleep(2);
}
