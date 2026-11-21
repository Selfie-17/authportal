# Screenshot Collection & Visual Demonstration Guide

---

## 1. Overview & Presentation Strategy

High-scoring academic presentations and viva defenses rely on visual proof rather than text-heavy slides. This guide outlines the **12 essential screenshots** required for your PowerPoint presentation and project report.

For each screenshot, this document details:
1. **Screen Name & Slide Target**: Where it fits into the 15-slide PowerPoint deck.
2. **Access Route & Required Role**: Exactly how to navigate to the screen in the running application.
3. **Key Visual Elements**: What specific components, data, and UI elements must be visible.
4. **Pedagogical & Technical Significance**: What engineering capability it proves to the evaluators.
5. **Callout / Annotation Recommendations**: How to highlight key areas using arrows or bounding boxes in PowerPoint.

---

## 2. Master Screenshot Catalog

---

### Screenshot 1: Dual Institutional Authentication Screen
* **Slide Target**: Slide 9 (Institutional Authentication & Zero-JWT Security)
* **URL / Route**: `http://localhost:5173/login`
* **Required Role / State**: Unauthenticated / Public
* **What Should Be Visible**:
  - The login card with RGUKT branding and institutional badge.
  - The prominent **"Sign in with Google"** button with official Google SVG icon.
  - The email/password login form with institutional placeholder (`n210001@rguktn.ac.in`).
  - Navigation tab or link to "Register Institutional Account".
* **Technical Significance**:
  - Proves dual-authentication capability (Google OAuth 2.0 / OpenID Connect + Local BCrypt).
  - Demonstrates that only institutional identity formats are encouraged.
* **Suggested Annotation**: Put a red highlight box around the "Sign in with Google" button and add a callout box: *"Initiates OAuth 2.0 with Single-Use Code Exchange (Zero-JWT in URL)"*.

---

### Screenshot 2: Student Laboratory Submission Interface
* **Slide Target**: Slide 10 (Student Laboratory Submission & Security Inspection)
* **URL / Route**: `http://localhost:5173/student`
* **Required Role / State**: Role: `STUDENT` (e.g., logged in as `N210001@rguktn.ac.in`)
* **What Should Be Visible**:
  - Auto-derived Student ID field (pre-filled as `N210001`).
  - Dropdown selectors for Academic Year (`E1`), Week (`Week 1` to `Week 12`), and Section (`1` to `6`).
  - Branch selection badge (`Computer Science & Engineering (CSE)`).
  - The drag-and-drop `FileUploadZone` component showing accepted file formats (`.c`, `.pdf`).
  - The file limit notice (`Max 20MB per file`).
* **Technical Significance**:
  - Demonstrates automated student profile derivation from verified institutional email.
  - Shows clear constraints enforcing structured assignment submission metadata.
* **Suggested Annotation**: Highlight the pre-filled Student ID and File Dropzone with an annotation: *"Auto-derived ID & Multi-file Upload Engine (.c + .pdf)"*.

---

### Screenshot 3: Student Submission History & Revision Tracking
* **Slide Target**: Slide 10 (Student Laboratory Submission & Security Inspection)
* **URL / Route**: `http://localhost:5173/student` (lower half of page)
* **Required Role / State**: Role: `STUDENT`
* **What Should Be Visible**:
  - "My Submissions" history table.
  - Table headers: Week, Year, Section, Branch, Version / Revision, Submission Date, Files, Actions.
  - At least one submission showing **Version: v2** (demonstrating revision incrementation).
  - Individual file badges with download buttons (`main.c`, `lab_report.pdf`).
  - The red "Delete Submission" button.
* **Technical Significance**:
  - Proves revision tracking (`v1 -> v2`) and self-service deletion with physical file purging.
  - Demonstrates secure file downloads restricted to the owning student.
* **Suggested Annotation**: Arrow pointing to the `Version: v2` badge with text: *"Automated Revision Tracking: Increments version & cleans up obsolete files"*.

---

### Screenshot 4: Teacher Evaluation Dynamic Spreadsheet Grid
* **Slide Target**: Slide 11 (Teacher Evaluation Grid & AI Multi-Provider Support)
* **URL / Route**: `http://localhost:5173/teacher`
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - The interactive evaluation grid matrix.
  - Rows representing unique Student IDs (with names and profile pictures).
  - Dynamic column headers representing evaluation weeks (`Week 1`, `Week 2`, `Week 3`...).
  - Grid cells displaying numerical scores (e.g., `85/100`, `92/100`) with color-coded status badges.
  - Top filter bar: Engineering Year, Section, Search input, and "Refresh Grid" button.
* **Technical Significance**:
  - Visual proof of dynamic multi-week matrix generation from database evaluation records.
  - Demonstrates fast client-side rendering backed by SWR memory caching.
* **Suggested Annotation**: Bracket enclosing the dynamic week columns with note: *"Dynamic Multi-Week Discovery & Instant SWR In-Memory Rendering"*.

---

### Screenshot 5: Inline PDF Lab Report Viewer
* **Slide Target**: Slide 11 (Teacher Evaluation Grid & AI Multi-Provider Support)
* **URL / Route**: `http://localhost:5173/teacher` (click any student score cell)
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - Split-screen or full modal view displaying the student's actual uploaded PDF lab report.
  - PDF navigation controls (Page 1 of N, Zoom In, Zoom Out, Download PDF).
  - PDF.js rendering canvas showing student code snippets, circuit diagrams, or written methodology.
* **Technical Significance**:
  - Proves direct streaming integration between Backblaze B2 S3 storage and browser PDF.js canvas.
  - Eliminates the need for faculty to download hundreds of PDFs to their local machines.
* **Suggested Annotation**: Callout on the PDF canvas: *"Inline PDF.js Rendering: Direct Stream from Backblaze B2 S3 Storage (Zero Server Disk Staging)"*.

---

### Screenshot 6: AI Evaluation Report Breakdown with KaTeX Formulas
* **Slide Target**: Slide 11 (Teacher Evaluation Grid & AI Multi-Provider Support)
* **URL / Route**: `http://localhost:5173/teacher` (Report Detail tab/modal)
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - Single-student evaluation rubric card (`SingleStudentReportResponse`).
  - Breakdown of individual scores: Objective of Lab, Problem Understanding, Logic/Approach, Important Variables, Observations.
  - Model provider badge (e.g., `Provider: Gemini 1.5 Pro` or `Provider: Ollama`).
  - Mathematical formulas rendered via KaTeX (e.g., algorithmic time complexity $\mathcal{O}(n \log n)$ or mathematical equations).
  - Teacher feedback textarea with "Reviewed" toggle switch.
* **Technical Significance**:
  - Proves multi-provider AI evaluation ingestion and KaTeX LaTeX rendering.
  - Shows human-in-the-loop qualitative feedback persistence.
* **Suggested Annotation**: Highlight KaTeX mathematical equations and the provider badge: *"KaTeX LaTeX Typography & Decoupled Human Teacher Feedback"*.

---

### Screenshot 7: Batch Submissions Structured ZIP Download
* **Slide Target**: Slide 13 (Administrative Governance & Cloud Storage)
* **URL / Route**: `http://localhost:5173/teacher` (Filter panel)
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - The "Download Section ZIP" button clicked.
  - Browser download bar showing the active download of `week-1-sec-2.zip`.
  - Inset image: Windows Explorer / File Manager showing the extracted ZIP folder structure:
    ```text
    week-1-sec-2/
    ├── N210001/
    │   ├── main.c
    │   └── report.pdf
    └── N210002/
        ├── solution.c
        └── report.pdf
    ```
* **Technical Significance**:
  - Proves on-the-fly streaming ZIP generation without server disk caching.
  - Shows structured directory organization by Student ID for faculty offline grading.
* **Suggested Annotation**: Callout pointing to extracted subfolders: *"On-the-fly Streaming ZIP Generation: Zero temporary files on server hard drive"*.

---

### Screenshot 8: Email Reports Distribution Center (Batch Sender)
* **Slide Target**: Slide 12 (Cloud-Resilient Dual Mailer & Batch Dispatcher)
* **URL / Route**: `http://localhost:5173/email-reports`
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - Top status banner: "Backend Transport: GMAIL_REST_API (Port 443 — Render Free Tier Compatible)".
  - Recipient filter bar: Academic Year (`E2`), Week (`Week 4`), Branch (`CSE`), Section (`1`).
  - Selected recipients table showing detected student IDs, student names, and institutional emails.
  - Email Composer showing editable subject line and faculty announcement message.
  - Attachment toggles: "Attach HTML Report", "Attach Evaluation Summary".
  - The primary action button: "Send Batch to Selected Students".
* **Technical Significance**:
  - Proves cohort filtering and real-time candidate recipient preview.
  - Demonstrates customizable batch email composition.
* **Suggested Annotation**: Highlight the transport status banner: *"Active Transport: Google Gmail REST API (v1) over HTTPS Port 443"*.

---

### Screenshot 9: Batch Email Real-Time Progress & Audit History
* **Slide Target**: Slide 12 (Cloud-Resilient Dual Mailer & Batch Dispatcher)
* **URL / Route**: `http://localhost:5173/email-reports` (History tab)
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - Email Batch Campaigns table.
  - Summary metrics: Total Recipients (e.g., `45`), Sent (`45`), Failed (`0`), Status (`COMPLETED`).
  - Expanded recipient breakdown showing individual students with green `SENT` badges and Gmail Message IDs.
  - One-click "Retry Failed" button.
* **Technical Significance**:
  - Proves 1-to-N batch tracking via `email_batches` and `email_batch_recipients`.
  - Shows granular audit logging and delivery verification.
* **Suggested Annotation**: Arrow pointing to the green `SENT` badges: *"Per-Student Delivery State Tracking with Gmail Message-ID Verification"*.

---

### Screenshot 10: Email Testing Center & Safe Override Mode
* **Slide Target**: Slide 12 (Cloud-Resilient Dual Mailer & Batch Dispatcher)
* **URL / Route**: `http://localhost:5173/email-tests`
* **Required Role / State**: Role: `TEACHER` or `ADMIN`
* **What Should Be Visible**:
  - ZIP Report Analyzer section with uploaded file `lab_notebook_reports.zip`.
  - Dispatch Mode toggle: "Test Override Mode (Send all reports to faculty test email)".
  - Target override email input field populated with instructor's email (`faculty@rguktn.ac.in`).
  - Parsed reports preview table showing extracted student IDs and scores.
  - "Send Test Batch" button.
* **Technical Significance**:
  - Demonstrates ZIP archive report parsing and automated student ID extraction.
  - Shows safe testing fail-safes preventing accidental mass spamming to students during lab tests.
* **Suggested Annotation**: Highlight the Target Override field: *"Safe Test Override: Redirects real student reports to faculty inbox for rendering verification"*.

---

### Screenshot 11: Rendered Academic Evaluation Email in Gmail Inbox
* **Slide Target**: Slide 12 (Cloud-Resilient Dual Mailer & Batch Dispatcher)
* **URL / Route**: Gmail Web Client (`mail.google.com`)
* **Required Role / State**: Recipient Student / Faculty Inbox
* **What Should Be Visible**:
  - Actual delivered email opened in Gmail.
  - Sender: "RGUKT Academic Portal <no-reply@rguktn.ac.in>".
  - Subject: "Lab Evaluation Report - Week 4 - N210001".
  - Beautifully formatted HTML email template with RGUKT blue header, student name, ID, criterion score table, total marks, and attached evaluation HTML/PDF file.
* **Technical Significance**:
  - Concrete visual proof of end-to-end email dispatch, HTML styling, and attachment delivery.
  - Proves deliverability to institutional inboxes.
* **Suggested Annotation**: Put a box around the formatted score table and attachment badge: *"Styled HTML Report Dispatched via Gmail REST API (Port 443)"*.

---

### Screenshot 12: Administrative Console & User Governance
* **Slide Target**: Slide 13 (Administrative Governance & Cloud Storage)
* **URL / Route**: `http://localhost:5173/admin`
* **Required Role / State**: Role: `ADMIN`
* **What Should Be Visible**:
  - Top KPI stat cards: Total Users (e.g., `124`), Students (`112`), Teachers (`8`), Administrators (`4`), Submissions (`340`).
  - User Management Directory table with search bar and Role dropdown filter.
  - User row displaying Name, Email, Role badge (`ADMIN`, `TEACHER`, `STUDENT`), Status toggle (`Active`), and Action menu.
  - Role update modal showing role selector and safety warnings.
* **Technical Significance**:
  - Demonstrates institutional oversight, role modification guards, and account lifecycle management.
* **Suggested Annotation**: Highlight the Admin KPI cards and User Actions menu: *"System Analytics & User Governance with Last Admin Protection Guards"*.

---

## 3. Step-by-Step Instructions for Capturing Screenshots

To capture clean, presentation-ready screenshots:

1. **Start the Local Environment**:
   - Launch MySQL: `docker compose up -d`
   - Start Spring Boot Backend: `cd authportal && mvn spring-boot:run`
   - Start React Frontend: `cd frontend && npm run dev`
2. **Use Standard Browser Resolution**:
   - Maximize browser window at **1920x1080** (1080p Full HD) on Chrome or Edge.
   - Set zoom level to **100%**.
   - Use browser Incognito / Clean profile to avoid clutter from browser extensions or personal bookmarks.
3. **Capture Clean Toolbars**:
   - Use the Windows Snipping Tool (`Win + Shift + S`) or browser full-page capture (`Ctrl + Shift + P` -> "Capture full size screenshot" in Chrome DevTools).
   - Crop cleanly to include the application header, navigation bar, and main content area.
4. **Data Realism**:
   - Use real institutional student IDs (e.g., `N210001`, `N210002`, `R210015`).
   - Do not use test strings like `test1234` or placeholder names like `asdf`.
