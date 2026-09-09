# RGUKTN Academic & Authentication Portal

A production-grade, secure full-stack platform built with **Java 21**, **Spring Boot**, **Spring Security**, **Google OAuth 2.0 / OpenID Connect**, **JWT**, **Spring Data JPA / Hibernate**, **MySQL**, **Flyway**, and a modern **React 19 + Vite** frontend.

Designed specifically for academic environments, the portal provides institutional authentication, automated role-based access control, laboratory assignment submission and revision management, teacher evaluation grids with report ingestion, and an administrative console.

---

## Table of Contents

1. [Key Features & Capabilities](#key-features--capabilities)
   - [Authentication & Role Resolution](#1-authentication--role-resolution)
   - [Student Lab Submission Engine](#2-student-lab-submission-engine)
   - [Teacher Evaluation & Lab Oversight](#3-teacher-evaluation--lab-oversight)
   - [Administrative Control Console](#4-administrative-control-console)
   - [User Profile Management](#5-user-profile-management)
2. [Project Structure](#project-structure)
3. [Architecture & Authentication Flows](#architecture--authentication-flows)
   - [Local Registration & Login Flow](#local-registration--login-flow)
   - [Google OAuth 2.0 / OIDC Flow (Zero-JWT in URL)](#google-oauth-20--oidc-flow-zero-jwt-in-url)
4. [Tech Stack](#tech-stack)
5. [Database Schema & Migrations](#database-schema--migrations)
6. [File Storage Architecture](#file-storage-architecture)
7. [Environment Variables](#environment-variables)
8. [Google Cloud OAuth 2.0 Setup](#google-cloud-oauth-20-setup)
9. [Running Locally](#running-locally)
   - [1. Database Setup (Docker Compose or Native)](#1-database-setup-docker-compose-or-native)
   - [2. Backend Setup & Run](#2-backend-setup--run)
   - [3. Frontend Setup & Run](#3-frontend-setup--run)
10. [Running Automated Tests](#running-automated-tests)
11. [REST API Reference](#rest-api-reference)
    - [Authentication Endpoints (`/api/auth`)](#authentication-endpoints-apiauth)
    - [Profile Endpoints (`/api/profile`)](#profile-endpoints-apiprofile)
    - [Submission Endpoints (`/api/submissions`)](#submission-endpoints-apisubmissions)
    - [Teacher Evaluation Endpoints (`/api/teacher/evaluations`)](#teacher-evaluation-endpoints-apiteacherevaluations)
    - [Admin Console Endpoints (`/api/admin`)](#admin-console-endpoints-apiadmin)
    - [Health & Diagnostics](#health--diagnostics)
12. [Production Deployment Guide](#production-deployment-guide)

---

## Key Features & Capabilities

### 1. Authentication & Role Resolution

* **Dual Authentication**: Seamlessly supports both Google OAuth 2.0 / OpenID Connect and traditional email/password credentials with BCrypt password hashing.
* **Server-Side Role Determination**: Eliminates client privilege escalation. Roles (`STUDENT`, `TEACHER`, `ADMIN`) are strictly determined server-side from institutional email addresses:
  * **Student Regex Validation**: Matches `^[Nn]\d{6}@rguktn\.ac\.in$` (e.g., `N210921@rguktn.ac.in`).
  * **Teacher Allowlist**: Restricts `TEACHER` roles to explicitly approved institutional faculty emails via `TEACHER_ALLOWED_EMAILS`.
  * **Admin Protection**: The `ADMIN` role can never be self-selected or created via public registration. Existing `ADMIN` privileges are preserved across all login mechanisms.
* **Zero-JWT in URL (Single-Use Exchange Code)**: On Google OAuth redirect, the backend issues a short-lived (60s), single-use exchange code to the frontend callback. The frontend exchanges this code via a secure POST request to obtain the JWT in the JSON body, preventing token leakage through browser history, referrer headers, or proxy logs.
* **Safe Account Linking**: If a user previously registered via email/password logs in with a verified Google institutional account, the backend links the Google identity safely without downgrading roles or duplicating user records.
* **Stateless JWT Security**: HMAC-SHA256 tokens carry subject identity, roles, and user metadata for stateless session verification.

---

### 2. Student Lab Submission Engine

* **Auto-Derived Student ID**: Automatically pre-fills the student ID from the user's institutional email (e.g. `n210921@rguktn.ac.in` $\rightarrow$ `N210921`) while allowing manual correction if necessary.
* **Multi-File Uploads**: Supports uploading `.c` source code files and `.pdf` lab reports for specific Week (1–12), Year Level (E1–E4), and Section (1–6).
* **Deep Content & Executable Inspection**:
  * Blocks binary executables even if disguised with `.c` or `.pdf` extensions (inspects magic bytes for Windows PE `MZ`, Linux ELF `\x7FELF`, and Mach-O headers).
  * Validates `%PDF-` file signature for PDF reports.
  * Enforces maximum 20MB per file and up to 20 files per submission.
* **Revision Tracking & Duplicate Handling**: When a student re-submits for the same week and section, the system increments the revision counter (`v1` $\rightarrow$ `v2`...), cleans up old files, and stores new files under the same directory.
* **Submission Deletion**:
  * Students can permanently delete their own submissions either directly from the "Existing submission detected" warning banner or from their submission history table.
  * **Strict Authorization**: Students may only delete their own submissions (`403 Forbidden` if attempting to delete another student's submission).
  * **Physical Purge**: Deletion removes the submission record and all associated file records from MySQL and permanently removes the student's submission directory from disk.
* **Secure File Downloads**: Authenticated students can download individual submitted files from their history.

---

### 3. Teacher Evaluation & Lab Oversight

* **Multi-Criteria Submission Filtering**: Search and filter student submissions across Week (1–12), Year Level (E1–E4), Section (1–6), and Student ID.
* **Structured ZIP Batch Downloads**: Stream an entire section or week's submissions as a ZIP archive preserving clean directory hierarchies:
  ```text
  week-1-sec-2.zip
  └── week-1-sec-2/
      ├── N210001/
      │   ├── main.c
      │   └── report.pdf
      └── N210002/
          ├── solution.c
          └── report.pdf
  ```
* **Interactive Evaluation Grid**:
  * Dynamic student rows (one row per Student ID).
  * Dynamic week columns generated from uploaded evaluation data.
  * Displays criteria scores, total scores, final scores, and assessments.
* **Report Ingestion (JSON & CSV/Excel)**:
  * Ingest evaluation reports produced by grading tools or automated rubrics.
  * Automatically extracts standard rubric criteria: *Objective of the Lab*, *Problem Understanding*, *Logic/Approach Used*, *Important Variables*, *What I Observed*, *Total Score*, and *Overall Assessment*.
* **Human Teacher Feedback**:
  * Teachers can enter manual feedback comments and toggle review status for each student and week.
  * Teacher feedback is maintained independently and preserved across re-evaluations.

---

### 4. Administrative Control Console

* **System Overview & Metrics**: Real-time KPI cards displaying Total Users, Students, Teachers, Administrators, and Total Submissions.
* **User Management**:
  * Search users by name or email with role filters (`ALL`, `STUDENT`, `TEACHER`, `ADMIN`).
  * Direct user provisioning with administrative role assignment.
  * Role modification with safety guards preventing demotion of the final administrator.
  * Account status toggle (Enable/Disable) preventing admins from disabling their own account or disabling the final administrator.
* **Submission Oversight**: View all portal submissions across all students with filters, and permanently delete submissions and files if required.

---

### 5. User Profile Management

* View user account details, institutional email, current role, and authentication provider.
* Update personal details (e.g. display name).
* Secure password change with verification of current password and confirmation checks.

---

## Project Structure

```text
authportal/
├── .env.example                     # Root environment configuration template
├── docker-compose.yml               # MySQL 8 service for local development
├── render.yaml                      # Render Blueprint deployment definition
├── storage/                         # Local filesystem storage root for submissions
│   └── submissions/
│       └── week-{w}/
│           └── sec-{s}/
│               └── {studentId}/     # Physical submission files
│
├── authportal/                      # Spring Boot 4 / Java 21 Backend
│   ├── Dockerfile                   # Multi-stage Docker container build
│   ├── pom.xml                      # Maven dependencies and build plugins
│   └── src/
│       ├── main/
│       │   ├── java/com/selva/authportal/
│       │   │   ├── AuthportalApplication.java
│       │   │   ├── config/          # SecurityConfig, PasswordEncoderConfig, WebConfig
│       │   │   ├── controller/      # REST API Controllers (Auth, Submission, Teacher, Admin, Profile)
│       │   │   ├── dto/             # Request / Response DTO records and classes
│       │   │   ├── exception/       # GlobalExceptionHandler, Custom domain exceptions
│       │   │   ├── model/           # JPA Entities (User, Submission, SubmissionFile, StudentEvaluation, TeacherFeedback)
│       │   │   ├── repository/      # Spring Data JPA Repositories & Specifications
│       │   │   ├── security/        # JWT AuthenticationFilter, CustomUserDetails, EmailRoleResolver
│       │   │   │   └── oauth2/      # OAuth2SuccessHandler, CustomOAuth2UserService
│       │   │   └── service/         # Core Services (Auth, Submission, Storage, Evaluation, Admin, ZipArchive, Profile)
│       │   └── resources/
│       │       ├── application.properties
│       │       └── db/migration/    # Flyway SQL migrations (V1 to V4)
│       └── test/                    # 121+ Automated unit, integration, and security tests
│
└── frontend/                        # React 19 + Vite Frontend SPA
    ├── package.json                 # Frontend scripts and dependencies
    ├── vite.config.js               # Vite configuration
    └── src/
        ├── App.jsx                  # Client routing and ProtectedRoute role guards
        ├── main.jsx                 # React root entry point
        ├── components/              # Shared components (Navbar, FileUploadZone)
        ├── config/                  # API endpoints and base URL configuration
        ├── pages/                   # Application Pages
        │   ├── LoginPage.jsx
        │   ├── RegisterPage.jsx
        │   ├── OAuthCallbackPage.jsx
        │   ├── StudentSubmissionPage.jsx
        │   ├── TeacherSubmissionsPage.jsx
        │   ├── AdminDashboardPage.jsx
        │   └── ProfilePage.jsx
        ├── services/                # API client services (authService, submissionService, adminService, etc.)
        └── styles/                  # Clean modern CSS stylesheets (portal.css, auth.css, index.css)
```

---

## Architecture & Authentication Flows

### Local Registration & Login Flow

```text
React Client                               Spring Boot Backend                          MySQL Database
    │                                              │                                          │
    ├─── POST /api/auth/register ─────────────────►│                                          │
    │    (name, email, password)                   ├── Normalize email                        │
    │    [NO role accepted from client]            ├── Validate institutional email domain    │
    │                                              ├── Resolve Role (STUDENT / TEACHER)       │
    │                                              ├── Verify uniqueness ────────────────────►│
    │                                              ├── BCrypt.hash(password)                  │
    │                                              ├── Save User ────────────────────────────►│
    │                                              ├── Generate JWT (sub, role, userId)       │
    │◄── 201 Created (AuthResponse with JWT) ──────┤                                          │
    │                                              │                                          │
    ├─── POST /api/auth/login ────────────────────►│                                          │
    │    (email, password)                         ├── Query user by email ──────────────────►│
    │                                              ├── BCrypt.matches()                       │
    │                                              ├── Verify enabled status                  │
    │                                              ├── Generate JWT                           │
    │◄── 200 OK (AuthResponse with JWT) ───────────┤                                          │
```

### Google OAuth 2.0 / OIDC Flow (Zero-JWT in URL)

```text
Browser / React Client                  Spring Boot OAuth Backend                   Google OAuth 2.0
    │                                              │                                       │
    ├─── Click "Sign in with Google" ─────────────►│                                       │
    │    GET /oauth2/authorization/google          ├── Redirect to Google Consent ────────►│
    │                                              │                                       │
    │                                              │◄── Authenticate & Authorization Code ─┤
    │                                              │    (Google sends code to /login/oauth2/code/google)
    │                                              ├── Verify OIDC Token & Identity ──────►│
    │                                              ├── Extract verified email              │
    │                                              ├── Validate @rguktn.ac.in domain       │
    │                                              ├── If existing user: Preserve Role     │
    │                                              │   If new user: Resolve Role           │
    │                                              ├── Provision or Link user in DB        │
    │                                              ├── Generate One-Time Code (60s TTL)    │
    │◄── 302 Redirect to Frontend ─────────────────┤                                       │
    │    ${FRONTEND_URL}/oauth2/callback?code=xyz  │                                       │
    │    [ZERO JWT IN REDIRECT URL]                │                                       │
    │                                              │                                       │
    ├─── POST /api/auth/oauth2/exchange ──────────►│                                       │
    │    { "code": "xyz" }                         ├── Verify & burn exchange code         │
    │                                              ├── Generate application JWT            │
    │◄── 200 OK (AuthResponse with JWT) ───────────┤                                       │
```

---

## Tech Stack

### Backend
* **Language & Runtime**: Java 21
* **Framework**: Spring Boot 4.0.8 / 3.4.x
* **Security**: Spring Security 6.x (Stateless session management, `@PreAuthorize` method security, BCrypt)
* **OAuth 2.0**: Spring Security OAuth2 Client (Google OpenID Connect)
* **JWT**: JJWT (`io.jsonwebtoken` 0.12.6)
* **Database**: MySQL 8.0
* **Persistence**: Spring Data JPA / Hibernate (DDL validation mode)
* **Migrations**: Flyway (`flyway-core`, `flyway-mysql`)
* **File Storage**: Local filesystem with atomic write and recursive cleanup
* **Build Tool**: Maven

### Frontend
* **Core**: React 19, JavaScript (ES Modules)
* **Routing**: React Router DOM 7
* **Build Tool & Dev Server**: Vite 6
* **Styling**: Vanilla CSS with custom design system, glassmorphism accents, and responsive layout tokens

---

## Database Schema & Migrations

Database schema updates are managed through Flyway scripts in `authportal/src/main/resources/db/migration/`:

| Migration | File | Description |
| :--- | :--- | :--- |
| **V1** | `V1__create_users_table.sql` | Creates `users` table with indexes on `email`, `google_id`, and `role`. |
| **V2** | `V2__create_submissions_tables.sql` | Creates `submissions` and `submission_files` tables with foreign keys and unique constraint on `(user_id, week, year, section)`. |
| **V3** | `V3__create_student_evaluations_tables.sql` | Creates `student_evaluations` and `teacher_feedback` tables with unique keys on `(student_id, week)`. |
| **V4** | `V4__expand_evaluation_score_columns.sql` | Expands criterion score columns in evaluations for extended grading precision. |
| **V5** | `V5__add_drive_file_id.sql` | Adds nullable `drive_file_id` column to `submission_files` for direct Google Drive object lookup. |
| **V6** | `V6__add_storage_key_to_submission_files.sql` | Adds provider-neutral `storage_key` column to `submission_files` for S3 / Backblaze object identification. |

---

## File Storage Architecture

The portal employs a pluggable, storage-agnostic architecture (`StorageService`) supporting:
- **Local Filesystem (`STORAGE_TYPE=local`, default)**: Stores files on disk under `STORAGE_PATH` (default: `storage/`). Perfect for local development, offline workflows, and automated test isolation with zero external credentials.
- **Backblaze B2 (`STORAGE_TYPE=backblaze`)**: Production cloud storage connecting to Backblaze B2 via its S3-compatible API using AWS SDK for Java v2 (`software.amazon.awssdk:s3`). Streams files directly to/from a private bucket (`B2_BUCKET_NAME`) using deterministic object keys.

```text
storage/ (or Backblaze B2 bucket: rguktn-academic-portal)
└── submissions/
    └── week-{week}/
        └── sec-{section}/
            └── {studentId}/
                ├── main.c
                └── report.pdf
```

### Key Principles

* **Aiven MySQL**: Stores relational metadata (student ID, week, section, revision, original/stored filename, file size, MIME type, marks, and provider-neutral `storage_key`).
* **Physical Storage (Local or Backblaze B2)**: Stores raw `.c` source code and `.pdf` report bytes using the canonical storage key `submissions/week-{w}/sec-{s}/{studentId}/{filename}`.
* **Direct Streaming (Zero Disk Staging)**: Direct uploads and downloads stream through `InputStream` / `ResponseInputStream` directly to/from Backblaze B2 without staging files on Render's ephemeral local disk.
* **Revision Handling**: Resubmission cleans up old objects under the submission's prefix and updates database records with an incremented revision count (`v1` $\rightarrow$ `v2`...).
* **Streaming ZIP Downloads**: Teacher batch ZIPs stream files directly from storage into `ZipOutputStream` on-the-fly, without requiring temporary files on disk.
* **Zero Frontend Changes**: React interacts purely via REST APIs (`POST /api/submissions`, `GET /api/submissions/{id}/files/{fileId}`, `GET /api/submissions/teacher/download-zip`).

---

## Environment Variables

Configure these environment variables in a `.env` file at the project root or export them in your deployment environment:

| Variable | Required | Default / Example | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `8080` | Port for backend REST API server. |
| `DATABASE_URL` | Yes | `jdbc:mysql://localhost:3306/authportal?...` | JDBC connection URL to MySQL database (e.g. Aiven MySQL). |
| `DATABASE_USERNAME` | Yes | `root` | MySQL username. |
| `DATABASE_PASSWORD` | Yes | `root` | MySQL password. |
| `JWT_SECRET` | **Yes** | *(No default - must be 256+ bits)* | Secret HMAC signing key for JWT tokens. |
| `JWT_EXPIRATION` | No | `86400000` (24 hours) | Token validity in milliseconds. |
| `GOOGLE_CLIENT_ID` | Yes | `...apps.googleusercontent.com` | Google Cloud OAuth 2.0 Client ID for user login. |
| `GOOGLE_CLIENT_SECRET` | Yes | `GOCSPX-...` | Google Cloud OAuth 2.0 Client Secret for user login. |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for CORS and OAuth redirect callback. |
| `TEACHER_ALLOWED_EMAILS`| No | `hod.cse@rguktn.ac.in,dean@rguktn.ac.in` | Comma-separated allowlist of approved institutional teacher emails. |
| `STORAGE_TYPE` | No | `local` | Storage provider: `local` (filesystem) or `backblaze` (Backblaze B2 S3 API). |
| `STORAGE_PATH` | No | `storage` | Base path for local disk storage (when `STORAGE_TYPE=local`). |
| `B2_ENDPOINT` | When `backblaze` | `https://s3.us-east-005.backblazeb2.com` | Backblaze B2 S3-compatible endpoint URL. |
| `B2_BUCKET_NAME` | When `backblaze` | `rguktn-academic-portal` | Backblaze B2 private bucket name. |
| `B2_KEY_ID` | When `backblaze` | *(secret)* | Backblaze B2 Application Key ID (AWS Access Key ID equivalent). |
| `B2_APPLICATION_KEY` | When `backblaze` | *(secret)* | Backblaze B2 Application Key (AWS Secret Access Key equivalent). |
| `B2_REGION` | No | `us-east-005` | Backblaze B2 S3 region matching your endpoint. |
| `VITE_API_BASE_URL` | No | `http://localhost:8080` | Frontend environment variable pointing to backend API. |

---

## Google Cloud OAuth 2.0 Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** > **Credentials**.
3. Click **Create Credentials** > **OAuth client ID**.
4. Select **Web application** as the application type.
5. In **Authorized redirect URIs**, add:
   * **Local Development**:
     ```text
     http://localhost:8080/login/oauth2/code/google
     ```
   * **Production Deployment**:
     ```text
     https://api.yourdomain.com/login/oauth2/code/google
     ```
6. Copy the generated **Client ID** and **Client Secret** into your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## Running Locally

### 1. Database Setup (Docker Compose or Native)

Using Docker Compose from the project root:
```bash
docker compose up -d
```
This launches a MySQL 8 container mapped to port `3306` with the `authportal` database created.

### 2. Backend Setup & Run

1. Navigate to the `authportal` directory:
   ```bash
   cd authportal
   ```
2. Compile and launch the Spring Boot application:
   ```bash
   mvn clean compile
   mvn spring-boot:run
   ```
   The backend will start on `http://localhost:8080`. Flyway migrations execute automatically on startup.

### 3. Frontend Setup & Run

1. Open a separate terminal and navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend runs on `http://localhost:5173`.

---

## Running Automated Tests

The backend includes a comprehensive suite of **121 automated tests** covering controllers, services, security filters, role resolvers, repository specifications, and ZIP archiving. Tests use an isolated H2 in-memory database with zero external dependencies.

Run all tests:
```bash
cd authportal
mvn test
```

Run targeted submission tests:
```bash
mvn test -Dtest=SubmissionServiceTest,SubmissionControllerTest
```

Build and test frontend:
```bash
cd frontend
npm run build
```

---

## REST API Reference

### Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register student or teacher with institutional email. |
| `POST` | `/api/auth/login` | Public | Login with email and password, returning JWT. |
| `POST` | `/api/auth/oauth2/exchange` | Public | Exchange single-use Google OAuth code for JWT. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile. |
| `POST` | `/api/auth/logout` | Authenticated | Stateless client logout acknowledgement. |

#### Register Request Body
```json
{
  "name": "Selva Kumar",
  "email": "n210921@rguktn.ac.in",
  "password": "StrongPassword123!"
}
```

#### Auth Response Payload
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": 1,
    "name": "Selva Kumar",
    "email": "n210921@rguktn.ac.in",
    "role": "STUDENT",
    "authProvider": "LOCAL",
    "profilePicture": null,
    "enabled": true,
    "createdAt": "2026-09-03T05:53:20Z"
  }
}
```

---

### Profile Endpoints (`/api/profile`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile` | Authenticated | Get profile details for authenticated user. |
| `PUT` | `/api/profile` | Authenticated | Update user profile information (e.g. name). |
| `POST` | `/api/profile/change-password`| Authenticated | Change password (verifies current password). |

#### Change Password Request Body
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!",
  "confirmPassword": "NewPassword456!"
}
```

---

### Submission Endpoints (`/api/submissions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/submissions/default-student-id` | Student, Admin | Derives student ID from institutional email. |
| `POST` | `/api/submissions` | Student, Admin | Uploads lab submission (`multipart/form-data`). |
| `GET` | `/api/submissions/my` | Student, Admin | Lists authenticated student's submissions. |
| `GET` | `/api/submissions/my/{id}` | Student, Admin | Fetches details of student submission. |
| `DELETE` | `/api/submissions/{id}` | Student (owner), Admin | Deletes submission and stored files on disk. |
| `GET` | `/api/submissions/{submissionId}/files/{fileId}` | Authenticated | Downloads specific submission file. |
| `GET` | `/api/submissions/teacher` | Teacher, Admin | Filters submissions across Week, Year, Section, ID. |
| `GET` | `/api/submissions/teacher/download-zip` | Teacher, Admin | Streams submissions as hierarchical ZIP archive. |

#### Upload Multipart Form Fields
* `studentId`: String (e.g. `N210921`)
* `week`: Integer (`1` to `12`)
* `year`: String (`E1`, `E2`, `E3`, `E4`)
* `section`: Integer (`1` to `6`)
* `files`: One or more `.c` and `.pdf` files

---

### Teacher Evaluation Endpoints (`/api/teacher/evaluations`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/teacher/evaluations/upload` | Teacher, Admin | Uploads evaluation report file (CSV/JSON). |
| `POST` | `/api/teacher/evaluations/upload-json` | Teacher, Admin | Uploads raw JSON evaluation payload. |
| `GET` | `/api/teacher/evaluations/grid` | Teacher, Admin | Fetches multi-week evaluation spreadsheet data. |
| `GET` | `/api/teacher/evaluations/report` | Teacher, Admin | Generates consolidated evaluation report. |
| `POST` | `/api/teacher/evaluations/feedback` | Teacher, Admin | Saves teacher comments and review status. |

---

### Admin Console Endpoints (`/api/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | Fetches user counts and total submissions count. |
| `GET` | `/api/admin/users` | Admin | Lists portal users with optional query and role filters. |
| `GET` | `/api/admin/users/{id}` | Admin | Fetches single user record. |
| `POST` | `/api/admin/users` | Admin | Provisions new user with specified role. |
| `PATCH` | `/api/admin/users/{id}/role` | Admin | Updates user role (protects last admin). |
| `PATCH` | `/api/admin/users/{id}/status` | Admin | Enables/disables account (protects self/last admin). |
| `GET` | `/api/admin/submissions` | Admin | Lists all submissions across portal with filters. |
| `DELETE` | `/api/admin/submissions/{id}` | Admin | Deletes submission record and stored disk files. |

---

### Health & Diagnostics

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Basic service health check probe. |
| `GET` | `/api/test/authenticated` | Authenticated | Validates JWT token authentication. |
| `GET` | `/api/test/student` | Role: STUDENT | Validates student role access. |
| `GET` | `/api/test/teacher` | Role: TEACHER | Validates teacher role access. |
| `GET` | `/api/test/admin` | Role: ADMIN | Validates admin role access. |

---

## Production Deployment Guide

### 1. Docker Build

Build the backend container using the multi-stage Dockerfile:
```bash
docker build -t authportal-backend:latest ./authportal
```

Run the container:
```bash
docker run -d \
  -p 8080:8080 \
  -e DATABASE_URL="jdbc:mysql://your-db-host:3306/authportal" \
  -e DATABASE_USERNAME="appuser" \
  -e DATABASE_PASSWORD="securepassword" \
  -e JWT_SECRET="your-256-bit-random-secret" \
  -e GOOGLE_CLIENT_ID="your-client-id" \
  -e GOOGLE_CLIENT_SECRET="your-client-secret" \
  -e FRONTEND_URL="https://portal.rguktn.ac.in" \
  -v /var/authportal/storage:/app/storage \
  authportal-backend:latest
```

### 2. Render Deployment (`render.yaml`)

The repository includes a ready-to-deploy `render.yaml` specification configured for Render Web Services.
1. Connect your repository to [Render](https://render.com/).
2. Create a new **Blueprint** instance selecting `render.yaml`.
3. Set the required secret environment variables (`DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`).
4. Render automatically executes the multi-stage build, starts the service, and monitors the `/api/health` endpoint.
