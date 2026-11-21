# PowerPoint Presentation: Slide-by-Slide Content & Delivery Guide

---

## Slide 1: Title Slide

* **Slide Number**: 1
* **Slide Title**: Institutional Authentication, Laboratory Submission Management & Evaluation Portal (AuthPortal)
* **Visual Layout**:
  - Dark professional academic header (Navy Blue & Slate Gray) with university emblem/logo placeholder.
  - Centered bold title with clean subtitle.
  - Presenter details, institutional affiliation, and academic year at the bottom left and right.
* **Exact Slide Content**:
  - **AuthPortal**: A Production-Grade Full-Stack Platform for Academic Identity, Continuous Laboratory Evaluation & Automated Feedback
  - **Built For**: Rajiv Gandhi University of Knowledge Technologies (RGUKT AP)
  - **Technology**: Java 21 | Spring Boot 4 | Spring Security 6 | React 19 | MySQL 8 | Backblaze B2 | Google Cloud
  - **Presented By**: Final Year B.Tech Computer Science & Engineering Students
* **Technical Details**:
  - Full-stack decoupled architecture running an enterprise Java 21 backend and React 19 client.
  - 12 sequential Flyway database migrations and 121 automated backend tests.
* **Suggested Visual**: RGUKT university crest alongside modern technology badges (Java, Spring Boot, React, MySQL, Docker, Google Cloud).
* **Presenter Notes**:
  > "Respected faculty members, external evaluators, and department dignitaries, good morning. Today, I am proud to present our final year major project: **AuthPortal**—an institutional authentication, laboratory submission management, and continuous academic evaluation platform engineered specifically for the multi-campus university system of RGUKT. Over the next fifteen slides, we will walk you through the architectural design, security mechanisms, laboratory submission engine, multi-provider evaluation matrix, and our cloud-resilient dual email dispatcher."
* **Key Takeaway**: A purpose-built, enterprise-grade academic platform tailored for large-scale engineering laboratory courses.

---

## Slide 2: Project Introduction & Institutional Background

* **Slide Number**: 2
* **Slide Title**: Institutional Context: Continuous Engineering Laboratory Evaluation
* **Visual Layout**:
  - Two-column layout: Left column highlighting the institutional ecosystem (RGUKT AP); Right column summarizing the scale of weekly lab submissions.
  - Three highlight metric cards at the bottom.
* **Exact Slide Content**:
  - **Academic Setting**: Rajiv Gandhi University of Knowledge Technologies (RGUKT) in Andhra Pradesh (Nuzvid, RK Valley, Ongole, Srikakulam campuses).
  - **Student Ecosystem**: Over 20,000 undergraduate engineering students undergoing rigorous continuous lab evaluation.
  - **Course Structure**: 12 consecutive weeks of hands-on laboratory programming (C Programming, Data Structures, Algorithms, Systems).
  - **Weekly Ingestion**: 1,000+ code submissions and laboratory reports per section/cohort every week.
  - **Key Metrics**:
    - **4 Campuses**: Standardized institutional governance.
    - **12 Lab Weeks**: Structured continuous assessment.
    - **2 Submission Types**: Source code (`.c`) and formal documentation (`.pdf`).
* **Technical Details**:
  - Multi-campus email pattern matching (`@rguktn.ac.in`, `@rguktrkv.ac.in`, `@rguktong.ac.in`, `@rguktsklm.ac.in`, `@rgukt.in`).
  - Strict cohort grouping by Academic Year (E1–E4) and Section (1–6).
* **Suggested Visual**: A geographic map showing the four RGUKT AP campuses connected to a centralized cloud architecture.
* **Presenter Notes**:
  > "To understand why AuthPortal was created, we must look at the unique academic structure of RGUKT. RGUKT operates four premier campuses in Andhra Pradesh, educating over 20,000 students. In every semester, each engineering branch conducts weekly laboratory sessions across 12 structured weeks. For faculty, evaluating, verifying, grading, and returning feedback for tens of thousands of weekly lab submissions is an enormous operational burden. AuthPortal was conceived to digitize and secure this entire lifecycle."
* **Key Takeaway**: High submission volume across multi-campus institutions demands automated, secure, and structured laboratory management.

---

## Slide 3: Problem Statement & Existing System Deficiencies

* **Slide Number**: 3
* **Slide Title**: Problem Statement: The Fragility of Ad-Hoc Laboratory Administration
* **Visual Layout**:
  - Comparison table or four warning cards contrasting current manual methods with their vulnerabilities.
* **Exact Slide Content**:
  - **Privilege Escalation Risks**: Generic portals allow students to self-select roles (`STUDENT`, `TEACHER`, `ADMIN`); personal `@gmail.com` accounts impede identity verification.
  - **Binary Upload Hazards**: Basic file extension checking permits disguised executable binaries (`.exe`, ELF, Mach-O) to bypass frontend controls.
  - **OAuth Token Exposure**: Common Single Page Apps pass JWTs in URL query parameters, leaking credentials into browser history and proxy logs.
  - **Cloud Outbound SMTP Blocking**: Cloud platforms like Render block standard SMTP ports (25, 465, 587) on free tiers, failing automated email dispatches.
  - **Evaluation Silos & Feedback Lag**: Evaluated rubrics remain trapped in faculty spreadsheets; students do not receive timely feedback.
* **Technical Details**:
  - Common vulnerabilities: Insecure Direct Object References (IDOR), URL token sniffing, cross-student file overwrite, and MIME-type spoofing.
* **Suggested Visual**: An infographic depicting an insecure upload pipeline (disguised `.exe` bypassing checks and token visible in browser address bar).
* **Presenter Notes**:
  > "Why do existing solutions fail? Most colleges rely on Google Forms, Google Drive folders, or ad-hoc web scripts. These tools exhibit five systemic flaws. First, they lack automated institutional verification, allowing students to submit from personal accounts or tamper with roles. Second, they only check file extensions—if a student renames a compiled binary to `.c`, it uploads freely. Third, standard OAuth SPAs leak access tokens directly in the redirect URL. Fourth, hosting automated mailers on cloud platforms like Render fails because outbound SMTP ports are blocked. Finally, evaluations remain trapped in instructor spreadsheets without reaching students."
* **Key Takeaway**: Manual, disconnected tools jeopardize institutional security, data integrity, and student learning outcomes.

---

## Slide 4: Proposed Solution & Core System Philosophy

* **Slide Number**: 4
* **Slide Title**: The Proposed Solution: AuthPortal Architecture Philosophy
* **Visual Layout**:
  - Central hexagonal graphic displaying "AuthPortal" with four surrounding pillars representing Security, Submission, Evaluation, and Communication.
* **Exact Slide Content**:
  - **Zero-Trust Institutional Security**: Automatic server-side role resolution based strictly on institutional email patterns; zero client role selection.
  - **Hardened Submission Engine**: Multi-byte header inspection (blocking `MZ`, `\x7FELF`, Mach-O); automatic revision incrementation (`v1 -> v2`).
  - **Pluggable Cloud Object Storage**: Seamless abstraction between local disk and Backblaze B2 S3 storage with zero disk staging.
  - **Interactive Evaluation Grid**: Dynamic multi-week matrix aggregating AI model outputs (Google Gemini, Ollama) and human teacher feedback.
  - **Cloud-Resilient Dual Mailer**: Automatic fallback from Gmail SMTP (port 587) to Google Gmail REST API (v1) over HTTPS Port 443.
* **Technical Details**:
  - Decoupled REST architecture (Java 21 Spring Boot + React 19).
  - Memory-safe streaming transfers via `StreamingResponseBody` and `ZipOutputStream`.
* **Suggested Visual**: High-level architectural flowchart connecting Student, Teacher, and Admin roles to the Spring Boot core.
* **Presenter Notes**:
  > "AuthPortal solves these challenges through a unified, production-ready full-stack platform. Our core philosophy is built on four pillars: First, Zero-Trust security where the server strictly dictates roles based on university email domains. Second, deep file inspection that reads the actual raw bytes of files rather than trusting extensions. Third, an interactive evaluation grid that merges automated AI rubrics with human teacher feedback. And fourth, a dual-engine mail delivery system that guarantees delivery even on firewalled cloud servers."
* **Key Takeaway**: AuthPortal provides a secure, unified ecosystem bridging students, faculty, and administrative leadership.

---

## Slide 5: System Objectives & Academic Scope

* **Slide Number**: 5
* **Slide Title**: Project Objectives & Functional Scope
* **Visual Layout**:
  - Grid of four functional quadrants: Authentication, Submission, Evaluation, and Administration.
* **Exact Slide Content**:
  - **Authentication Objectives**:
    - Dual sign-in: Google OAuth 2.0 / OIDC and BCrypt credentials.
    - Zero-JWT redirect via single-use 60-second exchange codes.
  - **Submission Objectives**:
    - Pre-filled student IDs (`N210001`); multi-file uploads (`.c` + `.pdf`).
    - Revision tracking; atomic deletion of physical files and DB rows.
  - **Evaluation & Notification Objectives**:
    - Dynamic spreadsheet grid; inline PDF viewer via PDF.js; KaTeX LaTeX formulas.
    - Asynchronous batch mailer with per-student delivery status tracking.
  - **System Governance Objectives**:
    - Real-time KPI analytics; user role modification guards (last admin protection).
* **Technical Details**:
  - Strictly in-scope: full CRUD, batch mailing, S3 integration, and 121 automated tests.
  - Explicitly out-of-scope: sandboxed code compilation/execution and automated plagiarism scoring.
* **Suggested Visual**: Checklist graphic illustrating completed and verified functional deliverables.
* **Presenter Notes**:
  > "Our project objectives were rigorously defined and completely implemented. We focused on delivering end-to-end functionality: from institutional Google login and executable file detection to dynamic evaluation spreadsheets, on-the-fly ZIP generation, and batch email reporting with full audit history. We have verified every single feature with automated tests rather than relying on assumed behavior."
* **Key Takeaway**: Clear functional boundaries and 100% verified feature completion ensure production readiness.

---

## Slide 6: Technology Stack & Architectural Decision Justification

* **Slide Number**: 6
* **Slide Title**: Technology Stack & Architectural Rationale
* **Visual Layout**:
  - 3-column table: Layer, Selected Technology, Technical Justification.
* **Exact Slide Content**:
  - **Backend**: **Java 21 & Spring Boot 4.0.8**
    - *Why*: Type safety, high throughput, mature ecosystem, and enterprise Spring Security filter chain.
  - **Frontend**: **React 19 & Vite 6**
    - *Why*: Modern component architecture, sub-second HMR, optimized state updates, and React Router DOM 7.
  - **Database & Migration**: **MySQL 8.0 & Flyway**
    - *Why*: ACID compliance, relational integrity across 8 entities, and version-controlled idempotent migrations (V1–V12).
  - **Object Storage**: **Backblaze B2 via AWS SDK v2**
    - *Why*: High-durability S3-compatible cloud storage at a fraction of AWS S3 costs, streamed without disk caching.
  - **Mail Delivery**: **Gmail SMTP + Gmail REST API (v1)**
    - *Why*: Overcomes cloud provider firewall blocks on outbound SMTP ports via standard HTTPS (Port 443).
* **Technical Details**:
  - Stateless architecture; Spring Data JPA repositories with `JpaSpecificationExecutor`; JJWT 0.12.6.
* **Suggested Visual**: Stack logo matrix (Java 21, Spring Boot, React 19, MySQL, Backblaze B2, Docker, Vite).
* **Presenter Notes**:
  > "Every technology in our stack was chosen to solve specific engineering challenges. We selected Java 21 and Spring Boot 4 because enterprise academic systems require strict type safety and bulletproof security filters. We chose React 19 and Vite 6 for high responsiveness and lightning-fast build cycles. We chose MySQL 8 with Flyway to guarantee reproducible database schema migrations. And critically, we integrated the AWS SDK for Java v2 to communicate directly with Backblaze B2 S3 storage, ensuring zero temporary files are staged on ephemeral cloud disks."
* **Key Takeaway**: Purposeful technology selection driven by performance, security, cost efficiency, and cloud constraints.

---

## Slide 7: High-Level System Architecture

* **Slide Number**: 7
* **Slide Title**: High-Level System Architecture & Layered Decomposition
* **Visual Layout**:
  - Clear system architecture diagram showing Client Tier, Security Filter Layer, Controller Layer, Service Layer, and Data/Cloud Tier.
* **Exact Slide Content**:
  - **Presentation Layer**: React 19 SPA running in browser; manages client JWT state and SWR in-memory caching.
  - **Security Filter Pipeline**: Intercepts every HTTP request; enforces CORS rules; extracts and validates Bearer JWT claims.
  - **REST Controller Layer**: Role-guarded endpoints (`/api/auth`, `/api/submissions`, `/api/teacher`, `/api/email`, `/api/admin`).
  - **Service & Business Layer**: Core domain services executing business logic, magic byte validation, and ZIP streaming.
  - **Persistence & Cloud Layer**:
    - **Aiven Cloud MySQL 8**: Relational metadata, user accounts, evaluation scores.
    - **Backblaze B2 S3 Bucket**: Student `.c` code and `.pdf` laboratory reports.
    - **Google Cloud APIs**: OAuth2 identity and Gmail REST API v1.
* **Technical Details**:
  - Layered enterprise pattern ensuring separation of concerns; DTO-based serialization; global exception handling.
* **Suggested Visual**: Mermaid high-level architecture diagram (from Document 03).
* **Presenter Notes**:
  > "Here we observe the complete architectural blueprint of AuthPortal. The system follows a decoupled three-tier enterprise pattern. In the presentation tier, React 19 handles user interaction and in-memory caching. Incoming requests hit our Spring Security filter chain, where CORS and JWT authenticity are verified before reaching our REST controllers. The controllers delegate to transactional service components, which interface with MySQL for structured relational metadata and Backblaze B2 for raw file object storage."
* **Key Takeaway**: Decoupled, modular architecture ensures high maintainability, testability, and horizontal scalability.

---

## Slide 8: Database Architecture & Relational Schema Design

* **Slide Number**: 8
* **Slide Title**: Relational Database Schema & Data Integrity
* **Visual Layout**:
  - Entity-Relationship diagram highlighting the primary entities: `users`, `submissions`, `submission_files`, `student_evaluations`, `teacher_feedbacks`, and `email_batches`.
* **Exact Slide Content**:
  - **Flyway Evolution**: 12 sequential, idempotent SQL migration scripts (`V1` through `V12`).
  - **Core Entities & Keys**:
    - `users`: Core identity table with unique indexes on `email` and `google_id`.
    - `submissions`: Assignment master table with unique constraint on `(user_id, week, year, section)`.
    - `submission_files`: Child table storing file metadata, MIME type, and S3 `storage_key`.
    - `student_evaluations`: Dynamic multi-week criteria scores with multi-provider uniqueness on `(student_id, week, provider)`.
    - `teacher_feedbacks`: Independent qualitative comments preserved across AI re-evaluations.
    - `email_batches` & `email_batch_recipients`: 1-to-N batch tracking structure for mail auditing.
* **Technical Details**:
  - Foreign key cascading deletes (`ON DELETE CASCADE`) preventing orphan files.
  - Strict B-Tree indexes on search columns (`student_id`, `week`, `section`, `status`).
* **Suggested Visual**: Database ER diagram showing table cardinalities and primary/foreign keys.
* **Presenter Notes**:
  > "The database schema is the backbone of AuthPortal. Managed through 12 Flyway migration scripts, our schema ensures absolute data integrity. Notice the relational design: when a student submits, a master `submissions` record is created, and individual `.c` and `.pdf` files are linked via foreign keys in `submission_files`. Notice also the separation between `student_evaluations` and `teacher_feedbacks`: this guarantees that if an instructor re-runs an automated AI grading rubric, human feedback comments are never overwritten or lost."
* **Key Takeaway**: Normalized relational modeling with Flyway migrations ensures data consistency and auditability.

---

## Slide 9: Institutional Authentication & Zero-JWT Security Model

* **Slide Number**: 9
* **Slide Title**: Zero-Trust Authentication & Zero-JWT Redirection
* **Visual Layout**:
  - Sequence diagram illustrating the Google OAuth 2.0 flow side-by-side with the Local Registration flow.
* **Exact Slide Content**:
  - **Server-Side Role Determination**:
    - Evaluates email regex: `^[A-Za-z]\d{6}@...` $\rightarrow$ `ROLE_STUDENT`.
    - Faculty allowlist check: `TEACHER_ALLOWED_EMAILS` $\rightarrow$ `ROLE_TEACHER`.
    - Protected admin whitelist: `GOOGLE_ADMIN_EMAILS` $\rightarrow$ `ROLE_ADMIN`.
    - Zero client influence: Client registration DTO accepts no role property.
  - **Zero-JWT in URL (Single-Use Exchange Code)**:
    - Standard OAuth SPAs leak tokens in URL fragments (`?token=ey...`).
    - AuthPortal redirects with a short-lived random code (60-second TTL).
    - React exchanges the code via a secure POST request to obtain the JWT in the JSON body.
    - Eliminates token leakage in browser history, proxy logs, and Referer headers.
* **Technical Details**:
  - HMAC-SHA256 stateless tokens (24-hour expiration); thread-safe `OAuth2ExchangeCodeStore`.
* **Suggested Visual**: Sequence diagram of the exchange code protocol highlighting the "Zero-JWT in Redirect" milestone.
* **Presenter Notes**:
  > "Slide 9 presents one of our major security contributions: the Zero-JWT in URL pattern. In typical OAuth single-page applications, the backend redirects back to the frontend with the JWT directly in the URL query string. Anyone inspecting browser history, proxy server logs, or referrer headers can steal that token. In AuthPortal, our OAuth success handler issues an ephemeral, single-use exchange code with a 60-second lifespan. The frontend immediately fires a secure POST request to swap that code for the JWT. If an attacker intercepts the redirect URL, the code is already burned and useless."
* **Key Takeaway**: Eliminates client-side privilege escalation and prevents credential leakage across network boundaries.

---

## Slide 10: Student Laboratory Submission & Security Inspection Engine

* **Slide Number**: 10
* **Slide Title**: Hardened Submission Engine & Deep File Inspection
* **Visual Layout**:
  - Diagram showing upload payload entering the Magic Byte Inspection filter before being versioned and saved.
* **Exact Slide Content**:
  - **Auto-Derived Identity**: Automatically extracts student ID (`N210001`) from email while enabling manual correction.
  - **Multi-File Support**: Accepts multiple `.c` source files and `.pdf` reports per submission.
  - **Deep Executable Header Inspection**:
    - Disguised Windows Binaries: Inspects bytes for `MZ` (`0x4D, 0x5A`) $\rightarrow$ Rejected.
    - Disguised Linux Binaries: Inspects bytes for `\x7FELF` (`0x7F, 0x45, 0x4C, 0x46`) $\rightarrow$ Rejected.
    - PDF Document Signature: Confirms `%PDF-` magic header $\rightarrow$ Validated.
  - **Revision Tracking & Clean Resubmission**:
    - Detects existing submission for `(week, year, section)`.
    - Automatically increments revision version (`v1 -> v2`).
    - Purges older files from cloud storage to prevent stale orphaned assets.
  - **Self-Service Deletion**: Students can permanently delete submissions, wiping both database entries and physical cloud storage.
* **Technical Details**:
  - 20MB file limit; 500MB request limit; deterministic storage key generation.
* **Suggested Visual**: Screenshot of the Student Submission UI showing file upload zones and submission history table.
* **Presenter Notes**:
  > "Our Student Submission Engine goes far beyond simple form uploads. To protect our academic infrastructure from malware, we implemented deep magic-byte inspection. Even if a student renames a compiled binary executable to `.c` or `.pdf`, our service reads the initial file bytes from the input stream. If it detects Windows PE or Linux ELF signatures, the request is instantly rejected. Furthermore, when a student re-submits an improved assignment, the system cleanly increments the version counter and purges old files from cloud storage."
* **Key Takeaway**: Deep content inspection and automated version tracking safeguard academic servers from malicious payloads.

---

## Slide 11: Teacher Evaluation Grid, AI Report Ingestion & Human Feedback

* **Slide Number**: 11
* **Slide Title**: Interactive Teacher Evaluation Grid & AI Multi-Provider Support
* **Visual Layout**:
  - Split screen: Left showing the dynamic multi-week spreadsheet grid; Right showing the inline PDF viewer and rubric breakdown.
* **Exact Slide Content**:
  - **Dynamic Multi-Week Matrix Grid**:
    - Aggregates dynamic student rows against dynamic week columns.
    - Sub-second navigation via Stale-While-Revalidate (SWR) in-memory caching.
  - **Multi-Provider AI Report Ingestion**:
    - Ingests structured JSON evaluation reports from **Google Gemini** and **Ollama**.
    - Stores criterion scores: *Objective*, *Problem Understanding*, *Logic*, *Variables*, *Observation*, *Total*, *Final*.
  - **Inline PDF & Markdown Inspection**:
    - View student PDF lab reports directly in-browser using PDF.js.
    - Renders mathematical LaTeX expressions in reports using KaTeX typography.
  - **Human-in-the-Loop Feedback**:
    - Instructors record manual feedback comments and toggle review status (`Reviewed` / `Pending`).
    - Manual feedback is decoupled from automated AI reports to prevent overwrites.
* **Technical Details**:
  - Composite database uniqueness: `(student_id, week, provider)` supports multi-model comparison.
* **Suggested Visual**: Screenshot of the Teacher Evaluation Grid and the Expanded Student Report Modal.
* **Presenter Notes**:
  > "For faculty members, AuthPortal transforms grading. In Slide 11, you see our dynamic evaluation grid. Rather than opening hundreds of individual files, instructors see an interactive spreadsheet matrix. When clicking any student cell, the platform streams the student's actual uploaded PDF for inline reading via PDF.js while simultaneously rendering the automated evaluation report. We also support multi-provider AI ingestion: reports generated by Google Gemini or local Ollama instances are rendered with full LaTeX math support via KaTeX."
* **Key Takeaway**: Merges automated AI grading rubrics with human faculty oversight in an interactive, high-speed interface.

---

## Slide 12: Dual-Engine Automated Email Notification & Batch Dispatcher

* **Slide Number**: 12
* **Slide Title**: Cloud-Resilient Dual Mailer & Batch Dispatcher
* **Visual Layout**:
  - Architecture diagram contrasting Engine 1 (Gmail REST API over HTTPS 443) and Engine 2 (Gmail SMTP over Port 587).
* **Exact Slide Content**:
  - **The Cloud Firewall Dilemma**:
    - Cloud platforms (Render Free Tier, AWS default) block outbound SMTP ports 25, 465, and 587.
    - Standard `JavaMailSender` fails with network timeouts.
  - **Dual-Engine Solution**:
    - **Engine 1 (Cloud-Resilient)**: Direct Google Gmail REST API (v1) over **HTTPS Port 443** using OAuth2 refresh tokens. Bypasses all cloud firewall blocks!
    - **Engine 2 (Standard)**: Gmail SMTP over Port 587 with STARTTLS for local development.
  - **Asynchronous Batch Reporting**:
    - Filter cohorts by Academic Year, Branch, Section, and Week.
    - Previews candidate student recipients before dispatching.
    - Dispatches asynchronously; tracks individual recipient state (`PENDING`, `SENT`, `FAILED`).
  - **Failure Recovery & Testing**:
    - One-click retry for failed recipients.
    - Safe test mode (`targetOverrideEmail`) routes batch test emails to instructor inboxes.
* **Technical Details**:
  - Multi-stage RFC 2822 MIME generation; Base64URL payload encoding; `EmailBatchRecipient` logging.
* **Suggested Visual**: Screenshot of the Email Reports Distribution Center showing recipient progress bars and batch history.
* **Presenter Notes**:
  > "Slide 12 highlights one of our most significant engineering innovations: our Dual-Engine Mailer. When deploying our backend to the Render cloud platform, we discovered that Render strictly blocks outbound SMTP ports 25, 465, and 587 on free tiers. Standard Java mail crashed. To solve this, we integrated the Google Gmail REST API. By acquiring an OAuth2 refresh token, our backend transmits RFC 2822 messages over standard HTTPS Port 443—which is never blocked! We also built a complete batch dispatcher with real-time status tracking and individual retry buttons."
* **Key Takeaway**: Direct REST API mail transport over HTTPS Port 443 circumvents cloud network firewall limitations.

---

## Slide 13: Administrative Governance & Pluggable Cloud Storage Subsystem

* **Slide Number**: 13
* **Slide Title**: Institutional Governance & Pluggable Object Storage
* **Visual Layout**:
  - Two halves: Top showing Admin Console KPIs; Bottom showing Backblaze B2 S3 storage directory structure.
* **Exact Slide Content**:
  - **Administrative Oversight**:
    - Real-time dashboard KPI metrics: Total Users, Students, Teachers, Admins, and Submissions.
    - Searchable user management directory with role filters (`ALL`, `STUDENT`, `TEACHER`, `ADMIN`).
    - User provisioning and role assignment.
  - **Administrative Safety Guards**:
    - **Last Admin Protection**: System strictly prohibits demoting or disabling the final active administrator.
    - **Self-Disabling Guard**: Prevents logged-in administrators from disabling their own accounts.
  - **Pluggable Storage Subsystem (`StorageService`)**:
    - **Local Storage (`STORAGE_TYPE=local`)**: Atomic disk writes under `storage/` for local testing.
    - **Backblaze B2 Storage (`STORAGE_TYPE=backblaze`)**: S3-compatible cloud object store via AWS SDK for Java v2.
    - **Zero Disk Staging**: Streams files directly to/from B2 without writing temporary files to ephemeral server disks.
* **Technical Details**:
  - S3 canonical object key: `submissions/week-{w}/sec-{s}/{studentId}/{filename}`.
* **Suggested Visual**: Screenshot of the Admin Dashboard showing KPI stat cards and user action modals.
* **Presenter Notes**:
  > "Administrative governance and reliable storage are vital for institutional software. In AuthPortal, administrators have complete oversight of users and submissions. To prevent catastrophic administrative lockouts, we wrote defensive validation guards: the system physically blocks an admin from demoting the last remaining administrator or disabling their own account. On the storage side, our pluggable storage abstraction allows seamless switching between local disk and Backblaze B2 cloud storage using the AWS SDK for Java v2."
* **Key Takeaway**: Robust administrative safety constraints paired with scalable cloud object storage ensure enterprise reliability.

---

## Slide 14: Key Engineering Challenges Solved & Comparative Advantages

* **Slide Number**: 14
* **Slide Title**: Engineering Challenges Overcome & Comparative Analysis
* **Visual Layout**:
  - Problem-Solution-Impact structured cards highlighting the top four engineering achievements.
* **Exact Slide Content**:
  - **Challenge 1: Cloud SMTP Port Filtering**
    - *Solution*: Engineered `GmailRestApiService` communicating over HTTPS Port 443.
    - *Impact*: 100% reliable email delivery on free-tier cloud environments.
  - **Challenge 2: Ephemeral Filesystem Data Loss**
    - *Solution*: Integrated Backblaze B2 S3 API streaming directly from memory.
    - *Impact*: Zero data loss across server restarts; zero disk space exhaustion.
  - **Challenge 3: Disguised Executable Upload Threats**
    - *Solution*: Implemented byte-level magic header inspection (`MZ`, `\x7FELF`).
    - *Impact*: Neutralized binary payload execution vulnerabilities.
  - **Challenge 4: OAuth URL Token Leakage**
    - *Solution*: Ephemeral single-use exchange code with 60s TTL (Zero-JWT in URL).
    - *Impact*: Zero credential leakage across browser history and network proxies.
* **Technical Details**:
  - Validated through 121 backend unit and integration tests with zero failing suites.
* **Suggested Visual**: A summary comparison matrix comparing AuthPortal against Google Classroom and basic web forms.
* **Presenter Notes**:
  > "Every software project encounters unexpected real-world challenges. This slide summarizes how we turned potential roadblocks into engineering strengths. When cloud SMTP ports were blocked, we built a REST mailer over Port 443. When cloud disk storage proved ephemeral, we connected Backblaze B2 S3 storage. When students could disguise executable files, we built deep magic-byte inspection. And when OAuth redirects leaked tokens, we engineered a single-use exchange code protocol. These four innovations elevate AuthPortal from a classroom script to an enterprise product."
* **Key Takeaway**: Proactive architectural problem-solving delivers high stability, resilience, and security.

---

## Slide 15: Conclusion, Production Readiness & Future Roadmap

* **Slide Number**: 15
* **Slide Title**: Conclusion, Production Impact & Future Roadmap
* **Visual Layout**:
  - Three horizontal summary pillars: Project Achievements, Production Verification, and Future Expansion.
* **Exact Slide Content**:
  - **Key Achievements**:
    - Fully implemented, verified full-stack platform tailored for RGUKT academic governance.
    - Unified authentication, submission verification, evaluation grading, and batch reporting.
    - Production-grade security (Zero-JWT, Server RBAC, Magic Byte filtering).
  - **Production Readiness & Quality Verification**:
    - **121 Automated Tests**: Unit, integration, slice, and security tests executing cleanly.
    - Multi-stage Dockerized deployment ready for Render / AWS / On-Premise hosting.
    - 12 sequential Flyway database migrations ensuring automated schema initialization.
  - **Future Roadmap**:
    - Sandboxed code execution engine (Judge0 / Docker container execution).
    - Automated source code plagiarism analysis (Stanford MOSS integration).
    - Real-time student grade push notifications via WebSockets.
* **Technical Details**:
  - Ready for institutional rollout across all 4 RGUKT AP campuses.
* **Suggested Visual**: Final summary graphic showing AuthPortal connecting students, teachers, and university leadership, accompanied by Q&A invitation.
* **Presenter Notes**:
  > "In conclusion, AuthPortal successfully delivers a complete, secure, and production-ready laboratory management system. We have replaced fragmented, insecure tools with a modern platform that enforces institutional identity, safeguards infrastructure, and accelerates feedback loops. Backed by 121 automated tests, multi-stage Docker builds, and cloud-resilient storage and mail systems, AuthPortal is ready for live deployment across RGUKT campuses. Thank you for your time, and we now welcome any questions."
* **Key Takeaway**: A fully verified, production-ready platform delivering immediate operational and educational value to higher education institutions.
