# AuthPortal Load Testing & Capacity Assessment System

This directory contains the independent, production-safe load testing framework and dummy account provisioning system for the **AuthPortal** backend, built with [Grafana k6](https://k6.io/).

---

## 1. Directory Structure

```text
load-testing/
├── bin/
│   └── k6.exe                         # Standalone k6 binary (v0.56.0, windows/amd64)
├── config/
│   ├── env.js                         # Environment config resolver & auth header utility
│   ├── thresholds.js                  # Performance SLOs & pass/fail thresholds
│   ├── local.env.json                 # Local environment settings
│   └── staging.env.json               # Staging/Render environment settings
├── data/
│   ├── users.json                     # Test user dataset (seeded/generated students, faculty, admin)
│   ├── users.example.json             # Example schema template for users.json
│   ├── seed-dummy-users.sql           # Generated idempotent SQL seed file (optional)
│   ├── sample-assignment.c            # Harmless 1KB C source test payload
│   └── sample-report.pdf              # Harmless 2KB PDF test payload
├── scenarios/
│   ├── student-scenario.js            # Realistic student dashboard & submission flow
│   ├── teacher-scenario.js            # Realistic teacher grid & report review flow
│   ├── admin-scenario.js              # Admin stats & user management flow
│   └── file-operations-scenario.js    # Safe file streaming & ZIP generation flow
├── scripts/
│   ├── generate-accounts.js           # Configurable dummy account generator
│   ├── generate-accounts.ps1          # PowerShell wrapper for account generation
│   ├── provision-accounts.js          # Safe & idempotent account provisioner
│   ├── provision-accounts.ps1         # PowerShell wrapper for account provisioning
│   ├── cleanup-dummy-accounts.js      # Safe cleanup utility for dummy accounts
│   ├── cleanup-dummy-accounts.ps1     # PowerShell wrapper for cleanup
│   └── run-test.ps1                   # Automated PowerShell test runner
├── tests/
│   ├── 01-baseline-test.js            # Health & baseline latency test (5 VUs)
│   ├── 02-normal-usage-test.js        # Blended normal traffic (70% students, 20% teachers, 10% admins)
│   ├── 03-concurrent-login-test.js    # Distributed unique concurrent authentication
│   ├── 04-dashboard-load-test.js      # Batch profile & submission fetching
│   ├── 05-evaluation-report-test.js   # Heavy grid calculation & report generation
│   ├── 06-file-download-test.js       # Single file & streaming ZIP archive downloads
│   ├── 07-spike-test.js               # Sudden surge to 100 VUs and recovery
│   ├── 08-soak-test.js                # 10-minute steady endurance test
│   ├── 09-staged-capacity-test.js     # Staged ramp (10 -> 25 -> 50 -> 100 -> 200 -> 300 -> 500 VUs)
│   ├── validate-generator.js          # Unit validation tests for generator & provisioner
│   └── validate-generator.ps1         # PowerShell wrapper for validation tests
└── results/                           # Destination for test execution metrics JSON
```

---

## 2. Rate-Limiting Architecture & Unique Accounts

### How AuthPortal's Rate Limiter Operates
In `com.selva.authportal.security.LoginRateLimiter`:
- **Account-Based Keying:** The rate limiter is keyed by `normalizedEmail` (not IP address).
- **Lockout Mechanism:** 5 consecutive failed authentications on a specific email lock that account for 15 minutes.
- **Success Reset:** Every successful login immediately calls `recordSuccess(email)`, clearing failed attempt counters.
- **Why Unique Accounts Matter:** When running concurrent load tests (e.g. 50 or 100 VUs), using a single pooled account causes race conditions where failed/delayed responses can trigger false brute-force lockouts. Distributing each Virtual User (`__VU`) to their own unique student account ensures realistic test traffic with zero false lockouts.

---

## 3. Account Generator & Provisioning Commands

### Generate Test Accounts

#### 1. Generate 100 Dummy Accounts (Default)
Generates `n000001@rguktn.ac.in` through `n000100@rguktn.ac.in` (Academic IDs: `N000001` to `N000100`):
```powershell
# Using PowerShell wrapper:
powershell -File .\scripts\generate-accounts.ps1 -Count 100

# Or via Node.js:
node .\scripts\generate-accounts.js --count 100
```

#### 2. Generate 500 Dummy Accounts with SQL Seed
Generates 500 accounts and creates an idempotent SQL insert file (`data/seed-dummy-users.sql`):
```powershell
# Using PowerShell wrapper:
powershell -File .\scripts\generate-accounts.ps1 -Count 500 -GenerateSql

# Or via Node.js:
node .\scripts\generate-accounts.js --count 500 --sql
```

#### 3. Custom Range (e.g. Start at 501 for 200 Accounts)
```powershell
powershell -File .\scripts\generate-accounts.ps1 -Count 200 -StartId 501
```

---

### Provision Accounts into AuthPortal

The provisioning script registers accounts via `POST /api/auth/register`. It is **100% idempotent**:
- **HTTP 201 Created**: Newly registered.
- **HTTP 409 Conflict**: Already existing account safely skipped.
- **Role Isolation**: The backend `EmailRoleResolver` automatically enforces `Role.STUDENT`. No admin privileges can ever be assigned to dummy users.

#### Provision to Local Backend:
```powershell
# Using PowerShell wrapper:
powershell -File .\scripts\provision-accounts.ps1 -TargetUrl "http://localhost:8080" -BatchSize 10

# Or via Node.js:
node .\scripts\provision-accounts.js --target http://localhost:8080 --batch 10
```

#### Dry-Run Validation (Without Network Calls):
```powershell
powershell -File .\scripts\provision-accounts.ps1 -DryRun
```

#### Direct MySQL Database Seeding (Optional Instant Alternative):
If you have direct access to your MySQL database, execute the generated SQL file:
```powershell
mysql -u <user> -p <database> < data\seed-dummy-users.sql
```
*(Uses `INSERT IGNORE` so existing users are never duplicated or overwritten).*

---

### Run Normal Usage Test (Stage 02)

Stage 02 supports three distinct workload modes:
- **`student-only` (Default & Safe):** 100% student traffic distributed across your provisioned dummy student accounts. Completely skips teacher/admin logins to eliminate `LoginRateLimiter` lockouts. (15 -> 25 VUs over 1m 45s).
- **`diagnostic` (Low-Concurrency Bottleneck Triage):** Controlled 3 VUs for 35s. Isolates individual endpoint latencies and remote Aiven MySQL network round-trips from HikariCP pool exhaustion.
- **`blended`:** 70% Students, 20% Teachers, 10% Admins. Requires valid pre-provisioned faculty and admin accounts in the database (aborts fast with a configuration error if missing).

```powershell
# 1. Run in STUDENT-ONLY Mode (Default):
powershell -File .\scripts\run-test.ps1 -TestName 02 -Mode student-only

# 2. Run Low-Concurrency Diagnostic Test (Max 3 VUs for 35s):
powershell -File .\scripts\run-test.ps1 -TestName 02-diagnostic

# Or directly via Mode switch on Stage 02:
powershell -File .\scripts\run-test.ps1 -TestName 02 -Mode diagnostic

# 3. Run in BLENDED Mode (Requires seeded faculty & admin):
powershell -File .\scripts\run-test.ps1 -TestName 02 -Mode blended
```

#### Diagnostic Endpoint Metrics Breakdown
Every student user flow records individual response duration Trends in k6:
- `duration_student_login`: Latency for `POST /api/auth/login` (BCrypt password verification + token issue)
- `duration_metadata`: Latency for `GET /api/submissions/default-student-id`
- `duration_submissions`: Latency for `GET /api/submissions/my` (Database query + entity mapping)
- `duration_profile`: Latency for `GET /api/profile` (User profile query)
- `duration_role_verify`: Latency for `GET /api/test/student` (Security filter chain role check)

---

### Run Concurrent Login Test

Runs the updated `03-concurrent-login-test.js` where each VU authenticates with a distinct student account:
```powershell
# Using the test runner:
powershell -File .\scripts\run-test.ps1 -TestName 03

# Or directly with bundled k6:
.\bin\k6.exe run tests\03-concurrent-login-test.js
```

---

### Safe Dummy Account Cleanup

The cleanup utility has strict regex guards: it **strictly matches `^n\d{6}@rguktn\.ac\.in$`**. Faculty, administrators, and real users are completely immune from cleanup.

#### 1. Generate Safe Cleanup SQL Script (Safest):
```powershell
powershell -File .\scripts\cleanup-dummy-accounts.ps1 -SqlOnly
```

#### 2. Explicit Confirmation Direct Cleanup:
```powershell
powershell -File .\scripts\cleanup-dummy-accounts.ps1
# Prompts: Type 'CONFIRM' to proceed
```

---

### Run Validation Tests

Validates generator constraints, sequential ID formatting, uniqueness, dry-run provisioner, and cleanup regex:
```powershell
powershell -File .\tests\validate-generator.ps1
# Or:
node .\tests\validate-generator.js
```

---

## 4. SLO & Threshold Metrics

- **Baseline Latency**: P95 < 500ms, Error Rate < 0.5%
- **Normal API Operations**: P95 < 2000ms, Error Rate < 1.0%
- **Concurrent Logins**: P95 < 2500ms (accounting for BCrypt cost factor 10)
- **File Downloads & ZIP Streaming**: P95 < 5000ms, Error Rate < 2.0%
- **Spike Tolerance**: Error Rate < 5.0%
