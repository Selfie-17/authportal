import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getHeaders } from '../config/env.js';
import { fileDownloadThresholds } from '../config/thresholds.js';

const users = JSON.parse(open('../data/users.json'));

export const options = {
  stages: [
    { duration: '15s', target: 5 },  // 5 concurrent heavy downloaders
    { duration: '30s', target: 15 }, // 15 concurrent downloaders
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: fileDownloadThresholds,
};

export default function () {
  const teacher = users.teachers[__VU % users.teachers.length];

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: teacher.email,
    password: teacher.password,
  }), {
    headers: getHeaders(),
    tags: { name: 'FileDownload_Login' },
  });

  if (loginRes.status !== 200) return;

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  // 1. Single file view/stream
  const viewRes = http.get(`${BASE_URL}/api/submissions/1/files/1/view`, {
    headers: authHeaders,
    tags: { name: 'FileDownload_Single' },
  });

  check(viewRes, { 'single file view status valid': (r) => r.status === 200 || r.status === 404 });

  sleep(1);

  // 2. Stream ZIP archive
  const zipRes = http.get(`${BASE_URL}/api/submissions/teacher/download-zip?week=1&section=1`, {
    headers: authHeaders,
    tags: { name: 'FileDownload_Zip' },
    timeout: '45s',
  });

  check(zipRes, { 'zip download status valid': (r) => r.status === 200 || r.status === 404 || r.status === 204 });

  sleep(2);
}
