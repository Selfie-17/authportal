# Project Overview & Abstract: Institutional Authentication & Academic Evaluation Portal

---

## 1. Project Metadata

* **Project Title**: RGUKT Institutional Authentication, Laboratory Submission & Evaluation Portal (AuthPortal)
* **Domain**: Cloud Computing, Enterprise Web Systems & Educational Technology (EdTech)
* **Sub-Domain**: Role-Based Access Control (RBAC), Secure Cloud Storage, Automated Evaluation Pipeline, and Resilient Batch Mail Delivery
* **Target Institution**: Rajiv Gandhi University of Knowledge Technologies (RGUKT) — AP Campuses (Nuzvid, RK Valley, Ongole, Srikakulam)
* **Primary Target User Base**: 20,000+ Undergraduate Engineering Students, Laboratory Faculty/Instructors, and Department Administrators
* **Backend Architecture**: Java 21, Spring Boot 4.0.8, Spring Security 6, Spring Data JPA, Flyway, AWS SDK v2
* **Frontend Architecture**: React 19, Vite 6, React Router DOM 7, Vanilla CSS Design System, KaTeX, PDF.js
* **Database & Cloud Storage**: MySQL 8.0 (Aiven Cloud / Docker), Backblaze B2 S3-Compatible Object Store

---

## 2. Academic Abstract

In collegiate engineering education, continuous laboratory evaluation presents significant administrative, pedagogical, and security challenges. Conventional evaluation workflows rely heavily on disparate tools—such as generic Google Forms, insecure file sharing, or ad-hoc email submissions—which lack automated institutional identity verification, revision auditing, structured evaluation ingestion, and scalable report distribution. Furthermore, unrestricted file upload portals often introduce critical security vulnerabilities, including executable payload injection, cross-student privilege escalation, and token exposure in browser navigation histories.

To address these systemic challenges, this project presents **AuthPortal**, a robust, production-ready, full-stack institutional platform engineered using **Java 21**, **Spring Boot 4**, **Spring Security 6**, and **React 19**. The platform establishes a **Zero-Trust Institutional Authentication Framework** that couples Google OAuth 2.0 / OpenID Connect with strict server-side institutional email parsing (`^[A-Za-z]\d{6}@(rguktn|rguktrkv|rguktong|rguktsklm)\.ac\.in`). This eliminates client-side role forgery and prevents OAuth token leakage via an ephemeral single-use authorization code exchange mechanism (**Zero-JWT in URL**).

The system integrates a hardened **Student Laboratory Submission Engine** featuring multi-byte magic header inspection to block disguised Windows PE, Linux ELF, and Mach-O executables while facilitating versioned source code (`.c`) and lab report (`.pdf`) submissions. For faculty, AuthPortal offers an **Interactive Multi-Week Evaluation Grid** capable of ingesting structured evaluation outputs from both cloud-native (Google Gemini) and local (Ollama) artificial intelligence evaluation models alongside standard tabular formats. Faculty can review original student PDFs inline, append qualitative feedback, and adjust quantitative marks.

Crucially, to overcome cloud deployment constraints where platforms like Render block standard SMTP ports (25, 465, 587) on free tiers, AuthPortal implements a **Dual-Engine Notification Architecture**. The system seamlessly alternates between standard **Gmail SMTP** and direct **Google Gmail REST API (v1)** invocation over HTTPS port 443 using an OAuth2 refresh token. Additionally, the platform features a pluggable storage subsystem abstracting local disk and **Backblaze B2 S3** storage, accompanied by an on-the-fly streaming ZIP aggregation engine for instant section-wide lab downloads. The platform has been validated through 121+ automated integration and unit test suites, demonstrating high reliability, enterprise-grade security, and production readiness.

---

## 3. Executive Summary

| Dimension | Project Specification |
| :--- | :--- |
| **System Problem** | Chaotic manual lab submissions, zero tamper protection, executable threats, manual email distribution, and cloud SMTP network blocking. |
| **Architectural Solution** | Decoupled client-server architecture with stateless JWT, server-enforced RBAC, pluggable cloud object storage, and dual-transport mail delivery. |
| **Authentication Security** | Google OAuth2/OIDC + BCrypt credentials, Zero-JWT exchange code pattern (60s TTL), and strict regex-based campus role determination. |
| **Laboratory Submission** | Multi-file upload (`.c` + `.pdf`), magic byte executable detection (`MZ`, `\x7FELF`, Mach-O), atomic storage, and automated revision incrementation (`v1 -> v2`). |
| **Evaluation Management** | Multi-week dynamic matrix grid, multi-provider report ingestion (Gemini, Ollama), PDF inline viewing via PDF.js, and human-in-the-loop feedback persistence. |
| **Communication Pipeline** | Asynchronous batch mailing, real-time recipient tracking, ZIP evaluation extraction, and HTTPS Port 443 Gmail REST API fallback. |
| **Storage Architecture** | Storage abstraction layer supporting local filesystem and Backblaze B2 S3 storage with direct streaming and zero disk staging. |
| **Verification & Quality** | 121 automated backend unit/integration tests with isolated H2 DB; zero mock dependencies for production flows. |

---

## 4. Institutional Context: RGUKT University System

The Rajiv Gandhi University of Knowledge Technologies (RGUKT) in Andhra Pradesh caters to rural, meritorious youth through an intensive six-year integrated B.Tech curriculum across four premier campuses:
1. **RGUKT Nuzvid Campus (`@rguktn.ac.in`)**
2. **RGUKT RK Valley / Idupulapaya Campus (`@rguktrkv.ac.in`)**
3. **RGUKT Ongole Campus (`@rguktong.ac.in`)**
4. **RGUKT Srikakulam Campus (`@rguktsklm.ac.in`)**
5. **RGUKT Central / Alternate Google Domain (`@rgukt.in`)**

Each academic semester involves approximately 1,000+ students per year-level per campus completing weekly programming assignments (e.g., C Programming, Data Structures, Algorithms). Evaluating, reviewing, storing, and emailing reports for thousands of weekly laboratory submissions across 12 consecutive weeks creates an enormous computational and operational bottleneck. AuthPortal was tailored specifically to automate this institutional lifecycle while enforcing collegiate governance rules.

---

## 5. Core Innovations & Technical Contributions

```text
+--------------------------------------------------------------------------------------------------+
|                                    AUTHPORTAL CORE INNOVATIONS                                   |
+--------------------------------------------------------------------------------------------------+
|  1. Zero-JWT in URL Redirection                                                                  |
|     Issues an ephemeral single-use 60s exchange code on Google OAuth redirect to eliminate       |
|     JWT leakage in browser history, proxy logs, and HTTP Referer headers.                        |
+--------------------------------------------------------------------------------------------------+
|  2. Server-Enforced Role Resolution                                                              |
|     Roles are strictly determined by parsing institutional email domains and student ID regex.   |
|     Clients can never self-assign or elevate privileges during registration or login.            |
+--------------------------------------------------------------------------------------------------+
|  3. Deep Magic-Byte Executable Blocker                                                           |
|     Inspects raw initial file bytes to reject Windows PE (MZ), Linux ELF, and Mach-O binaries   |
|     even if students maliciously rename binaries to .c or .pdf.                                  |
+--------------------------------------------------------------------------------------------------+
|  4. Dual-Engine Cloud-Resilient Mailer                                                           |
|     Implements both standard SMTP (port 587) and Google Gmail REST API over HTTPS (port 443).   |
|     Bypasses cloud provider firewall restrictions on outbound SMTP ports (Render Free Tier).     |
+--------------------------------------------------------------------------------------------------+
|  5. Pluggable Zero-Staging Cloud Storage                                                         |
|     Decoupled storage service supporting Local Disk and Backblaze B2 (AWS SDK v2). Streams      |
|     files directly to/from client memory without saving temporary files to ephemeral disks.     |
+--------------------------------------------------------------------------------------------------+
|  6. Dynamic Multi-Week Evaluation Grid & AI Multi-Provider Support                               |
|     Aggregates dynamic weeks and students in a single query; seamlessly supports AI evaluations  |
|     generated by Google Gemini and Ollama with LaTeX KaTeX rendering.                            |
+--------------------------------------------------------------------------------------------------+
```

---

## 6. Project Scope

### In-Scope (Implemented and Verified in Code)
- Institutional registration and authentication via Google OAuth 2.0 / OIDC and local credentials.
- Strict server-side role resolution for Student, Teacher, and Administrator accounts.
- Student laboratory submission workflow with file validation, version tracking, and self-service deletion.
- Secure file storage abstraction with local disk and Backblaze B2 S3 support.
- On-the-fly streaming ZIP aggregation for bulk faculty downloads.
- Teacher evaluation spreadsheet table with dynamic week discovery and search/filtering.
- Inline PDF viewing and extracted markdown report rendering with KaTeX mathematical typography.
- Multi-provider evaluation storage supporting both Gemini and Ollama rubrics.
- Teacher manual feedback notes, review toggling, and score overrides.
- Dual-engine email notification system supporting Gmail SMTP and Gmail REST API (v1).
- Batch email distribution with real-time recipient tracking, error logging, and retry mechanisms.
- ZIP report extraction with automated student ID and email mapping.
- Administrative control console with KPI metrics, user provisioning, role promotion/demotion guards, and submission management.
- Complete database migration suite with 12 sequential Flyway scripts.
- Test harness consisting of 121 automated backend tests.

### Out-of-Scope (Future Enhancements)
- Automated code compilation and sandbox execution (e.g., executing submitted `.c` files against unit test suites via Judge0 or Docker containers).
- Plagiarism detection engine between submitted source code files (e.g., integrating Stanford MOSS).
- Native push notifications via WebSockets or mobile app wrappers.
- Payment gateway or fee processing (not applicable to institutional academic workflows).
