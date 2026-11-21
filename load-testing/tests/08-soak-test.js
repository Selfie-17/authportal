import http from 'k6/http';
import { check, sleep } from 'k6';
import { standardThresholds } from '../config/thresholds.js';
import { studentUserFlow } from '../scenarios/student-scenario.js';
import { teacherUserFlow } from '../scenarios/teacher-scenario.js';

const users = JSON.parse(open('../data/users.json'));

/**
 * Soak / Endurance Test:
 * Runs a continuous moderate load of 15 VUs for 10 minutes to verify:
 * - No memory leaks or Metaspace exhaustion
 * - No connection pool starvation in HikariCP
 * - Stable garbage collection cycles without degradation
 */
export const options = {
  stages: [
    { duration: '30s', target: 15 }, // Warm-up
    { duration: '9m', target: 15 },  // Sustained steady load
    { duration: '30s', target: 0 },  // Cool-down
  ],
  thresholds: standardThresholds,
};

export default function () {
  const isTeacher = (__VU % 5) === 0;

  if (isTeacher) {
    const teacher = users.teachers[__VU % users.teachers.length];
    teacherUserFlow(teacher);
  } else {
    const student = users.students[__VU % users.students.length];
    studentUserFlow(student);
  }

  sleep(2);
}
