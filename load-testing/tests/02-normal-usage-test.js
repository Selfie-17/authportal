import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { standardThresholds } from '../config/thresholds.js';
import { studentUserFlow } from '../scenarios/student-scenario.js';
import { teacherUserFlow } from '../scenarios/teacher-scenario.js';
import { adminUserFlow } from '../scenarios/admin-scenario.js';

/**
 * Stage 02 — Normal Usage Load Test
 *
 * Supported Workload Modes (via WORKLOAD_MODE environment variable):
 * 1. 'student-only' (DEFAULT & SAFE):
 *    - 100% Student traffic distributed across provisioned dummy student accounts.
 *    - Eliminates teacher and admin login attempts so LoginRateLimiter cannot be triggered.
 *    - Validates complete student journey: login, token validation, metadata, submissions, profile, role.
 *    - Concurrency: 25 -> 50 VUs over 1m 45s.
 *
 * 2. 'diagnostic' (LOW-CONCURRENCY BOTTLENECK TRIAGE):
 *    - Maximum 3 VUs for 35s.
 *    - Isolates network round-trip latency to remote Aiven MySQL from pool exhaustion.
 *
 * 3. 'blended' (REQUIRES PRE-PROVISIONED FACULTY/ADMIN ACCOUNTS):
 *    - 70% Students, 20% Teachers, 10% Admins.
 *    - Validates presence of teacher and admin accounts during setup() pre-flight check.
 *    - Aborts with a clear Configuration Error if accounts are missing.
 */
export const WORKLOAD_MODE = (__ENV.WORKLOAD_MODE || 'student-only').toLowerCase();

const users = JSON.parse(open('../data/users.json'));

export const options = (() => {
  if (__ENV.VUS && __ENV.DURATION) {
    return {
      vus: parseInt(__ENV.VUS, 10),
      duration: __ENV.DURATION,
      thresholds: standardThresholds,
    };
  }
  if (WORKLOAD_MODE === 'diagnostic') {
    return {
      stages: [
        { duration: '5s', target: 3 },   // Ramp to 3 VUs
        { duration: '25s', target: 3 },  // Hold at 3 VUs (below HikariCP pool limit of 5)
        { duration: '5s', target: 0 },   // Ramp-down
      ],
      thresholds: standardThresholds,
    };
  }
  return {
    stages: [
      { duration: '30s', target: 25 }, // Warm-up ramp to 25 VUs
      { duration: '1m', target: 50 },  // Sustained realistic traffic scaling to 50 VUs
      { duration: '15s', target: 0 },  // Ramp-down
    ],
    thresholds: standardThresholds,
  };
})();

export function setup() {
  if (WORKLOAD_MODE === 'blended') {
    console.log('================================================================================');
    console.log(' [STAGE 02] NORMAL USAGE LOAD TEST: BLENDED WORKLOAD MODE');
    console.log(' Target Distribution: 70% Students, 20% Teachers, 10% Admins');
    console.log(' Verifying required pre-provisioned teacher & admin accounts...');
    console.log('================================================================================');

    const teacher = users.teachers && users.teachers[0];
    if (!teacher) {
      throw new Error("Configuration Error: No teacher accounts defined in data/users.json for 'blended' mode.");
    }

    const teacherRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: teacher.email,
      password: teacher.password,
    }), { headers: getHeaders() });

    if (teacherRes.status !== 200) {
      throw new Error(
        `Configuration Error: Teacher account '${teacher.email}' cannot authenticate (HTTP ${teacherRes.status}). ` +
        "The 'blended' workload requires valid pre-provisioned teacher accounts in the database. " +
        "Please seed teacher/admin accounts first, or run in STUDENT-ONLY mode: powershell -File .\\scripts\\run-test.ps1 -TestName 02 -Mode student-only"
      );
    }

    const admin = users.admin;
    if (!admin) {
      throw new Error("Configuration Error: No admin account defined in data/users.json for 'blended' mode.");
    }

    const adminRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: admin.email,
      password: admin.password,
    }), { headers: getHeaders() });

    if (adminRes.status !== 200) {
      throw new Error(
        `Configuration Error: Admin account '${admin.email}' cannot authenticate (HTTP ${adminRes.status}). ` +
        "The 'blended' workload requires valid pre-provisioned admin accounts in the database. " +
        "Please seed teacher/admin accounts first, or run in STUDENT-ONLY mode: powershell -File .\\scripts\\run-test.ps1 -TestName 02 -Mode student-only"
      );
    }

    console.log('Pre-flight checks passed: Teacher and Admin accounts verified.');
    return { mode: 'blended' };
  }

  if (WORKLOAD_MODE === 'diagnostic') {
    console.log('================================================================================');
    console.log(' [STAGE 02] NORMAL USAGE LOAD TEST: DIAGNOSTIC LOW-CONCURRENCY MODE');
    console.log(' - Concurrency: Maximum 3 Virtual Users (Below HikariCP pool limit of 5)');
    console.log(' - Duration:    35 seconds (5s ramp-up, 25s steady, 5s ramp-down)');
    console.log(' - Purpose:     Isolate endpoint latencies & remote Aiven MySQL network round-trips');
    console.log(` - Accounts:    Using ${users.students ? users.students.length : 0} provisioned dummy student accounts`);
    console.log(' - Faculty/Admin Logins: DISABLED');
    console.log('================================================================================');

    if (!users.students || users.students.length === 0) {
      throw new Error("Configuration Error: No student accounts found in data/users.json. Run generate-accounts first.");
    }

    return { mode: 'diagnostic' };
  }

  // Default: STUDENT-ONLY Mode
  console.log('================================================================================');
  console.log(' [STAGE 02] NORMAL USAGE LOAD TEST: STUDENT-ONLY MODE');
  console.log(' - Workload: 100% Student User Flow (Login, Metadata, Submissions, Profile, Role)');
  console.log(` - Student Accounts: Using ${users.students ? users.students.length : 0} provisioned dummy student accounts`);
  console.log(' - Faculty/Admin Logins: DISABLED (Prevents LoginRateLimiter lockout on unseeded roles)');
  console.log(' - Concurrency: 25 -> 50 VUs sustained (standard Stage 02 - 50 VUs)');
  console.log('================================================================================');

  if (!users.students || users.students.length === 0) {
    throw new Error("Configuration Error: No student accounts found in data/users.json. Run generate-accounts first.");
  }

  return { mode: 'student-only' };
}

export default function (data) {
  const isStudentOnly = (data && (data.mode === 'student-only' || data.mode === 'diagnostic')) || WORKLOAD_MODE !== 'blended';

  if (isStudentOnly) {
    // 100% Student traffic distributed across provisioned student accounts
    const studentIdx = (__VU - 1) % users.students.length;
    studentUserFlow(users.students[studentIdx]);
  } else {
    // 70% Student, 20% Teacher, 10% Admin
    const rand = Math.random();
    if (rand < 0.70) {
      const studentIdx = (__VU - 1) % users.students.length;
      studentUserFlow(users.students[studentIdx]);
    } else if (rand < 0.90) {
      const teacherIdx = (__VU - 1) % users.teachers.length;
      teacherUserFlow(users.teachers[teacherIdx]);
    } else {
      adminUserFlow(users.admin);
    }
  }

  sleep(1);
}
