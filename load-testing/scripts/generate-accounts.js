#!/usr/bin/env node
/**
 * AuthPortal Dummy Test-Account Generator
 *
 * Generates configurable batches of realistic dummy student accounts for load testing.
 * Format:
 *   - Email: n000001@rguktn.ac.in
 *   - Academic ID: N000001
 *   - Name: Student N000001
 *
 * Preserves existing teachers and admin accounts so test suites continue to function seamlessly.
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    count: 100,
    startId: 1,
    prefix: 'n',
    domain: 'rguktn.ac.in',
    password: 'Password123!',
    branch: 'CSE',
    academicYear: 'E2',
    section: '1',
    outputFile: path.join(__dirname, '..', 'data', 'users.json'),
    generateSql: false,
    sqlFile: path.join(__dirname, '..', 'data', 'seed-dummy-users.sql'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--count' || arg === '-c') {
      config.count = parseInt(args[++i], 10);
    } else if (arg === '--start-id' || arg === '-s') {
      config.startId = parseInt(args[++i], 10);
    } else if (arg === '--prefix' || arg === '-p') {
      config.prefix = args[++i].toLowerCase();
    } else if (arg === '--domain' || arg === '-d') {
      config.domain = args[++i].toLowerCase();
    } else if (arg === '--password') {
      config.password = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      config.outputFile = path.resolve(args[++i]);
    } else if (arg === '--sql') {
      config.generateSql = true;
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        config.sqlFile = path.resolve(args[++i]);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
AuthPortal Dummy Account Generator
Usage: node generate-accounts.js [options]

Options:
  --count, -c <number>     Number of student accounts to generate (default: 100)
  --start-id, -s <number>  Starting sequential number (default: 1)
  --prefix, -p <char>      Single letter prefix (default: 'n')
  --domain, -d <domain>    Institutional domain (default: 'rguktn.ac.in')
  --password <string>      Default password for accounts (default: 'Password123!')
  --output, -o <path>      Destination JSON file (default: data/users.json)
  --sql [path]             Also generate SQL seed file (default: data/seed-dummy-users.sql)
  --help, -h               Show this help message

Examples:
  node generate-accounts.js --count 50
  node generate-accounts.js --count 100 --start-id 1
  node generate-accounts.js --count 500 --start-id 1 --sql
  node generate-accounts.js --count 1000 --start-id 1
`);
}

function generateAccounts(config) {
  if (config.password.length < 8 || config.password.length > 100) {
    throw new Error('Password must be between 8 and 100 characters per backend validation rules.');
  }

  // Preserve existing faculty & admin users if file exists
  let existingData = {};
  if (fs.existsSync(config.outputFile)) {
    try {
      existingData = JSON.parse(fs.readFileSync(config.outputFile, 'utf8'));
    } catch {
      existingData = {};
    }
  }

  const teachers = existingData.teachers || [
    { email: 'hod.cse@rguktn.ac.in', password: 'Password123!', name: 'Dr. CSE HOD' },
    { email: 'faculty1@rguktn.ac.in', password: 'Password123!', name: 'Prof. Algorithm' }
  ];

  const admin = existingData.admin || {
    email: 'admin@rguktn.ac.in',
    password: 'Password123!',
    name: 'System Admin'
  };

  const students = [];
  const endId = config.startId + config.count - 1;

  for (let i = config.startId; i <= endId; i++) {
    const paddedNum = String(i).padStart(6, '0');
    const studentId = `${config.prefix.toUpperCase()}${paddedNum}`;
    const email = `${config.prefix.toLowerCase()}${paddedNum}@${config.domain}`;
    const name = `Student ${studentId}`;

    students.push({
      name,
      email,
      password: config.password,
      studentId,
      branch: config.branch,
      academicYear: config.academicYear,
      section: config.section,
    });
  }

  const result = {
    metadata: {
      generatedAt: new Date().toISOString(),
      studentCount: students.length,
      startId: config.startId,
      endId,
      prefix: config.prefix,
      domain: config.domain,
    },
    students,
    teachers,
    admin,
    admins: [admin],
  };

  fs.mkdirSync(path.dirname(config.outputFile), { recursive: true });
  fs.writeFileSync(config.outputFile, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Generated ${students.length} dummy student accounts in:`);
  console.log(`  -> ${config.outputFile}`);
  console.log(`  Range: ${students[0].email} to ${students[students.length - 1].email}`);
  console.log(`  Student IDs: ${students[0].studentId} to ${students[students.length - 1].studentId}`);

  if (config.generateSql) {
    generateSqlSeed(students, config);
  }

  return result;
}

function generateSqlSeed(students, config) {
  // Pre-computed BCrypt hash for "Password123!" with cost factor 10:
  // $2a$10$wT0o3q6V4r0K57q51wIe8OOw8n2Fq2H7Pps5O7N8e8Iq3a2K5.U6e
  const bcryptHash = '$2a$10$wT0o3q6V4r0K57q51wIe8OOw8n2Fq2H7Pps5O7N8e8Iq3a2K5.U6e';

  let sql = `-- AuthPortal Seed Script for Dummy Load-Test Students
-- Generated on ${new Date().toISOString()}
-- Safe & Idempotent (uses INSERT IGNORE to prevent duplicate errors or overwriting existing users)

INSERT IGNORE INTO users (email, password, name, role, auth_provider, branch, academic_year, section, enabled, created_at, updated_at)
VALUES
`;

  const values = students.map((s) => {
    return `  ('${s.email}', '${bcryptHash}', '${s.name}', 'STUDENT', 'LOCAL', '${s.branch}', '${s.academicYear}', '${s.section}', TRUE, NOW(6), NOW(6))`;
  });

  sql += values.join(',\n') + ';\n';

  fs.mkdirSync(path.dirname(config.sqlFile), { recursive: true });
  fs.writeFileSync(config.sqlFile, sql, 'utf8');
  console.log(`Generated idempotent SQL seed script in:`);
  console.log(`  -> ${config.sqlFile}`);
}

if (require.main === module) {
  try {
    const config = parseArgs();
    generateAccounts(config);
  } catch (err) {
    console.error('Account generation failed:', err.message);
    process.exit(1);
  }
}

module.exports = { generateAccounts };
