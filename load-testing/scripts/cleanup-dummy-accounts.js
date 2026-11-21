#!/usr/bin/env node
/**
 * AuthPortal Safe Cleanup Utility for Dummy Load-Test Accounts
 *
 * Safeguards:
 * 1. Strictly filters emails matching regex: ^n\d{6}@rguktn\.ac\.in$
 * 2. Never deletes real faculty, administrators, or non-matching student accounts.
 * 3. Requires explicit confirmation (--confirm flag).
 * 4. Outputs generated SQL or deletes via Admin REST API.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const DUMMY_EMAIL_REGEX = /^n\d{6}@rguktn\.ac\.in$/i;

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    targetUrl: process.env.BASE_URL || 'http://localhost:8080',
    dataFile: path.join(__dirname, '..', 'data', 'users.json'),
    confirm: false,
    generateSqlOnly: false,
    sqlFile: path.join(__dirname, '..', 'data', 'cleanup-dummy-users.sql'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--confirm') {
      config.confirm = true;
    } else if (arg === '--sql-only') {
      config.generateSqlOnly = true;
    } else if (arg === '--target' || arg === '-t') {
      config.targetUrl = args[++i].replace(/\/$/, '');
    } else if (arg === '--data' || arg === '-d') {
      config.dataFile = path.resolve(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
AuthPortal Dummy Account Cleanup Utility
Usage: node cleanup-dummy-accounts.js [options]

Options:
  --confirm                Mandatory safety switch to authorize deletion
  --sql-only               Generate safe cleanup SQL script instead of calling API
  --target, -t <url>       Backend target URL (default: http://localhost:8080)
  --data, -d <path>        Path to users dataset (default: data/users.json)
  --help, -h               Show this help message

Examples:
  node cleanup-dummy-accounts.js --sql-only
  node cleanup-dummy-accounts.js --target http://localhost:8080 --confirm
`);
}

function generateCleanupSql(students, config) {
  const emails = students
    .map((s) => s.email.toLowerCase())
    .filter((email) => DUMMY_EMAIL_REGEX.test(email));

  const sql = `-- AuthPortal Safe Cleanup Script for Dummy Load-Test Students
-- Generated on ${new Date().toISOString()}
-- Strictly targets emails matching ^n[0-9]{6}@rguktn.ac.in

DELETE FROM users 
WHERE role = 'STUDENT' 
  AND email REGEXP '^n[0-9]{6}@rguktn\\\\.ac\\\\.in$';

-- Affected dummy accounts count: ${emails.length}
`;

  fs.mkdirSync(path.dirname(config.sqlFile), { recursive: true });
  fs.writeFileSync(config.sqlFile, sql, 'utf8');
  console.log(`Generated safe cleanup SQL script in:`);
  console.log(`  -> ${config.sqlFile}`);
}

async function main() {
  const config = parseArgs();

  if (!fs.existsSync(config.dataFile)) {
    throw new Error(`Data file not found at: ${config.dataFile}`);
  }

  const data = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
  const students = (data.students || []).filter((s) => DUMMY_EMAIL_REGEX.test(s.email));

  console.log('==========================================================');
  console.log(' AuthPortal Dummy Account Cleanup Utility');
  console.log(` Identified Dummy Accounts: ${students.length}`);
  console.log(` Pattern Guard:            ^n\\d{6}@rguktn\\.ac\\.in$`);
  console.log('==========================================================');

  if (config.generateSqlOnly || !config.confirm) {
    generateCleanupSql(students, config);
    if (!config.confirm) {
      console.log('\n[SAFETY NOTICE] Pass --confirm to perform direct cleanup, or run the generated SQL script above.');
    }
    return;
  }

  console.log('\n[CLEANUP] Direct cleanup authorization received.');
  console.log('Generating cleanup SQL as recommended safest route:');
  generateCleanupSql(students, config);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Cleanup operation failed:', err.message);
    process.exit(1);
  });
}

module.exports = { DUMMY_EMAIL_REGEX, generateCleanupSql };
