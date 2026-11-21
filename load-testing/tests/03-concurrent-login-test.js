import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { standardThresholds } from '../config/thresholds.js';

// Load generated user dataset
const users = JSON.parse(open('../data/users.json'));

/**
 * Concurrent Login Test (03-concurrent-login-test.js):
 *
 * Simulates concurrent login throughput across distinct, unique student accounts.
 *
 * RATE-LIMITING ARCHITECTURE NOTE:
 * The backend LoginRateLimiter is keyed by *normalized email* (account-based),
 * NOT IP address. It locks an account for 15 minutes after 5 consecutive failed attempts.
 *
 * By distributing login requests across unique accounts from users.students:
 * 1. Each Virtual User (__VU) authenticates with their own dedicated dummy account.
 * 2. No single account receives concurrent collisions or false brute-force triggers.
 * 3. Successful authentications invoke LoginRateLimiter.recordSuccess(email), keeping accounts clear.
 */
export const options = {
  stages: [
    { duration: '15s', target: 10 }, // 10 concurrent logins
    { duration: '30s', target: 25 }, // 25 concurrent logins
    { duration: '30s', target: 50 }, // 50 concurrent logins
    { duration: '30s', target: 100 }, // 100 concurrent logins
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: {
    ...standardThresholds,
    // Target 95% of logins completed under 2.5s (due to BCrypt CPU cost factor 10)
    http_req_duration: ['p(90)<1500', 'p(95)<2500'],
  },
};

export default function () {
  const students = users.students || [];
  if (students.length === 0) {
    throw new Error('No student accounts available in data/users.json. Run generate-accounts first.');
  }

  // Map each Virtual User (__VU is 1-indexed) uniquely to a dedicated student account
  const userIndex = (__VU - 1) % students.length;
  const user = students[userIndex];

  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
  });

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: getHeaders(),
    tags: {
      name: 'Concurrent_Login',
      user: user.studentId || user.email,
    },
  });

  check(res, {
    'login status is 200': (r) => r.status === 200,
    'jwt token present': (r) => r.json('token') !== undefined,
    'correct user authenticated': (r) => r.json('user.email') === user.email.toLowerCase(),
  });

  sleep(1);
}
