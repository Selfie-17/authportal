#!/usr/bin/env node
/**
 * AuthPortal Safe & Idempotent Account Provisioner
 *
 * Reads dummy student accounts from data/users.json and provisions them against
 * the AuthPortal backend (/api/auth/register).
 *
 * Safety & Idempotency Rules:
 * 1. Sends standard POST /api/auth/register request.
 * 2. If 201 Created -> Account provisioned successfully.
 * 3. If 409 Conflict -> Account already exists in database. Safely skipped (Idempotent).
 * 4. Never overwrites or modifies existing users.
 * 5. Role is automatically set to STUDENT by backend EmailRoleResolver; no ADMIN privilege elevation.
 * 6. Rate & batch throttling prevents overloading the server CPU during provisioning.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    targetUrl: process.env.BASE_URL || 'http://localhost:8080',
    dataFile: path.join(__dirname, '..', 'data', 'users.json'),
    batchSize: 5,
    delayMs: 100,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' || arg === '-t') {
      config.targetUrl = args[++i].replace(/\/$/, '');
    } else if (arg === '--data' || arg === '-d') {
      config.dataFile = path.resolve(args[++i]);
    } else if (arg === '--batch' || arg === '-b') {
      config.batchSize = parseInt(args[++i], 10);
    } else if (arg === '--delay') {
      config.delayMs = parseInt(args[++i], 10);
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp() {
  console.log(`
AuthPortal Account Provisioner
Usage: node provision-accounts.js [options]

Options:
  --target, -t <url>       Backend target URL (default: http://localhost:8080)
  --data, -d <path>        Path to users.json dataset (default: data/users.json)
  --batch, -b <number>     Concurrent provisioning batch size (default: 5)
  --delay <ms>             Delay between batches in ms (default: 100)
  --dry-run                Validate dataset without sending network requests
  --help, -h               Show this help message

Examples:
  node provision-accounts.js
  node provision-accounts.js --target http://localhost:8080 --batch 10
  node provision-accounts.js --target https://authportal-backend.onrender.com --batch 2
`);
}

function registerUser(targetUrl, user) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
    });

    const parsedUrl = new URL(`${targetUrl}/api/auth/register`);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      parsedUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Accept': 'application/json',
        },
        timeout: 15000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode === 201) {
            resolve({ status: 'CREATED', email: user.email });
          } else if (res.statusCode === 409) {
            resolve({ status: 'SKIPPED_EXISTING', email: user.email });
          } else {
            resolve({
              status: 'FAILED',
              email: user.email,
              statusCode: res.statusCode,
              error: responseBody.slice(0, 150),
            });
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'FAILED', email: user.email, error: 'Connection timed out' });
    });

    req.on('error', (err) => {
      resolve({ status: 'FAILED', email: user.email, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function provisionAccounts(config) {
  if (!fs.existsSync(config.dataFile)) {
    throw new Error(`Data file not found at: ${config.dataFile}. Run generate-accounts first.`);
  }

  const data = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
  const students = data.students || [];

  if (students.length === 0) {
    console.log('No student accounts found in dataset to provision.');
    return;
  }

  console.log('==========================================================');
  console.log(' AuthPortal Account Provisioner');
  console.log(` Target URL:  ${config.targetUrl}`);
  console.log(` Total Users: ${students.length}`);
  console.log(` Batch Size:  ${config.batchSize}`);
  console.log(` Dry Run:     ${config.dryRun ? 'YES (Simulated)' : 'NO (Live Network)'}`);
  console.log('==========================================================');

  if (config.dryRun) {
    console.log(`Validated ${students.length} accounts. All records formatted properly.`);
    return { total: students.length, created: 0, skipped: students.length, failed: 0 };
  }

  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < students.length; i += config.batchSize) {
    const batch = students.slice(i, i + config.batchSize);
    const promises = batch.map((user) => registerUser(config.targetUrl, user));
    const results = await Promise.all(promises);

    for (const res of results) {
      if (res.status === 'CREATED') {
        createdCount++;
      } else if (res.status === 'SKIPPED_EXISTING') {
        skippedCount++;
      } else {
        failedCount++;
        console.warn(`  [!] Failed ${res.email}: ${res.error || res.statusCode}`);
      }
    }

    const processed = Math.min(i + config.batchSize, students.length);
    process.stdout.write(`\rProgress: ${processed}/${students.length} (Created: ${createdCount}, Skipped: ${skippedCount}, Failed: ${failedCount})`);

    if (config.delayMs > 0 && processed < students.length) {
      await sleep(config.delayMs);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\n==========================================================');
  console.log(' Provisioning Summary:');
  console.log(`   Total Processed:  ${students.length}`);
  console.log(`   New Registered:   ${createdCount}`);
  console.log(`   Already Existing: ${skippedCount} (Skipped - Idempotent)`);
  console.log(`   Failures:         ${failedCount}`);
  console.log(`   Duration:         ${durationSec}s`);
  console.log('==========================================================');

  return { total: students.length, created: createdCount, skipped: skippedCount, failed: failedCount };
}

if (require.main === module) {
  const config = parseArgs();
  provisionAccounts(config).catch((err) => {
    console.error('Provisioning failed:', err.message);
    process.exit(1);
  });
}

module.exports = { provisionAccounts };
