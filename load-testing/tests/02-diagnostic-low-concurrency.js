import { sleep } from 'k6';
import { standardThresholds } from '../config/thresholds.js';
import { studentUserFlow } from '../scenarios/student-scenario.js';

/**
 * Diagnostic Low-Concurrency Test (02-diagnostic-low-concurrency.js):
 *
 * Runs a controlled low-concurrency load (max 3 VUs for 35 seconds) exclusively
 * using provisioned dummy student accounts.
 *
 * DIAGNOSTIC PURPOSE:
 * At 3 VUs, load is well below the HikariCP connection pool limit (maximum-pool-size: 5).
 * This eliminates connection pool queueing as a variable, isolating:
 * 1. Network round-trip latency to remote Aiven MySQL 8.4
 * 2. BCrypt password hashing overhead during login
 * 3. Individual query latencies across each endpoint
 *
 * Timing breakdowns are tracked and displayed via dedicated k6 Trend metrics:
 * - duration_student_login
 * - duration_metadata
 * - duration_submissions
 * - duration_profile
 * - duration_role_verify
 */

const users = JSON.parse(open('../data/users.json'));

export const options = {
  stages: [
    { duration: '5s', target: 3 },   // Rapid ramp-up to 3 VUs
    { duration: '25s', target: 3 },  // Steady state at 3 VUs (well within connection pool)
    { duration: '5s', target: 0 },   // Clean ramp-down
  ],
  thresholds: standardThresholds,
};

export function setup() {
  console.log('================================================================================');
  console.log(' [DIAGNOSTIC] LOW-CONCURRENCY BOTTLENECK ASSESSMENT (MAX 3 VUs)');
  console.log(' - Concurrency: Maximum 3 Virtual Users (Guaranteed below HikariCP pool limit of 5)');
  console.log(' - Duration:    35 seconds (5s ramp-up, 25s steady, 5s ramp-down)');
  console.log(' - Accounts:    Using provisioned dummy student accounts (no faculty/admin)');
  console.log(' - Metrics:     Individual Trends for Login, Meta, Submissions, Profile, Role');
  console.log('================================================================================');

  if (!users.students || users.students.length === 0) {
    throw new Error('Configuration Error: No student accounts found in data/users.json. Run generate-accounts first.');
  }

  return { studentCount: users.students.length };
}

export default function () {
  const studentIdx = (__VU - 1) % users.students.length;
  studentUserFlow(users.students[studentIdx]);
  sleep(1);
}
