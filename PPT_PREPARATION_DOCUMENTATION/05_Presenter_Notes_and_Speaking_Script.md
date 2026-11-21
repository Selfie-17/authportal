# Presenter Notes & Speaking Scripts: Academic Presentation & Viva Defense

---

## 1. Quick-Start Presentation Timers & Delivery Scripts

This document provides three battle-tested verbal scripts tailored for different presentation scenarios during academic reviews, internal vivas, and technical interviews.

---

### Script A: 1-Minute Elevator Pitch
*Target Scenario: Quick introductory round, poster session, or rapid evaluator query.*

> "Good morning, respected evaluators. My project is **AuthPortal**, an institutional authentication, laboratory submission management, and continuous academic evaluation platform engineered for the multi-campus university system of RGUKT. 
>
> In university engineering labs, evaluating thousands of weekly programming assignments using Google Forms or email is insecure, unversioned, and administrative chaos. AuthPortal solves this by establishing a **Zero-Trust Institutional Security Model** using Google OAuth 2.0 and Spring Security, where user roles are strictly derived server-side from institutional email domains, with zero token leakage in redirect URLs. 
>
> On the student side, our submission engine inspects raw magic bytes to block disguised executable malware and handles multi-file C code and PDF lab reports with automated revision tracking. For teachers, we deliver an interactive evaluation spreadsheet grid that ingests AI reports from Google Gemini and Ollama, renders LaTeX math, and streams original student PDFs inline. 
>
> Crucially, to bypass cloud provider firewall blocks on outbound SMTP ports, we engineered a dual-engine mailer using the Google Gmail REST API over HTTPS Port 443. Backed by 121 automated backend tests and 12 Flyway migrations, AuthPortal is production-ready for university deployment. Thank you!"

---

### Script B: 3-Minute Academic Summary
*Target Scenario: Standard B.Tech major project presentation (3–4 minutes speaking time).*

> "Respected faculty members and evaluators, I am excited to present **AuthPortal**, a production-grade full-stack academic platform developed to modernize collegiate laboratory evaluation.
>
> **The Problem:** At RGUKT, over 20,000 undergraduate engineering students submit hands-on programming assignments every week across 12 consecutive lab weeks. Traditionally, colleges manage this through fragmented tools like Google Forms and offline Excel sheets. This approach suffers from severe privilege escalation vulnerabilities, zero version tracking, and malware risks because basic file extension filters cannot detect compiled binaries disguised as source code. Furthermore, sending evaluated reports back to students via email frequently fails on cloud platforms like Render because outbound SMTP ports are blocked.
>
> **Our Architectural Solution:** We engineered a decoupled, enterprise architecture using **Java 21**, **Spring Boot 4**, **Spring Security 6**, and **React 19**, backed by **MySQL 8** and **Backblaze B2 S3 Object Storage**. 
>
> Our technical contributions span four critical areas:
>
> 1. **Zero-Trust Institutional Authentication**: We integrated Google OAuth 2.0 with strict server-side institutional email parsing (`@rguktn.ac.in`). Roles cannot be self-selected by the client. To eliminate OAuth token leakage, we implemented a single-use 60-second exchange code pattern that ensures zero JWT exposure in redirect URLs.
> 2. **Hardened Submission Engine**: Our submission service reads raw file headers to detect and reject Windows PE and Linux ELF executables even if disguised with `.c` extensions. It provides automated revision incrementation (`v1` to `v2`) and atomic deletion of files and database records.
> 3. **Dynamic Evaluation Matrix Grid**: For instructors, our frontend renders an interactive spreadsheet matrix with dynamic week columns. Faculty can view original student PDFs inline via PDF.js, review structured AI evaluation outputs from Google Gemini and Ollama with KaTeX math rendering, and record qualitative feedback comments that are permanently preserved across re-evaluations.
> 4. **Cloud-Resilient Dual Mailer**: When deploying on cloud platforms like Render, standard SMTP ports 587 and 25 are blocked. We solved this by developing `GmailRestApiService`, which dispatches RFC 2822 messages directly over HTTPS Port 443 via the Google Gmail REST API using OAuth2 refresh tokens.
>
> **Validation & Quality:** The platform is validated by **121 automated unit and integration tests** running against an isolated in-memory test database, and managed by 12 sequential Flyway migrations.
>
> AuthPortal replaces fragmented, insecure tools with an institutional platform that protects university infrastructure and accelerates academic feedback. Thank you, and I look forward to your questions."

---

### Script C: 5-Minute In-Depth Technical Defense
*Target Scenario: Comprehensive technical project defense, external evaluation panel, or technical interview.*

> "Respected members of the evaluation committee, good morning. Today, I am presenting the architecture, security engineering, and implementation of **AuthPortal**—an institutional authentication, laboratory submission, and academic evaluation system designed for large-scale engineering education.
>
> **1. Architectural Foundation & Tech Stack:**
> AuthPortal is built upon a decoupled three-tier architecture. The backend is implemented in **Java 21** using **Spring Boot 4.0.8**, leveraging modern language records, pattern matching, and Spring Security 6 for stateless method-level security. The persistence layer utilizes **Spring Data JPA** with **MySQL 8.0**, with schema evolution managed strictly through **12 sequential Flyway migrations**. For file persistence, we implemented a pluggable storage abstraction layer supporting both local disk storage and cloud-native **Backblaze B2 S3 Object Storage** using the AWS SDK for Java v2. The frontend is a high-performance Single Page Application built with **React 19**, **Vite 6**, and **React Router DOM 7**, styled with a lightweight, accessible CSS design system.
>
> **2. Institutional Security & The Zero-JWT Redirection Pattern:**
> Security is our core priority. In typical collegiate portals, users select their own roles during sign-up, leading to unauthorized privilege escalation. In AuthPortal, user roles (`STUDENT`, `TEACHER`, `ADMIN`) are strictly resolved on the server by `EmailRoleResolver`. During Google OAuth 2.0 / OpenID Connect authentication, the backend validates the user's institutional email domain against our university configuration. If the domain is valid, a regex pattern parses student registration IDs like `N210001`, assigning `ROLE_STUDENT`, while faculty accounts are verified against server-side allowlists.
>
> More importantly, traditional Single Page Applications expose JWT access tokens directly in URL hash fragments or query parameters during OAuth redirects. This leaks sensitive credentials into browser history, server logs, and HTTP Referer headers. To eliminate this vulnerability, we engineered `OAuth2ExchangeCodeStore`. Upon successful Google login, the backend generates an ephemeral, cryptographically secure 32-byte single-use exchange code with a 60-second Time-To-Live. The browser receives only this temporary code in the redirect. The React client immediately fires a secure `POST /api/auth/oauth2/exchange` request, burning the code and receiving the signed HMAC-SHA256 JWT in the JSON response body.
>
> **3. Laboratory Submission & Binary Malware Neutralization:**
> For weekly laboratory submissions, students upload `.c` source code files and `.pdf` reports for a specific Week, Year Level, and Section. To protect faculty evaluation machines and cloud servers, our `SubmissionService` implements deep magic-byte inspection. Instead of trusting file extensions, the service inspects the initial bytes of uploaded file streams. If it detects the Windows Portable Executable signature `MZ` (`0x4D, 0x5A`) or the Linux ELF signature `\x7FELF`, the upload is rejected immediately. When students resubmit an assignment, our versioning algorithm increments the revision counter (`v1 -> v2`) and purges obsolete files from cloud storage. Furthermore, for faculty convenience, our `ZipArchiveService` streams an entire section's submissions on-the-fly as a structured ZIP archive without buffering files to disk.
>
> **4. Multi-Week Evaluation Grid & KaTeX Math Rendering:**
> Grading lab assignments across 12 weeks requires speed and clarity. Our frontend implements an interactive evaluation spreadsheet grid backed by Stale-While-Revalidate (SWR) in-memory caching. Faculty can view all student submissions, click any cell to stream the student's original uploaded PDF inline via PDF.js, and review automated AI evaluation reports produced by **Google Gemini** or **Ollama**. Our frontend integrates **KaTeX** to render complex mathematical formulas embedded in Markdown observation reports. Faculty can also record qualitative feedback notes and adjust numerical marks, with teacher feedback stored in a dedicated table to ensure human comments are never overwritten by automated re-evaluations.
>
> **5. Cloud-Resilient Dual Mailer Architecture:**
> When hosting academic software on budget cloud infrastructure like Render Free Tier, developers encounter a severe obstacle: outbound traffic on SMTP ports 25, 465, and 587 is blocked to prevent spam. Traditional Java mail senders fail completely. We solved this by developing a dual-engine mail architecture. While the system supports standard Gmail SMTP on port 587 for local development, in cloud environments it seamlessly utilizes `GmailRestApiService`. This service acquires an OAuth2 refresh token and dispatches RFC 2822 MIME messages directly via the **Google Gmail REST API (v1)** over standard **HTTPS Port 443**—which is never blocked. We built an asynchronous batch dispatcher that previews recipients, tracks individual delivery states (`PENDING`, `SENT`, `FAILED`), and provides one-click retries.
>
> **6. Verification & Quality Assurance:**
> AuthPortal has been validated with **121 automated backend tests** covering controllers, services, security filters, and repository specifications. All tests execute against an isolated in-memory H2 database with zero external dependencies.
>
> In conclusion, AuthPortal proves that institutional software can be robust, elegant, and secure. Thank you, and I am now ready for your questions."

---

## 2. Slide-by-Slide Speaking Script & Timing Guide

| Slide | Title | Ideal Duration | Key Verbal Cue / Talking Point |
| :---: | :--- | :---: | :--- |
| **1** | Title Slide | 20 sec | Introduce team, project title, institutional affiliation, and full-stack scope. |
| **2** | Institutional Context | 40 sec | Highlight 20,000+ students, 4 RGUKT campuses, and 12-week continuous lab evaluation scale. |
| **3** | Problem Statement | 45 sec | Explain privilege escalation, disguised binaries, URL token leaks, and cloud SMTP blocks. |
| **4** | Proposed Solution | 40 sec | Present the 4 core pillars: Zero-Trust Security, Hardened Submissions, Evaluation Grid, Dual Mailer. |
| **5** | Project Objectives & Scope | 30 sec | Clarify strict functional boundaries; highlight what was implemented and tested. |
| **6** | Technology Stack & Rationale | 45 sec | Justify Java 21, Spring Boot 4, React 19, Backblaze B2, and Flyway migrations. |
| **7** | High-Level Architecture | 45 sec | Walk through 3 tiers: React presentation, Spring Security filter pipeline, MySQL/B2 data tier. |
| **8** | Database Schema Design | 45 sec | Explain 8 relational entities, 12 Flyway migrations, unique constraints, and cascade rules. |
| **9** | Zero-JWT Authentication | 50 sec | Detail the 60s exchange code protocol and server-side institutional email parsing. |
| **10** | Submission Engine & Magic Bytes | 45 sec | Explain executable header detection (`MZ`, `\x7FELF`), revision tracking, and atomic deletion. |
| **11** | Evaluation Grid & AI Reports | 50 sec | Demonstrate dynamic spreadsheet matrix, inline PDF viewer, KaTeX formulas, and teacher feedback. |
| **12** | Dual-Engine Cloud Mailer | 50 sec | Explain why Render blocks port 587 and how Gmail REST API over HTTPS 443 guarantees delivery. |
| **13** | Admin Console & Cloud Storage | 40 sec | Show KPI metrics, last admin demotion guard, and Backblaze B2 S3 storage abstraction. |
| **14** | Engineering Challenges Solved | 45 sec | Summarize the 4 major challenges overcome and comparative advantages. |
| **15** | Conclusion & Roadmap | 30 sec | Reiterate production readiness, 121 passing tests, and invite questions. |

---

## 3. Presenter Delivery Tips & Confidence Hacks

### Physical Delivery & Vocal Presence
- **Pacing**: Speak at a measured tempo of approximately 130–140 words per minute. Do not rush through technical terms.
- **Vocal Emphasis**: Stress key technical phrases: *"Server-enforced role resolution"*, *"Zero-JWT in URL"*, *"Magic-byte header inspection"*, *"HTTPS Port 443 direct REST transport"*, and *"121 automated tests"*.
- **Eye Contact**: Divide eye contact evenly between the external examiner, department head, and guide. Never stare continuously at the screen or slides.
- **Physical Demeanor**: Stand upright with hands relaxed or gesturing open-palmed. Use a laser pointer or cursor deliberately to highlight architecture blocks on the slide.

### Handling Evaluator Interruptions
- If an evaluator interrupts with a technical question (e.g., *"How do you prevent a student from submitting another student's ID?"*), remain composed, smile slightly, and answer directly before resuming:
  > *"Thank you, Professor. In `SubmissionController.java`, line 74, we resolve the authenticated user strictly from the verified JWT in the SecurityContext. We verify that the student ID matches the institutional email prefix. If there is any discrepancy, the request is rejected immediately with a 400 Bad Request."*
- If an evaluator asks about future features (e.g., *"Can it compile and execute C code?"*):
  > *"That is an excellent observation, sir. In our current architecture, automated sandboxed code execution using Judge0 or Docker containers was placed in our future roadmap so we could prioritize bulletproof identity, executable neutralization, and cloud-resilient mail distribution. However, our modular service architecture is designed so a SandboxedExecutionService can be plugged into `SubmissionService` seamlessly."*
