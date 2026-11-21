import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { spikeThresholds } from '../config/thresholds.js';

const users = JSON.parse(open('../data/users.json'));

export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Normal baseline traffic
    { duration: '10s', target: 100 }, // Sudden sharp spike to 100 VUs
    { duration: '30s', target: 100 }, // Sustain spike load
    { duration: '10s', target: 5 },   // Immediate recovery to baseline
    { duration: '20s', target: 5 },   // Observe system recovery
    { duration: '10s', target: 0 },   // Cool down
  ],
  thresholds: spikeThresholds,
};

export default function () {
  // Rotate across student users
  const student = users.students[__VU % users.students.length];

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: student.email,
    password: student.password,
  }), {
    headers: getHeaders(),
    tags: { name: 'Spike_Login' },
  });

  const ok = check(loginRes, {
    'spike login responded': (r) => r.status === 200 || r.status === 429 || r.status === 503,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('token');
    const authHeaders = getHeaders(token);

    const subRes = http.get(`${BASE_URL}/api/submissions/my`, {
      headers: authHeaders,
      tags: { name: 'Spike_GetSubmissions' },
    });

    check(subRes, {
      'spike sub response valid': (r) => r.status === 200 || r.status === 500 || r.status === 503,
    });
  }

  sleep(1);
}
