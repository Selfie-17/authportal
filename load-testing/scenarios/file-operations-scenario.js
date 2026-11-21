import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, currentConfig, getHeaders } from '../config/env.js';

// Pre-load sample files into memory for file testing
const sampleCFile = open('../data/sample-assignment.c');
const samplePdfFile = open('../data/sample-report.pdf', 'b');

/**
 * Scenario D — File Operations Flow:
 * 1. Safe inline viewing / streaming of submission file (/api/submissions/{id}/files/{fileId}/view)
 * 2. Teacher ZIP batch download (/api/submissions/teacher/download-zip?week=1&section=1)
 * 3. Controlled multipart submission upload (Only when allowMutations === true)
 */
export function fileOperationsFlow(userCredentials, role = 'TEACHER') {
  // Step 1: Login
  const loginPayload = JSON.stringify({
    email: userCredentials.email,
    password: userCredentials.password,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: getHeaders(),
    tags: { name: 'FileOps_Login' },
  });

  const loginSuccess = check(loginRes, {
    'fileOps login status is 200': (r) => r.status === 200,
    'fileOps received token': (r) => r.json('token') !== undefined,
  });

  if (!loginSuccess) {
    return;
  }

  const token = loginRes.json('token');
  const authHeaders = getHeaders(token);

  sleep(1);

  // Step 2: Download / stream single file inline
  // Using probe file ID 1; 200 (found) or 404 (empty db) are valid responses under test
  const fileViewRes = http.get(`${BASE_URL}/api/submissions/1/files/1/view`, {
    headers: authHeaders,
    tags: { name: 'FileOps_ViewSingleFile' },
  });

  check(fileViewRes, {
    'file view returns valid HTTP status': (r) => r.status === 200 || r.status === 404,
  });

  sleep(2);

  // Step 3: Teacher ZIP archive streaming
  if (role === 'TEACHER' || role === 'ADMIN') {
    const zipRes = http.get(`${BASE_URL}/api/submissions/teacher/download-zip?week=1&section=1`, {
      headers: authHeaders,
      tags: { name: 'FileOps_DownloadZip' },
      timeout: '60s',
    });

    check(zipRes, {
      'zip download returns valid HTTP status': (r) => r.status === 200 || r.status === 404 || r.status === 204,
    });
  }

  sleep(2);

  // Step 4: Controlled file upload (MUTATION GUARDED)
  if (currentConfig.allowMutations && role === 'STUDENT') {
    const multipartData = {
      studentId: userCredentials.studentId || 'B201001',
      week: '1',
      year: 'E2',
      section: '1',
      cFile: http.file(sampleCFile, 'lab1_test.c', 'text/x-c'),
      pdfFile: http.file(samplePdfFile, 'report_test.pdf', 'application/pdf'),
    };

    const uploadHeaders = {
      'Authorization': `Bearer ${token}`,
    };

    const uploadRes = http.post(`${BASE_URL}/api/submissions`, multipartData, {
      headers: uploadHeaders,
      tags: { name: 'FileOps_UploadSubmission' },
      timeout: '30s',
    });

    check(uploadRes, {
      'upload submission returns 200, 201, or 400': (r) => [200, 201, 400].includes(r.status),
    });

    sleep(2);
  }
}
