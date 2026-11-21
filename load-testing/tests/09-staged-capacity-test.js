import http from 'k6/http';
import { check, sleep } from 'k6';
import { standardThresholds } from '../config/thresholds.js';
import { studentUserFlow } from '../scenarios/student-scenario.js';
import { teacherUserFlow } from '../scenarios/teacher-scenario.js';
import { adminUserFlow } from '../scenarios/admin-scenario.js';

const users = JSON.parse(open('../data/users.json'));

/**
 * Staged Concurrency Capacity Test:
 * Systematically steps through increasing VU levels:
 * - Stage 1: 10 VUs
 * - Stage 2: 25 VUs
 * - Stage 3: 50 VUs
 * - Stage 4: 100 VUs
 * - Stage 5: 200 VUs
 * - Stage 6: 300 VUs
 * - Stage 7: 500 VUs
 */
export const options = {
  stages: [
    // Stage 1: 10 VUs
    { duration: '20s', target: 10 },
    { duration: '40s', target: 10 },
    // Stage 2: 25 VUs
    { duration: '20s', target: 25 },
    { duration: '40s', target: 25 },
    // Stage 3: 50 VUs
    { duration: '20s', target: 50 },
    { duration: '40s', target: 50 },
    // Stage 4: 100 VUs
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    // Stage 5: 200 VUs
    { duration: '30s', target: 200 },
    { duration: '1m', target: 200 },
    // Stage 6: 300 VUs
    { duration: '30s', target: 300 },
    { duration: '1m', target: 300 },
    // Stage 7: 500 VUs
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },
    // Ramp-down
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Collect error rate and timing across all stages
    http_req_failed: ['rate<0.10'], // Threshold for full test suite tracking
    http_req_duration: ['p(95)<5000'],
  },
};

export default function () {
  const rand = Math.random();

  if (rand < 0.75) {
    const student = users.students[__VU % users.students.length];
    studentUserFlow(student);
  } else if (rand < 0.95) {
    const teacher = users.teachers[__VU % users.teachers.length];
    teacherUserFlow(teacher);
  } else {
    adminUserFlow(users.admin);
  }

  sleep(1);
}
