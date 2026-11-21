# Technical Viva & Interview Question Bank with Detailed Answers

---

## Category 1: Basic Project-Related Questions (20 Questions)

### Q1: What is AuthPortal, and what problem does it solve?
**Answer**: AuthPortal is a production-grade full-stack web application designed for higher educational institutions like RGUKT (Rajiv Gandhi University of Knowledge Technologies). It solves the operational chaos, security vulnerabilities, and communication delays associated with manual laboratory submissions, evaluations, and grading by providing automated institutional authentication, hardened multi-file submission handling, dynamic evaluation matrices, and cloud-resilient batch email distribution.

### Q2: Who are the target users of this platform?
**Answer**: The platform caters to three primary roles:
1. **Students**: Who upload weekly programming assignments (`.c` files and `.pdf` reports), track submission history, and view evaluated rubrics.
2. **Teachers / Faculty**: Who filter submissions, stream submissions as ZIP files, inspect student PDFs inline, enter qualitative feedback, and dispatch email reports.
3. **Administrators**: Who manage institutional user accounts, oversee submissions, assign roles, and monitor system KPIs.

### Q3: What technologies are used in the frontend and backend?
**Answer**: 
- **Backend**: Java 21, Spring Boot 4.0.8, Spring Security 6, Spring Data JPA, Hibernate, Flyway, JJWT 0.12.6, and AWS SDK for Java v2.
- **Frontend**: React 19, Vite 6, React Router DOM 7, Vanilla CSS Design System, KaTeX, and PDF.js.
- **Database & Storage**: MySQL 8.0, Backblaze B2 S3 Object Storage, and Google Cloud APIs.

### Q4: How is a student's role determined during registration or login?
**Answer**: Roles are determined strictly server-side by `EmailRoleResolver.java`. The system inspects the user's institutional email address. If the email matches the regex pattern `^[A-Za-z]\d{6}@(rguktn|rguktrkv|rguktong|rguktsklm|rgukt)\.ac?\.in$`, the system automatically assigns `ROLE_STUDENT`. The client cannot pass or choose a role during registration.

### Q5: What institutional email domains does AuthPortal support?
**Answer**: It supports RGUKT's campuses: Nuzvid (`@rguktn.ac.in`), RK Valley (`@rguktrkv.ac.in`), Ongole (`@rguktong.ac.in`), Srikakulam (`@rguktsklm.ac.in`), and the central/Google institutional domain (`@rgukt.in`).

### Q6: Can a user register with a personal email like `student@gmail.com`?
**Answer**: No. `EmailRoleResolver` checks the email domain against approved institutional domains configured in `application.properties`. If the domain is not recognized, registration fails immediately with a `400 Bad Request`.

### Q7: What types of files can students upload for their lab assignments?
**Answer**: Students can upload source code files with `.c` extensions and formal lab reports with `.pdf` extensions. The system enforces a maximum size of 20MB per file.

### Q8: What happens if a student resubmits an assignment for the same week and section?
**Answer**: In `SubmissionService.java`, the system queries for an existing record matching `(user_id, week, year, section)`. If found, it increments the version counter (`v1 -> v2`), purges the previous physical files from storage, and saves the new files under the same directory path.

### Q9: Can students delete their submitted assignments?
**Answer**: Yes. Authenticated students can permanently delete their own submissions. The backend verifies ownership (`submission.getUser().getId().equals(currentUser.getId())`). Upon confirmation, it cascades the deletion to remove database records and physically deletes the files from storage.

### Q10: How do teachers view student lab submissions in bulk?
**Answer**: Teachers can use the filter controls to select Week, Year Level, and Section, and click "Download ZIP". The backend `ZipArchiveService` dynamically streams a structured ZIP archive (`week-1-sec-2.zip`) containing subfolders for each student ID directly to the browser.

### Q11: What is the dynamic evaluation grid on the teacher portal?
**Answer**: It is an interactive spreadsheet interface that dynamically renders student rows and evaluation week columns. It displays individual criterion scores, total marks, final grades, and review statuses in a consolidated matrix.

### Q12: How can teachers view student PDF reports?
**Answer**: In the evaluation grid or submissions table, clicking a student's submission invokes `/api/teacher/evaluations/pdf`. The frontend uses Mozilla's PDF.js library to render the original PDF document inline in an accessible modal or new browser tab.

### Q13: What evaluation report formats does AuthPortal support for ingestion?
**Answer**: It supports structured JSON payloads and CSV files produced by automated grading rubrics or AI evaluation pipelines (such as Google Gemini and Ollama).

### Q14: How does AuthPortal render mathematical formulas in lab reports?
**Answer**: It integrates **KaTeX 0.18.7** via `mathRenderer.jsx`. Any LaTeX syntax delimited by `$...$` or `$$...$$` in evaluation markdown or observation reports is parsed and rendered as mathematical typography.

### Q15: How does AuthPortal send emails to students?
**Answer**: It features a dual-engine architecture:
1. Direct **Google Gmail REST API (v1)** over HTTPS Port 443 using an OAuth2 refresh token.
2. Standard **Gmail SMTP** on port 587 using STARTTLS.

### Q16: Why is there an administrative console, and what does it show?
**Answer**: The admin console (`/admin`) allows system administrators to monitor institutional metrics (Total Users, Students, Teachers, Admins, Submissions), provision user accounts, modify roles, enable/disable accounts, and oversee submissions.

### Q17: What safety guard prevents an administrator from locking themselves out?
**Answer**: In `AdminService.java`, the system verifies that an admin cannot demote or disable their own account, and cannot demote or disable the last remaining active administrator in the database.

### Q18: What is Flyway, and why is it used in this project?
**Answer**: Flyway is an open-source database migration tool. It executes versioned SQL scripts (`V1` to `V12`) on backend startup to ensure that database tables, columns, indexes, and constraints are reproducible across local and cloud environments.

### Q19: How many automated tests exist in the project, and how do they run?
**Answer**: The backend contains **121 automated unit and integration tests** across 27 test classes. They run using Maven (`mvn test`) against an isolated, in-memory H2 database simulating MySQL dialect.

### Q20: Is the frontend built with TypeScript or JavaScript?
**Answer**: The frontend is built with modern JavaScript (ES Modules) using React 19 and Vite 6, adhering to functional components and React hooks.

---

## Category 2: Intermediate Technical Questions (20 Questions)

### Q21: Explain the JWT authentication flow in AuthPortal.
**Answer**: When a user logs in via `/api/auth/login`, `AuthService` verifies credentials using BCrypt. Upon success, `JwtService` creates an HMAC-SHA256 signed JWT containing the user's email as the subject, user ID, and assigned roles. The client stores this token in `localStorage` and includes it in the `Authorization: Bearer <token>` header for subsequent requests. `JwtAuthenticationFilter` intercepts each request, validates the signature and expiration, and sets the `Authentication` object in Spring Security's `SecurityContextHolder`.

### Q22: What is the "Zero-JWT in URL" redirection pattern, and why did you implement it?
**Answer**: In standard OAuth2 flows for SPAs, backends redirect to the frontend with the JWT in the URL query string (`?token=ey...`). This exposes tokens in browser history, proxy server logs, and HTTP Referer headers. AuthPortal solves this by generating an ephemeral 32-byte single-use exchange code with a 60-second TTL stored in `OAuth2ExchangeCodeStore`. The backend redirects with `?code=XYZ`. The frontend immediately makes a secure POST request to `/api/auth/oauth2/exchange` to swap the code for the JWT in the response body.

### Q23: How does AuthPortal protect against binary executable files disguised as `.c` or `.pdf`?
**Answer**: In `SubmissionService.java`, the system reads the initial 8 bytes ("magic bytes") from the file's input stream. It checks for:
1. Windows PE executables: Starts with `0x4D, 0x5A` (`MZ`).
2. Linux ELF binaries: Starts with `0x7F, 0x45, 0x4C, 0x46` (`\x7FELF`).
3. PDF documents: Must start with ASCII `%PDF-`.
If executable signatures are detected, the file is rejected with an `InvalidFileException`.

### Q24: How does the pluggable storage abstraction work?
**Answer**: The system defines a `StorageService` interface with methods like `storeFile`, `loadFile`, `deleteFile`, and `deleteDirectory`. It provides two implementations:
- `LocalStorageService`: Writes files to local disk under `storage/` (active when `STORAGE_TYPE=local`).
- `BackblazeB2StorageService`: Communicates with Backblaze B2 S3 API using the AWS SDK for Java v2 (active when `STORAGE_TYPE=backblaze`).
Spring Boot injects the appropriate bean at startup based on application properties.

### Q25: How does on-the-fly streaming ZIP generation prevent memory exhaustion?
**Answer**: In `ZipArchiveService.java`, the HTTP response output stream is wrapped directly in a `ZipOutputStream`. As each student file is read from Backblaze B2 or local disk, chunks of bytes are transferred directly to the response stream. This eliminates buffering entire multi-gigabyte ZIP archives in server RAM or writing temporary files to ephemeral disks.

### Q26: How does the frontend implement Stale-While-Revalidate (SWR) caching for the evaluation grid?
**Answer**: In `frontend/src/services/cache/gridCache.js`, grid data is retained in memory. When a teacher navigates to the grid, `TeacherSubmissionsPage` checks `gridCache.has()`. If present, it instantly renders the cached data (0ms latency) while triggering a background fetch to `/api/teacher/evaluations/grid`. When the fresh response returns, the UI updates seamlessly.

### Q27: How does AuthPortal handle multi-provider AI evaluations in the database?
**Answer**: In Flyway migration `V7`, the `student_evaluations` table was updated to include a `provider` column (`gemini` or `ollama`) and `model_name`. The unique constraint was updated to `uq_eval_student_week_provider UNIQUE (student_id, week, provider)`. This allows storing and comparing evaluations from different AI models for the same student and week.

### Q28: How is teacher feedback kept separate from automated AI evaluations?
**Answer**: Teacher feedback is stored in a dedicated table, `teacher_feedbacks`, which has a unique constraint on `(student_id, week)`. When automated evaluation reports (JSON/CSV) are re-uploaded, only the `student_evaluations` table is updated; human qualitative comments and review toggles remain intact.

### Q29: What is the purpose of `EmailBatchRecipient` table?
**Answer**: When bulk emails are sent to a class cohort, `email_batches` records the campaign metadata, while `email_batch_recipients` records the per-student delivery state (`PENDING`, `SENT`, `FAILED`), Gmail message ID, error message, and retry count. This enables granular auditing and targeted failure retries.

### Q30: How does the system handle asynchronous batch email processing?
**Answer**: The batch send endpoint (`POST /api/email/send-batch`) is configured with Spring's `@Async` via `AsyncConfig.java`. It immediately persists the batch record in MySQL, returns a `202 Accepted` response with the batch ID to the client, and processes email dispatches in the background without blocking HTTP threads.

### Q31: How does the safe email testing mode work?
**Answer**: In `ZipReportsSendRequest` and `TestEmailRequest`, an optional `targetOverrideEmail` parameter can be supplied. When present, the mailer processes real student evaluation reports from the ZIP file but redirects all outgoing emails to the instructor's test inbox.

### Q32: What password encoder is used in the application?
**Answer**: Spring Security's `BCryptPasswordEncoder` configured in `PasswordEncoderConfig.java`. BCrypt incorporates a 128-bit salt and encrypts passwords using adaptive hashing with a default work factor of 10.

### Q33: How does the application prevent CORS (Cross-Origin Resource Sharing) errors?
**Answer**: In `SecurityConfig.java`, a `CorsConfigurationSource` bean is defined that reads allowed origins from `app.cors.allowed-origins` (e.g., `http://localhost:5173` or production frontend domains), allows standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), exposes `Authorization` and `Content-Disposition` headers, and permits credentials.

### Q34: What is the purpose of `CustomOAuth2UserService` and `CustomOidcUserService`?
**Answer**: During Google authentication, these services intercept the incoming OAuth2/OIDC user token, extract verified Google claims (email, name, picture), invoke `EmailRoleResolver` to determine the user's role, and provision or link the user record in MySQL.

### Q35: How does AuthPortal safely link existing local accounts to Google identities?
**Answer**: If a user originally registered with an institutional email and password and subsequently clicks "Sign in with Google" with the same verified institutional email, `CustomOAuth2UserService` links the Google ID to the existing `User` entity without creating duplicate records or modifying previously assigned roles.

### Q36: What is `JpaSpecificationExecutor`, and where is it used?
**Answer**: It is a Spring Data JPA interface allowing dynamic query construction using JPA Criteria APIs. In AuthPortal, `SubmissionSpecification.java` uses it to dynamically filter submissions by combinations of Week, Year, Section, Branch, and Student ID without writing complex static SQL queries.

### Q37: How does `GlobalExceptionHandler` format error responses?
**Answer**: Annotated with `@RestControllerAdvice`, it intercepts exceptions (such as `ResourceNotFoundException`, `UnauthorizedException`, `InvalidFileException`, `MethodArgumentNotValidException`) and returns standardized `ErrorResponse` JSON objects containing an HTTP status code, timestamp, message, and field validation error maps.

### Q38: How does the frontend protect role-restricted routes?
**Answer**: In `App.jsx`, routes are wrapped inside `<ProtectedRoute allowedRoles={[...]}>`. This component checks `authService.isAuthenticated()` and verifies that `currentUser.role` is included in `allowedRoles`. If unauthorized, it redirects the user to their appropriate role home page.

### Q39: Why does AuthPortal configure `server.forward-headers-strategy=framework`?
**Answer**: When deployed behind reverse proxies like Cloudflare or Render, requests terminate SSL at the proxy. Setting `server.forward-headers-strategy=framework` instructs Spring Boot to trust `X-Forwarded-Proto` and `X-Forwarded-Host` headers so that Google OAuth2 redirect URIs are generated with `https://` instead of `http://`.

### Q40: What happens when a user logs out in AuthPortal?
**Answer**: Because AuthPortal uses stateless JWT authentication, the backend endpoint `POST /api/auth/logout` logs the event and returns an acknowledgement. The React frontend's `authService.logout()` purges the JWT and user profile from `localStorage` and redirects the browser to `/login`.

---

## Category 3: Advanced Technical Questions (15 Questions)

### Q41: Explain the exact mechanism by which Gmail REST API over HTTPS Port 443 circumvents Render cloud port blocking.
**Answer**: Cloud providers like Render block outbound traffic on TCP ports 25, 465, and 587 on their free tier to prevent spam abuse. Standard JavaMailSender communicates via SMTP protocol over port 587, which causes socket connection timeouts. AuthPortal circumvents this through `GmailRestApiService.java`. Instead of opening raw SMTP sockets, it uses Spring's `RestClient` to issue HTTPS POST requests to `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` over TCP Port 443. Outbound Port 443 (HTTPS) is standard web traffic and is never blocked by cloud firewalls. The service converts Java `MimeMessage` objects into raw RFC 2822 byte arrays, Base64URL-encodes them, and delivers them via REST.

### Q42: How does `GmailRestApiService` manage OAuth access token refreshing and caching?
**Answer**: Google OAuth access tokens expire after 3,600 seconds (1 hour). Storing only an access token would cause dispatches to fail after an hour. `GmailRestApiService` stores a persistent **OAuth2 refresh token**. When sending an email, it inspects its in-memory `cachedAccessToken` and `tokenExpiresAt` timestamp. If the token is missing or within 60 seconds of expiration, it executes a synchronous POST to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`, updates `cachedAccessToken`, sets expiration to `now + expiresIn`, and proceeds with the API call.

### Q43: How does AuthPortal prevent race conditions and token reuse in `OAuth2ExchangeCodeStore`?
**Answer**: `OAuth2ExchangeCodeStore` utilizes a thread-safe `ConcurrentHashMap<String, ExchangeCodeEntry>`. When the client exchanges a code, the service calls `codeStore.remove(code)`. In Java's `ConcurrentHashMap`, `remove(key)` is an atomic operation: only one thread can successfully retrieve and delete the entry. Subsequent or concurrent requests with the same code receive `null` and are immediately rejected with `401 Unauthorized`.

### Q44: How are Backblaze B2 S3 storage keys constructed, and why are they provider-neutral?
**Answer**: Storage keys follow a deterministic hierarchical pattern implemented in `SubmissionPathUtils.java`:
`submissions/week-{week}/sec-{section}/{studentId}/{storedFilename}`
In Flyway migration `V6`, the `submission_files` table was given a `storage_key` column. It is "provider-neutral" because the key is an abstract object path. Whether the underlying storage is local disk (`storage/...`), Backblaze B2, AWS S3, or MinIO, the application references the exact same key without needing vendor-specific file URIs.

### Q45: What is the significance of `spring.mvc.async.request-timeout=-1` in `application.properties`?
**Answer**: Servlet containers (like Tomcat) have a default asynchronous request timeout (often 30 seconds). When a teacher downloads a large cohort ZIP archive containing hundreds of megabytes of student code and PDFs, the streaming transfer over slow connections may exceed 30 seconds. If Tomcat times out, it aborts the socket connection, throwing an `AsyncRequestTimeoutException` which causes corrupted downloads. Setting the timeout to `-1` disables the servlet async timeout, allowing large files to stream until completion.

### Q46: How does the application detect client disconnects during file streaming?
**Answer**: In `StreamingFileResponses.java` and `ClientDisconnectDetector.java`, the system wraps file write loops in a `try-catch` block inspecting for `ClientAbortException`, `IOException` with "Broken pipe", or "Connection reset by peer". If the student or teacher closes their browser tab mid-download, the detector catches the socket error silently and logs a debug notice, preventing `GlobalExceptionHandler` from throwing unhandled 500 errors on an already-closed response stream.

### Q47: Why is `spring.jpa.open-in-view` set to `false`?
**Answer**: The Open Session in View (OSIV) anti-pattern keeps database connections open throughout the entire HTTP request lifecycle, including during slow file streaming or external API calls. Disabling OSIV (`open-in-view=false`) ensures that database connections from HikariCP are returned to the pool immediately upon completion of the repository/service transaction, dramatically improving throughput and preventing connection pool starvation.

### Q48: How does AuthPortal ensure idempotence in its 12 Flyway database migrations?
**Answer**: Every migration script (`V1` to `V12`) utilizes defensive DDL syntax:
- `CREATE TABLE IF NOT EXISTS`
- Explicit column checks or structured `ALTER TABLE` statements
- Flyway records the checksum of each executed script in `flyway_schema_history`. If a script has already executed, Flyway skips it. If an unapplied migration is detected, it runs in sequential numerical order within an isolated database transaction.

### Q49: How does AuthPortal prevent Insecure Direct Object References (IDOR) when downloading submission files?
**Answer**: In `SubmissionController.java` (`GET /api/submissions/{submissionId}/files/{fileId}`), the client only passes numerical database IDs, never physical storage keys or filesystem paths. The controller resolves the authenticated user from the SecurityContext. If the user is a `STUDENT`, the service verifies that `submission.getUser().getId().equals(currentUser.getId())`. If an unauthorized student attempts to download another student's file by guessing IDs, the service throws `AccessDeniedException` (403 Forbidden). Teachers and Admins are granted access via `@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")`.

### Q50: How does `ZipReportsParseResponse` detect student IDs from raw HTML files inside an uploaded ZIP archive?
**Answer**: In `ZipReportEmailService.java`, when a ZIP archive of evaluation reports is uploaded, the service traverses each entry. It parses the filename and uses **Jsoup** to inspect the HTML content for regular expression patterns matching RGUKT student IDs (e.g., `[A-Za-z]\d{6}`). It extracts student IDs, locates their institutional emails from the user database or student metadata helper, and constructs preview DTOs with detected recipient mappings.

### Q51: Explain the role of `RestAccessDeniedHandler` vs `JwtAuthenticationEntryPoint`.
**Answer**:
- `JwtAuthenticationEntryPoint` implements `AuthenticationEntryPoint`. It is triggered when an unauthenticated user attempts to access a protected resource without a token or with an invalid/expired token, returning `401 Unauthorized`.
- `RestAccessDeniedHandler` implements `AccessDeniedHandler`. It is triggered when an authenticated user possesses a valid token but lacks the required authority/role for that endpoint (e.g., a student trying to access `/api/admin/users`), returning `403 Forbidden`.

### Q52: What is the transaction propagation strategy in `EmailBatchService.java`?
**Answer**: `sendBatch` utilizes `@Transactional` to initialize the batch record and its recipient rows in MySQL atomically. However, the subsequent email sending loop executes asynchronously outside the database transaction. Each recipient's status update is committed independently so that if recipient #15 fails, the successful delivery status of recipients #1 through #14 is already permanently committed.

### Q53: How does AuthPortal handle token expiration on the client side?
**Answer**: The client `authService.js` decodes the JWT payload to inspect the `exp` claim. When an API call returns a `401 Unauthorized` (indicating the token expired on the server), the centralized API interceptor in `api.js` catches the error, clears `localStorage`, and triggers a hard redirect to `/login` with an expiration message.

### Q54: How does `EmailReportHtmlTransformer` optimize raw evaluation HTML for email clients?
**Answer**: Standard desktop and web email clients (like Gmail, Outlook) strip external CSS `<link>` tags and complex JavaScript. `EmailReportHtmlTransformer` uses **Jsoup** to parse HTML reports, inline essential styles, inject responsive table containers, add RGUKT institutional branding headers, and format rubric scores so that reports render consistently across mobile and desktop inboxes.

### Q55: Why does the project use Spring Boot 4.0.8 with Java 21?
**Answer**: Java 21 LTS introduces generational ZGC, virtual threads, pattern matching for switch, and record patterns. Spring Boot 4 leverages these JVM features to deliver ultra-low latency, reduced memory footprints, and native support for modern cloud architectures.

---

## Category 4: Architecture & System Design Questions (10 Questions)

### Q56: Why did you choose a decoupled REST architecture over a server-rendered MVC (like Thymeleaf or JSP)?
**Answer**: A decoupled architecture completely separates presentation logic from business operations. The React 19 SPA provides a dynamic desktop-class user experience (instant SWR tab switching, client-side PDF rendering, KaTeX math parsing) without full page reloads. The Spring Boot backend acts purely as a stateless REST API, allowing the backend to be scaled, containerized, or integrated with future mobile apps without altering frontend code.

### Q57: How would you scale AuthPortal if the student population grew to 100,000?
**Answer**: 
1. **Stateless API Clustering**: Since user sessions are stateless JWTs, multiple Spring Boot container instances can be placed behind an AWS Application Load Balancer or Nginx reverse proxy.
2. **Database Read Replicas**: Configure MySQL primary-replica clustering; direct heavy read queries (such as student submission histories and evaluation grids) to read replicas while writes go to the primary.
3. **Distributed Message Queue**: Replace Spring's `@Async` email dispatcher with RabbitMQ or Apache Kafka to queue batch email jobs across dedicated background worker nodes.
4. **Cloud Object Storage**: Backblaze B2 inherently handles petabyte-scale storage and high concurrency with zero server bottleneck.
5. **Distributed Caching**: Introduce Redis for caching evaluation grids and rate-limiting API endpoints.

### Q58: How does the system ensure zero disk space leakage on server instances?
**Answer**: When configured with Backblaze B2, direct uploads stream bytes from the HTTP request `InputStream` directly into B2's S3 client. Downloads and ZIP streaming read directly from S3 into the response stream. No temporary files are created on the host instance's local hard drive.

### Q59: Why was Backblaze B2 selected instead of Amazon AWS S3?
**Answer**: Backblaze B2 provides enterprise-grade, S3-compatible cloud object storage with 99.999999999% (11 9's) durability at approximately one-fifth the cost of Amazon S3, with free egress up to three times stored data. Because it implements the standard S3 API, we used the standard AWS SDK for Java v2 without vendor lock-in.

### Q60: Explain the micro-component design in the React frontend.
**Answer**: The frontend follows component modularity:
- Atomic visual badges: `RoleBadge.jsx`, `StatusBadge.jsx`.
- Specialized composite components: `StudentScoreTable.jsx`, `UploadedPdfViewer.jsx`, `EmailReportModal.jsx`.
- Top-level page controllers: `StudentSubmissionPage.jsx`, `TeacherSubmissionsPage.jsx`, `AdminDashboardPage.jsx`.
This separation isolates state changes and prevents unnecessary re-rendering of large evaluation tables.

### Q61: How are database transactions managed across the service layer?
**Answer**: Spring's declarative `@Transactional` annotation is applied at the service layer. In `SubmissionService.java`, creating a submission and inserting its child file records executes within a single database transaction. If an error occurs during file storage, the transaction rolls back, preventing orphaned records.

### Q62: What architectural design patterns are implemented in AuthPortal?
**Answer**:
1. **Layered Architecture**: Controller -> Service -> Repository -> Entity.
2. **Strategy Pattern**: `StorageService` interface with `LocalStorageService` and `BackblazeB2StorageService`.
3. **Repository Pattern**: Spring Data JPA repositories abstracting database access.
4. **Factory / Builder Pattern**: Lombok `@Builder` on DTOs and entities.
5. **Filter Pattern**: Spring Security filter chains intercepting and validating HTTP requests.
6. **SWR (Stale-While-Revalidate)**: Implemented in client memory cache.

### Q63: How does the system handle database connection pooling?
**Answer**: AuthPortal uses **HikariCP**, the default high-performance JDBC connection pool in Spring Boot. HikariCP maintains a pool of pre-warmed MySQL connections, minimizing connection acquisition latency and automatically validating connection health before allocating them to threads.

### Q64: What is the purpose of `docker-compose.yml` in the project root?
**Answer**: It defines a local MySQL 8.0 container service with port mapping `3306:3306`, environment credentials, and persistent volume storage. This enables developers to spin up an identical local database instance with a single command (`docker compose up -d`) without manual MySQL installation.

### Q65: How does the multi-stage Dockerfile optimize container size and build security?
**Answer**: 
- **Stage 1 (Build)**: Uses a heavy `maven:3.9.6-eclipse-temurin-21` image containing the JDK, compiler, and build tools. It compiles the source and packages the JAR.
- **Stage 2 (Runtime)**: Copies only the resulting `app.jar` into a minimal, stripped-down `eclipse-temurin:21-jre-jammy` runtime image.
This shrinks the final container image by hundreds of megabytes and removes build compilers, reducing the attack surface in production.

---

## Category 5: Database & API Questions (10 Questions)

### Q66: Why did you choose MySQL over a NoSQL database like MongoDB?
**Answer**: Academic laboratory records require strict relational integrity, ACID compliance, and foreign key constraints. Submissions, files, users, and evaluations have clear 1-to-N and 1-to-1 relationships. Cascading deletes (`ON DELETE CASCADE`) are required to prevent orphaned files when a submission or user is removed. Furthermore, multi-criteria filtering across week, year, and section benefits directly from relational B-Tree indexes.

### Q67: What indexes are defined on the `submissions` table, and why?
**Answer**: In `V2__create_submissions_tables.sql`:
1. `idx_submissions_student_id (student_id)`: Accelerates queries filtering submissions by a specific student.
2. `idx_submissions_week_sec (week, section)`: Accelerates cohort filtering for section instructors.
3. `idx_submissions_filters (week, year, section)`: Composite index optimizing teacher and admin multi-criteria search queries.
4. `uq_user_week_year_sec`: Unique constraint preventing duplicate active records for the same student, week, year, and section.

### Q68: What is the purpose of `V8__add_branch_year_section_to_users.sql`?
**Answer**: It adds `branch`, `academic_year`, and `section` columns to the `users` table and creates an index on `branch`. It automatically defaults existing students to `CSE` (Computer Science & Engineering). This allows user profiles to pre-populate submission forms and cohort email distributions.

### Q69: Explain the API endpoint `GET /api/submissions/default-student-id`.
**Answer**: When a student opens the submission form, the frontend calls this endpoint. The backend resolves the authenticated user from the JWT, extracts their student ID from their email (e.g., `n210001@rguktn.ac.in` $\rightarrow$ `N210001`), fetches their profile branch, year, and section, and returns a JSON payload pre-populating the submission form fields.

### Q70: How does `PATCH /api/admin/users/{id}/role` validate role updates?
**Answer**: It validates the incoming `UpdateRoleRequest`. Before applying the update, `AdminService` queries the database. If the user being modified is an `ADMIN` and the new role is not `ADMIN`, it counts the total active administrators remaining. If the count is 1, it aborts and throws `BadRequestException("Cannot demote the final remaining administrator")`.

### Q71: What is the difference between `POST /api/teacher/evaluations/upload` and `POST /api/teacher/evaluations/upload-json`?
**Answer**:
- `upload`: Accepts a `multipart/form-data` file upload (such as an evaluation JSON file exported from an automated grading tool).
- `upload-json`: Accepts a raw `application/json` string directly in the request body, facilitating programmatic API-to-API ingestion from external evaluation runners.

### Q72: How are HTTP status codes used in the REST API?
**Answer**:
- `200 OK`: Successful read or update operations.
- `201 Created`: Successful creation of resources (e.g., new user registration, first-time submission).
- `202 Accepted`: Asynchronous request accepted for background processing (e.g., batch email dispatch).
- `400 Bad Request`: Validation failure, invalid file format, or business constraint violation.
- `401 Unauthorized`: Missing, expired, or invalid JWT authentication.
- `403 Forbidden`: Authenticated user lacks permission for the requested resource (RBAC).
- `404 Not Found`: Target resource (user, submission, file) does not exist.

### Q73: How does the application handle large multipart file uploads?
**Answer**: In `application.properties`:
- `spring.servlet.multipart.max-file-size=25MB`: Restricts individual file sizes.
- `spring.servlet.multipart.max-request-size=500MB`: Permits batch submissions containing multiple files.
Tomcat streams the multipart parts, and `SubmissionService` validates each file sequentially.

### Q74: What is the structure of `SingleStudentReportResponse`?
**Answer**: It is a composite DTO containing:
- Student ID, Student Name, Profile Picture, Email, Branch, Year, and Section.
- Criterion-level scores (*Objective*, *Problem Understanding*, *Logic*, *Variables*, *Observation*, *Total*, *Final*).
- AI model provider metadata (`gemini` or `ollama`) and model name.
- Teacher feedback comments and review status.
- Markdown assessment text with KaTeX formulas.
- Associated submission file metadata (PDF report link).

### Q75: How does AuthPortal implement pagination for teacher submission reviews?
**Answer**: In `TeacherSubmissionController.java` (`GET /api/teacher/submissions-page`), Spring Data's `Pageable` (`PageRequest.of(page, size)`) is passed to `SubmissionRepository`. The repository executes a `COUNT` query and a paginated `SELECT` query with `LIMIT` and `OFFSET`, returning a `TeacherSubmissionPageResponse` containing the items, current page, total pages, and total elements.

---

## Category 6: Challenges, Edge Cases & Technology Selection (10 Questions)

### Q76: What was the single biggest technical challenge during development, and how was it solved?
**Answer**: Deploying automated email delivery on Render's cloud platform. Render blocks outbound traffic on SMTP ports 25, 465, and 587 on its free tier to prevent spam abuse. Standard Java mail crashed with socket connection timeouts. We solved this by developing `GmailRestApiService.java`, which uses Google OAuth2 refresh tokens to dispatch RFC 2822 MIME messages over the **Google Gmail REST API (v1)** via standard **HTTPS Port 443**. Port 443 is standard encrypted web traffic and is never blocked by cloud firewalls.

### Q77: Why did you not use an external email service like SendGrid, Mailgun, or Brevo?
**Answer**: 
1. **Institutional Trust & Deliverability**: Emails sent from third-party services often trigger spam filters or are blocked by strict university mail gateways. Sending directly from an authenticated `@rguktn.ac.in` Gmail account guarantees high inbox deliverability.
2. **Cost & Quotas**: Commercial transactional email services impose severe free-tier quotas (e.g., 100 emails/day on SendGrid). Gmail API permits up to 500–2,000 emails per day for standard accounts without incurring subscription costs.

### Q78: How did you test Backblaze B2 integration without incurring cloud costs during automated CI builds?
**Answer**: In our automated test suite (`src/test/java`), we created `StorageServiceTest` and `SubmissionServiceTest` using an isolated local filesystem mock implementation. When testing B2 specifically (`BackblazeB2StorageServiceTest`), we mocked the AWS SDK `S3Client` bean using Mockito, verifying that `putObject`, `getObject`, and `deleteObject` were invoked with correct bucket names and keys without making real network calls.

### Q79: What happens if a student loses internet connectivity while uploading a large lab submission?
**Answer**: The multipart upload stream will terminate prematurely. In `SubmissionService.java`, database records are only created **after** all files are verified and written to storage. Because the transaction has not committed, no partial submission record or corrupted database entry is created. The student can simply retry the upload when connectivity is restored.

### Q80: How does the system handle students with duplicate names in the evaluation grid?
**Answer**: In higher education, names are often duplicated, but institutional student IDs (e.g., `N210001`, `N210002`) are globally unique primary keys. All evaluation grid rows, submission storage directories, database unique constraints, and email distributions are keyed strictly by **Student ID**, completely preventing name collision issues.

### Q81: What edge case occurs if two teachers attempt to review and save feedback for the same student simultaneously?
**Answer**: In `EvaluationService.java`, `saveFeedback` executes inside a database transaction on `teacher_feedbacks` with unique key `uq_feedback_student_week`. The second transaction to commit will perform an atomic update (`ON DUPLICATE KEY UPDATE`), updating the feedback text and recording the email of the last teacher who saved the review.

### Q82: How does the application prevent XSS (Cross-Site Scripting) attacks when rendering student Markdown reports?
**Answer**: In `MarkdownReportRenderer.jsx`, raw HTML tags are sanitized before rendering. The markdown parser escapes raw HTML, and KaTeX only parses recognized mathematical expressions, preventing malicious `<script>` tags or inline JavaScript from executing in the instructor's browser.

### Q83: Why did you not use Next.js or Nuxt.js instead of React 19 + Vite?
**Answer**: Next.js and Nuxt.js introduce Node.js server-side rendering (SSR) overhead, which complicates deployment when paired with an independent Spring Boot backend. A pure React 19 Single Page Application bundled with Vite produces static HTML/CSS/JS assets that can be served directly via CDNs (like Cloudflare or Vercel) while keeping all business logic, authorization, and data persistence cleanly inside Spring Boot.

### Q84: What happens if an administrator tries to delete a submission while a teacher is currently downloading that section's ZIP file?
**Answer**: The ZIP download streams from open file input streams. In `ZipArchiveService.java`, if a file is deleted mid-stream, `StorageService` throws a `FileNotFoundException`. The ZIP service catches this exception, logs a warning, skips the missing file entry, and continues packaging the remaining files so the teacher's ZIP download completes without crashing.

### Q85: What is the most important lesson learned from developing AuthPortal?
**Answer**: The most critical lesson was that **production software must be designed for real-world environmental constraints**. Assumptions that work on `localhost` (like open SMTP ports or persistent local disks) fail in cloud environments (like Render's port blocks and ephemeral disks). Anticipating these constraints and designing resilient abstractions (such as our dual-engine mailer and pluggable S3 storage) is what separates academic prototypes from enterprise-ready software.
