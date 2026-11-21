/**
 * Validation Test Suite for AuthPortal Account Generator & Provisioner
 * Run with: node tests/validate-generator.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { generateAccounts } = require('../scripts/generate-accounts.js');
const { provisionAccounts } = require('../scripts/provision-accounts.js');
const { DUMMY_EMAIL_REGEX } = require('../scripts/cleanup-dummy-accounts.js');

const STUDENT_EMAIL_REGEX = /^[Nn]\d{6}@rguktn\.ac\.in$/;
const STUDENT_ID_REGEX = /^N\d{6}$/;

console.log('==========================================================');
console.log(' Running AuthPortal Generator & Provisioner Validation Tests');
console.log('==========================================================');

const testOutputDir = path.join(__dirname, '..', 'data', 'test-scratch');

try {
  // Test 1: Generate 50 accounts starting at ID 1
  console.log('Test 1: Generating 50 dummy accounts starting at ID 1...');
  const file1 = path.join(testOutputDir, 'users-50.json');
  const res1 = generateAccounts({
    count: 50,
    startId: 1,
    prefix: 'n',
    domain: 'rguktn.ac.in',
    password: 'Password123!',
    branch: 'CSE',
    academicYear: 'E2',
    section: '1',
    outputFile: file1,
    generateSql: false,
  });

  assert.strictEqual(res1.students.length, 50, 'Student count should be 50');
  assert.strictEqual(res1.students[0].email, 'n000001@rguktn.ac.in', 'First email should be n000001@rguktn.ac.in');
  assert.strictEqual(res1.students[0].studentId, 'N000001', 'First studentId should be N000001');
  assert.strictEqual(res1.students[49].email, 'n000050@rguktn.ac.in', 'Last email should be n000050@rguktn.ac.in');
  assert.strictEqual(res1.students[49].studentId, 'N000050', 'Last studentId should be N000050');
  console.log('  -> PASS: 50 accounts generated with correct IDs and boundaries');

  // Test 2: Generate 100 accounts starting at ID 501 (testing custom startId & range)
  console.log('\nTest 2: Generating 100 accounts with custom startId 501...');
  const file2 = path.join(testOutputDir, 'users-offset.json');
  const res2 = generateAccounts({
    count: 100,
    startId: 501,
    prefix: 'n',
    domain: 'rguktn.ac.in',
    password: 'Password123!',
    branch: 'CSE',
    academicYear: 'E2',
    section: '1',
    outputFile: file2,
    generateSql: true,
    sqlFile: path.join(testOutputDir, 'test-seed.sql'),
  });

  assert.strictEqual(res2.students.length, 100, 'Student count should be 100');
  assert.strictEqual(res2.students[0].email, 'n000501@rguktn.ac.in', 'First email should be n000501@rguktn.ac.in');
  assert.strictEqual(res2.students[0].studentId, 'N000501', 'First studentId should be N000501');
  assert.strictEqual(res2.students[99].email, 'n000600@rguktn.ac.in', 'Last email should be n000600@rguktn.ac.in');
  assert.strictEqual(res2.students[99].studentId, 'N000600', 'Last studentId should be N000600');
  assert(fs.existsSync(path.join(testOutputDir, 'test-seed.sql')), 'SQL seed file should be generated');
  console.log('  -> PASS: Custom offset range and SQL generation verified');

  // Test 3: Validate regex compliance and duplicate check
  console.log('\nTest 3: Validating format compliance and uniqueness...');
  const emails = new Set();
  for (const student of res2.students) {
    assert(STUDENT_EMAIL_REGEX.test(student.email), `Email ${student.email} must match student regex`);
    assert(STUDENT_ID_REGEX.test(student.studentId), `Student ID ${student.studentId} must match N\\d{6}`);
    assert(student.password.length >= 8 && student.password.length <= 100, 'Password must be 8-100 chars');
    assert(student.name.length >= 2, 'Name must be at least 2 chars');
    assert(!emails.has(student.email), `Duplicate email detected: ${student.email}`);
    emails.add(student.email);
  }
  console.log('  -> PASS: All 100 accounts pass schema validation, regex rules, and uniqueness');

  // Test 4: Validate faculty & admin preservation
  console.log('\nTest 4: Verifying faculty and admin preservation...');
  assert(Array.isArray(res1.teachers) && res1.teachers.length > 0, 'Teachers array must be preserved');
  assert(res1.admin && res1.admin.email, 'Admin object must be preserved');
  console.log('  -> PASS: Teachers and Admin accounts intact');

  // Test 5: Provisioner Dry-Run
  console.log('\nTest 5: Testing provisioner in dry-run mode...');
  provisionAccounts({
    targetUrl: 'http://localhost:8080',
    dataFile: file1,
    batchSize: 10,
    delayMs: 0,
    dryRun: true,
  }).then((summary) => {
    assert.strictEqual(summary.total, 50, 'Dry run should process all 50 accounts');
    console.log('  -> PASS: Provisioner dry-run executed successfully');

    // Test 6: Validate Cleanup Regex Guard
    console.log('\nTest 6: Validating cleanup safety filter...');
    assert(DUMMY_EMAIL_REGEX.test('n000001@rguktn.ac.in'), 'Should match dummy student');
    assert(DUMMY_EMAIL_REGEX.test('N000123@RGUKTN.AC.IN'), 'Should match case-insensitively');
    assert(!DUMMY_EMAIL_REGEX.test('hod.cse@rguktn.ac.in'), 'Should NOT match faculty');
    assert(!DUMMY_EMAIL_REGEX.test('admin@rguktn.ac.in'), 'Should NOT match admin');
    assert(!DUMMY_EMAIL_REGEX.test('student@gmail.com'), 'Should NOT match external email');
    assert(!DUMMY_EMAIL_REGEX.test('n180001@gmail.com'), 'Should NOT match non-rgukt domain');
    console.log('  -> PASS: Cleanup safety regex strictly isolates dummy accounts');

    // Cleanup scratch directory
    fs.rmSync(testOutputDir, { recursive: true, force: true });

    console.log('\n==========================================================');
    console.log(' ALL 6 VALIDATION TESTS PASSED SUCCESSFULLY! (0 Failures)');
    console.log('==========================================================\n');
  }).catch((err) => {
    console.error('Test 5 failed:', err);
    process.exit(1);
  });

} catch (err) {
  console.error('\nValidation Test Failed:', err.message);
  process.exit(1);
}
