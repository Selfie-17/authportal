# Project Demonstration & Live Viva Execution Guide

---

## 1. Demonstration Overview & Preparation Checklist

A smooth live demonstration during an academic viva or evaluation panel proves system authenticity and commands the highest evaluation scores. This guide provides a **step-by-step 5-phase live demonstration script** that shows off every major technical capability of AuthPortal in under 10 minutes.

### Pre-Demo Preparation Checklist (Do this 15 minutes before the presentation)
- [ ] **Docker MySQL Running**: Run `docker ps` to verify container `authportal-mysql` is healthy and listening on port `3306`.
- [ ] **Backend Running**: Terminal 1 running `mvn spring-boot:run` in directory `authportal/`. Confirm log shows: `Started AuthportalApplication in X.XXX seconds`.
- [ ] **Frontend Running**: Terminal 2 running `npm run dev` in directory `frontend/`. Confirm Vite is serving at `http://localhost:5173`.
- [ ] **Browser Prepared**: Open Google Chrome with two separate browser windows:
  - Window A (Standard): For Teacher / Admin demonstration.
  - Window B (Incognito): For Student demonstration.
- [ ] **Sample Files Ready on Desktop**:
  - `sample_solution.c`: A valid C programming source code file.
  - `sample_report.pdf`: A valid PDF laboratory report.
  - `disguised_malware.c`: A compiled binary executable renamed to `.c` (to demonstrate magic byte blocking).
  - `test_evaluations.json`: A sample evaluation JSON file.

---

## 2. Phase-by-Phase Live Demonstration Script

---

### Phase 1: Authentication & Institutional Role Resolution (2 Minutes)

#### Step 1.1: Demonstrate Server-Side Role Enforcement (Local Registration)
1. Open Incognito Window: Navigate to `http://localhost:5173/register`.
2. Attempt registration with a personal email:
   - Name: `Demo Student`
   - Email: `demostudent@gmail.com`
   - Password: `Password123!`
3. Click **"Register"**.
4. **Expected Result**: System rejects the request with an error banner: *"Registration restricted to approved institutional email domains."*
5. **Talking Point**:
   > *"Notice that the client cannot self-select a role. Furthermore, personal Gmail accounts are rejected immediately by our backend `EmailRoleResolver`. Only official institutional emails are permitted."*

#### Step 1.2: Successful Institutional Registration as a Student
1. Change the email to an institutional student format:
   - Email: `N210001@rguktn.ac.in`
   - Password: `Password123!`
2. Click **"Register"**.
3. **Expected Result**: Registration succeeds with HTTP 201 Created. The user is automatically assigned `ROLE_STUDENT` and redirected immediately to the Student Submission Dashboard (`/student`).
4. **Talking Point**:
   > *"The server parsed the student ID pattern `N210001` and automatically granted the `STUDENT` role without any client intervention."*

#### Step 1.3: Google OAuth 2.0 Login (Zero-JWT in URL)
1. In Window A (Standard), navigate to `http://localhost:5173/login`.
2. Click **"Sign in with Google"**.
3. Select an institutional faculty/admin Google account (e.g., `uday@rguktn.ac.in` or whitelisted admin email).
4. Direct evaluators' attention to the browser address bar during redirection:
   - Address bar briefly displays: `http://localhost:5173/oauth2/callback?code=...`
   - Note that **NO JWT** appears in the URL.
5. React instantly exchanges the 60-second code via POST and navigates to the Teacher/Admin Dashboard.
6. **Talking Point**:
   > *"Notice the address bar during OAuth redirect. We implemented an ephemeral single-use code exchange protocol. The JWT is never exposed in the URL, preventing token leakage in browser history and proxy server logs."*

---

### Phase 2: Student Laboratory Submission & Security Inspection (2 Minutes)

#### Step 2.1: Pre-Filled Metadata & Form Validation
1. Switch to Window B (Student: `N210001`).
2. Show that the Student ID field is **pre-filled** with `N210001` from the profile.
3. Select:
   - Academic Year: `E1`
   - Week: `Week 1`
   - Section: `Section 2`
   - Branch: `Computer Science & Engineering (CSE)`

#### Step 2.2: Deep Magic Byte Inspection (Blocking Disguised Executable)
1. In the file dropzone, drag and drop `disguised_malware.c` (a compiled executable renamed to `.c`).
2. Click **"Submit Assignment"**.
3. **Expected Result**: The backend rejects the file with an error alert: *"Disguised Windows executable binary detected."*
4. **Talking Point**:
   > *"To protect our institutional servers and faculty laptops, our `SubmissionService` inspects the initial raw bytes of the file stream. Even though this file had a `.c` extension, the backend detected the Windows PE `MZ` magic header and immediately aborted the upload."*

#### Step 2.3: Valid Multi-File Submission & Revision Increment
1. Clear the dropzone and select valid files: `sample_solution.c` and `sample_report.pdf`.
2. Click **"Submit Assignment"**.
3. **Expected Result**: Success alert: *"Submission uploaded successfully!"* The submission appears in the history table below with **Version: v1**.
4. Now, without changing the dropdowns, upload an updated version of `sample_solution.c` and click **"Submit Assignment"** again.
5. **Expected Result**: The system detects the duplicate submission for Week 1, prompts or auto-increments to **Version: v2**, and cleans up previous files from storage.
6. **Talking Point**:
   > *"Notice the revision counter updated to `v2`. The system avoids orphaned files by automatically purging older files from Backblaze B2 cloud storage while preserving the version audit trail."*

---

### Phase 3: Teacher Evaluation Grid, Inline PDF & KaTeX Formulas (2.5 Minutes)

#### Step 3.1: Interactive Evaluation Grid Navigation
1. Switch to Window A (Teacher/Admin).
2. Navigate to `http://localhost:5173/teacher`.
3. Highlight the dynamic multi-week spreadsheet grid:
   - Show student rows with names, IDs, and avatars.
   - Show dynamic week columns (`Week 1`, `Week 2`, `Week 3`...).
   - Show instantaneous rendering backed by our Stale-While-Revalidate (SWR) in-memory cache.

#### Step 3.2: Inline PDF Viewing (PDF.js)
1. Click on the score cell for student `N210001` in `Week 1`.
2. Click **"View Submitted PDF"**.
3. **Expected Result**: An inline PDF viewer renders the student's lab report directly on screen.
4. **Talking Point**:
   > *"Faculty do not need to download hundreds of files to their computers. Our backend streams the PDF directly from Backblaze B2 S3 storage, and our frontend renders it on an HTML5 canvas using Mozilla's PDF.js."*

#### Step 3.3: KaTeX Math Rendering & Teacher Feedback
1. In the student evaluation detail view, point out the mathematical formulas rendered in the observation report (e.g., recurrence relation $T(n) = 2T(n/2) + \mathcal{O}(n)$).
2. Scroll to the **"Faculty Feedback & Review"** section:
   - Type feedback: *"Clean C logic; ensure variable names adhere to departmental coding guidelines."*
   - Toggle **Reviewed**: `Yes`.
   - Click **"Save Feedback"**.
3. **Expected Result**: Feedback saved confirmation. Show that human teacher feedback is stored independently and preserved across automated AI re-evaluations.

---

### Phase 4: Batch Report Emailing & Safe Override Mode (2 Minutes)

#### Step 4.1: Recipient Filtering & Preview
1. Navigate to `http://localhost:5173/email-reports`.
2. Direct attention to the status banner: *"Backend Transport: GMAIL_REST_API (Port 443 — Render Free Tier Compatible)"*.
3. Set filters:
   - Academic Year: `E1`
   - Week: `Week 1`
   - Section: `2`
4. The candidate recipient list automatically populates with matching students.

#### Step 4.2: Safe Test Email Dispatch
1. Switch to the **"Settings / Test Center"** tab or `http://localhost:5173/email-tests`.
2. Select **"Test Override Mode"**.
3. Set **Target Override Email** to your own faculty/personal email address.
4. Click **"Send Test Report"**.
5. **Expected Result**: Progress bar reaches 100%, and green success confirmation displays Gmail Message ID.
6. Open your email inbox in a separate tab: Show the received email with styled RGUKT header, criterion score table, and attached report.
7. **Talking Point**:
   > *"Notice how the email arrived instantly. Because we use Google's Gmail REST API over standard HTTPS Port 443, our mailer completely bypasses cloud provider firewall restrictions that block SMTP ports."*

---

### Phase 5: Administrative Console & Governance Guards (1.5 Minutes)

#### Step 5.1: KPI Metrics & User Management
1. Navigate to `http://localhost:5173/admin`.
2. Review the top KPI cards: Total Users, Students, Teachers, Admins, and Submissions.
3. In the user search bar, type `N210001` to show instantaneous client filtering.

#### Step 5.2: Demonstrate Last Admin Demotion Guard
1. Locate an Administrator account.
2. Click the Action menu and select **"Edit Role"**.
3. Attempt to change the role from `ADMIN` to `STUDENT`.
4. If it is the sole remaining administrator, the backend rejects the request: *"Cannot demote the final remaining administrator."*
5. **Talking Point**:
   > *"Defensive programming guards prevent administrative lockouts. The system actively verifies administrator counts before permitting role modifications."*

---

## 3. Demo Contingency & Troubleshooting Guide

| Issue / Failure | Quick Diagnostic | Emergency Fix During Demo |
| :--- | :--- | :--- |
| **Backend fails to start: Port 8080 in use** | A previous instance is lingering. | Open PowerShell: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess -Force` |
| **MySQL connection refused** | Docker container is stopped. | Run: `docker compose up -d` in project root; wait 5 seconds. |
| **Google Sign-In fails: `redirect_uri_mismatch`** | Google Cloud Console authorized redirect URI does not match current host. | Use local email/password login (`n210001@rguktn.ac.in`) or update authorized redirect URI in Google Cloud Console. |
| **Email fails to send: SMTP timeout** | Local network or ISP is blocking port 587. | Switch to Gmail REST API by ensuring `GMAIL_REFRESH_TOKEN` is set, or run email test in offline mock mode. |
| **Vite frontend shows blank screen** | Dependency cache or node process stuck. | Stop terminal (`Ctrl + C`) and restart: `npm run dev`. |
