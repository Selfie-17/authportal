# RGUKTN Auth Portal — Backend API

A production-grade, secure authentication backend built with **Java 21**, **Spring Boot**, **Spring Security**, **Google OAuth 2.0 / OpenID Connect**, **JWT**, **Spring Data JPA / Hibernate**, and **MySQL**.

The backend exposes a stateless REST API designed to power a modern React frontend.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Role Resolution & Business Rules](#role-resolution--business-rules)
3. [Architecture & Authentication Flows](#architecture--authentication-flows)
   - [Local Email & Password Flow](#local-email--password-flow)
   - [Google OAuth 2.0 / OIDC Flow (Zero-JWT in URL)](#google-oauth-20--oidc-flow-zero-jwt-in-url)
4. [Tech Stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Environment Variables](#environment-variables)
7. [Google Cloud OAuth 2.0 Setup](#google-cloud-oauth-20-setup)
8. [Database Setup & Migrations](#database-setup--migrations)
9. [Running Locally](#running-locally)
10. [Running Tests](#running-tests)
11. [API Endpoints Reference](#api-endpoints-reference)
12. [Production Deployment Guide](#production-deployment-guide)

---

## Key Features

* **Dual Authentication**: Seamlessly supports both Google OAuth 2.0 / OIDC and traditional Email/Password authentication.
* **Server-Side Role Determination**: Eliminates client privilege escalation. Roles (`STUDENT`, `TEACHER`, `ADMIN`) are strictly determined server-side from institutional email addresses.
* **Student Institutional Email Regex**: Strictly validates student identifiers via `^[Nn]\d{6}@rguktn\.ac\.in$`.
* **Explicit Teacher Eligibility**: Prevents unauthorized institutional staff from claiming the `TEACHER` role through configurable allowlisting.
* **ADMIN Protection**: The `ADMIN` role can never be self-selected or created through public registration. Existing `ADMIN` privileges are preserved across all login mechanisms (including OAuth).
* **Zero JWT in Redirect URL**: On successful Google OAuth authentication, the backend issues a short-lived (60s), single-use exchange code to the frontend callback. The frontend then exchanges this code via a POST request to obtain the JWT in the JSON body, preventing leakage through browser history, referrer headers, or proxy logs.
* **Safe Account Linking**: If a user previously registered via email/password logs in with a verified Google institutional account, the backend links the Google identity safely without downgrading roles or duplicating user records.
* **Zero Hard-Coded Secrets**: Configuration is 100% environment-driven. No secret fallbacks or credentials are committed to the codebase.
* **Flyway Migrations**: Automated database schema migrations ensuring zero destructive DDL in production.

---

## Role Resolution & Business Rules

| Role | Eligibility Criteria | Registration Mechanism |
| :--- | :--- | :--- |
| **`STUDENT`** | Email matching `^[Nn]\d{6}@rguktn\.ac\.in$` (e.g., `N210921@rguktn.ac.in`, `n210921@rguktn.ac.in`, `N220001@rguktn.ac.in`). | Public `POST /api/auth/register` or Google OAuth |
| **`TEACHER`** | Email ending with `@rguktn.ac.in` and present on the verified teacher allowlist (`TEACHER_ALLOWED_EMAILS`). | Public `POST /api/auth/register` or Google OAuth |
| **`ADMIN`** | Granted strictly through controlled server-side seeding / direct DB management. | **Never via public endpoints.** Preserved during OAuth logins. |

### Institutional Email Rules:
* All accounts **must** belong to the `@rguktn.ac.in` domain.
* Non-institutional accounts (e.g. `@gmail.com`, `@outlook.com`) are rejected immediately with `400 Bad Request`.
* Student accounts allow case-insensitive prefix `N` or `n` followed by exactly 6 digits.

---

## Architecture & Authentication Flows

### Local Email & Password Flow
```text
React Client                               Spring Boot Backend                          MySQL Database
    │                                              │                                          │
    ├─── POST /api/auth/register ─────────────────►│                                          │
    │    (name, email, password)                   ├── Normalize email                        │
    │    [NO role accepted]                        ├── Validate institutional email domain    │
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
    │                                              ├── Check enabled status                   │
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
    │                                              ├── Provision/Link user in DB           │
    │                                              ├── Generate One-Time Code (60s TTL)    │
    │◄── 302 Redirect to Frontend ─────────────────┤                                       │
    │    ${FRONTEND_URL}/oauth2/callback?code=xyz  │                                       │
    │    [ZERO JWT IN URL]                         │                                       │
    │                                              │                                       │
    ├─── POST /api/auth/oauth2/exchange ──────────►│                                       │
    │    { "code": "xyz" }                         ├── Verify & burn exchange code         │
    │                                              ├── Generate application JWT            │
    │◄── 200 OK (AuthResponse with JWT) ───────────┤                                       │
```

---

## Tech Stack

* **Language**: Java 21
* **Framework**: Spring Boot 4.x / 3.4.x
* **Security**: Spring Security 6.x (Stateless Session, Method Security, BCrypt)
* **OAuth2**: Spring Security OAuth2 Client (OpenID Connect)
* **JWT**: JJWT (`io.jsonwebtoken` 0.12.6)
* **Database**: MySQL 8.0
* **Persistence**: Spring Data JPA / Hibernate
* **Database Migrations**: Flyway
* **Validation**: Jakarta Bean Validation
* **Tooling & Build**: Maven, Lombok, Docker Compose

---

## Prerequisites

* **Java Development Kit (JDK)**: Version 21 installed and configured.
* **Maven**: Version 3.8+ (or use the provided `./mvnw` wrapper).
* **MySQL**: MySQL 8.0 running locally or via Docker Compose.
* **Google Cloud Project**: An active Google Cloud Console project with OAuth 2.0 client credentials.

---

## Environment Variables

Copy `.env.example` to `.env` or export these variables in your deployment environment:

| Variable | Required | Default / Example | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `8080` | Port for the backend API server. |
| `DATABASE_URL` | Yes | `jdbc:mysql://localhost:3306/authportal?...` | JDBC connection URL to MySQL database. |
| `DATABASE_USERNAME` | Yes | `root` | MySQL database username. |
| `DATABASE_PASSWORD` | Yes | `root` | MySQL database password. |
| `JWT_SECRET` | **Yes** | *(No default - must be 256+ bits)* | Secret HMAC signing key for JWT tokens. |
| `JWT_EXPIRATION` | No | `86400000` (24 hours) | Token validity in milliseconds. |
| `GOOGLE_CLIENT_ID` | Yes | `...apps.googleusercontent.com` | Google OAuth 2.0 Client ID. |
| `GOOGLE_CLIENT_SECRET`| Yes | `GOCSPX-...` | Google OAuth 2.0 Client Secret. |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for CORS and OAuth redirect callback. |
| `TEACHER_ALLOWED_EMAILS`| No | `hod.cse@rguktn.ac.in,dean@rguktn.ac.in` | Comma-separated allowlist of approved teacher emails. |

---

## Google Cloud OAuth 2.0 Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services** > **Credentials**.
3. Click **Create Credentials** > **OAuth client ID**.
4. Select **Web application** as the application type.
5. In **Authorized redirect URIs**, configure:
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

## Database Setup & Migrations

### Using Docker Compose:
A `docker-compose.yml` file is provided in the repository root:
```bash
docker compose up -d
```
This starts MySQL 8 on port `3306` with database `authportal`.

### Flyway Migrations:
Flyway runs automatically on application startup. Migration scripts reside in:
`authportal/src/main/resources/db/migration/`
* `V1__create_users_table.sql`: Creates `users` table with indexes on `email`, `google_id`, and `role`.

---

## Running Locally

### 1. Configure Environment:
Set the required environment variables in your terminal or IntelliJ Run Configuration:
```bash
export JWT_SECRET="your_secure_256_bit_random_secret_key_string_here_12345"
export DATABASE_URL="jdbc:mysql://localhost:3306/authportal?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
export DATABASE_USERNAME="root"
export DATABASE_PASSWORD="your_password"
export GOOGLE_CLIENT_ID="your_google_client_id"
export GOOGLE_CLIENT_SECRET="your_google_client_secret"
export FRONTEND_URL="http://localhost:5173"
export TEACHER_ALLOWED_EMAILS="faculty@rguktn.ac.in"
```

### 2. Build & Run:
```bash
cd authportal
./mvnw clean compile
./mvnw spring-boot:run
```

---

## Running Tests

Automated tests use an isolated H2 in-memory test configuration (`application-test.properties`). They execute without requiring a live MySQL daemon:

```bash
cd authportal
./mvnw test
```

### Test Suites Included:
* `EmailRoleResolverTest`: Verifies uppercase/lowercase student regex patterns, boundary cases, invalid patterns, domain checks, teacher allowlists, and admin exclusion.
* `JwtServiceTest`: Verifies HMAC-SHA256 generation, claim extraction, signature validation, expiration detection, and tamper resistance.
* `AuthServiceTest`: Verifies local registration, duplicate email rejection, BCrypt password hashing, local login, disabled accounts, and OAuth code exchange.
* `CustomOAuth2UserServiceTest`: Verifies Google user provisioning, institutional domain enforcement, account linking, and ADMIN role preservation.
* `AuthControllerTest`: MockMvc slice testing for registration, validation, login, OAuth exchange, and logout.
* `SecurityAuthorizationTest`: MockMvc RBAC verification for role-protected endpoints (`/api/test/student`, `/api/test/teacher`, `/api/test/admin`).

---

## API Endpoints Reference

### Public Authentication Endpoints

#### 1. Local Registration
* **Endpoint**: `POST /api/auth/register`
* **Request Body**:
  ```json
  {
    "name": "Selva",
    "email": "n210921@rguktn.ac.in",
    "password": "StrongPassword123"
  }
  ```
* **Response**: `201 Created`
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "name": "Selva",
      "email": "n210921@rguktn.ac.in",
      "role": "STUDENT",
      "authProvider": "LOCAL",
      "profilePicture": null,
      "enabled": true,
      "createdAt": "2026-09-03T05:53:20Z"
    }
  }
  ```

#### 2. Local Login
* **Endpoint**: `POST /api/auth/login`
* **Request Body**:
  ```json
  {
    "email": "n210921@rguktn.ac.in",
    "password": "StrongPassword123"
  }
  ```
* **Response**: `200 OK` (Same `AuthResponse` schema as above)

#### 3. Exchange OAuth2 Authorization Code
* **Endpoint**: `POST /api/auth/oauth2/exchange`
* **Request Body**:
  ```json
  {
    "code": "4c94bcdd67744318a6a16c74ad64a88f"
  }
  ```
* **Response**: `200 OK` (Returns `AuthResponse` with JWT)

---

### Protected Endpoints (Requires `Authorization: Bearer <token>`)

#### 4. Get Current User Profile
* **Endpoint**: `GET /api/auth/me`
* **Headers**: `Authorization: Bearer <token>`
* **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "Selva",
    "email": "n210921@rguktn.ac.in",
    "role": "STUDENT",
    "authProvider": "GOOGLE",
    "profilePicture": "https://lh3.googleusercontent.com/a/...",
    "enabled": true,
    "createdAt": "2026-09-03T05:53:20Z"
  }
  ```

#### 5. Logout
* **Endpoint**: `POST /api/auth/logout`
* **Headers**: `Authorization: Bearer <token>`
* **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

### Role-Based Test Endpoints

* `GET /api/test/authenticated` — Accessible by any authenticated account.
* `GET /api/test/student` — Requires `ROLE_STUDENT`.
* `GET /api/test/teacher` — Requires `ROLE_TEACHER`.
* `GET /api/test/admin` — Requires `ROLE_ADMIN`.

---

## Production Deployment Guide

1. **Build the Production JAR**:
   ```bash
   ./mvnw clean package -DskipTests
   ```
2. **Configure Production Environment**:
   * Set `DATABASE_URL` pointing to your managed MySQL instance (AWS RDS, Google Cloud SQL, etc.).
   * Set `JWT_SECRET` with a high-entropy secret (e.g. generated via `openssl rand -hex 64`).
   * Set `FRONTEND_URL` to your production frontend domain (e.g. `https://portal.rguktn.ac.in`).
   * Add `https://api.rguktn.ac.in/login/oauth2/code/google` to Google Cloud Console authorized redirect URIs.
3. **Execute**:
   ```bash
   java -jar target/authportal-0.0.1-SNAPSHOT.jar
   ```
