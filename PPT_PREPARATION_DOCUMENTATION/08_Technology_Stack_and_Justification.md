# Technology Stack & Deep Architectural Justification

---

## 1. Global Technology Matrix

| Layer | Component | Version | Core Purpose | Primary Reason for Selection |
| :--- | :--- | :---: | :--- | :--- |
| **Backend Runtime** | **Java** | `21 (LTS)` | Core application runtime | Type safety, Virtual Thread readiness, Generational ZGC, enterprise LTS stability. |
| **Backend Framework** | **Spring Boot** | `4.0.8 / 3.4.x` | Application framework & IoC | Mature ecosystem, enterprise security integration, and battle-tested dependency injection. |
| **Security Engine** | **Spring Security** | `6.x` | Authentication & authorization | Declarative filter chains, stateless session management, and method-level `@PreAuthorize` security. |
| **OAuth Integration** | **Spring Security OAuth2 Client** | `6.x` | Google OpenID Connect | Automated authorization code exchange, token validation, and federated identity claims extraction. |
| **Token Cryptography** | **JJWT (`io.jsonwebtoken`)** | `0.12.6` | Stateless JWT issuance & parsing | RFC 7519 compliance, modern immutable builder API, and HMAC-SHA256 signature verification. |
| **Data Persistence** | **Spring Data JPA & Hibernate** | `6.x` | Object-Relational Mapping (ORM) | Repository abstraction, type-safe queries, MySQL dialect optimization, and DDL validation. |
| **Database Migrations** | **Flyway** | `10.x` | Schema version control | 12 reproducible, idempotent SQL migrations (`V1`–`V12`) executing across local and cloud DBs. |
| **Cloud Storage SDK** | **AWS SDK for Java v2** | `2.29.50` | S3 API integration for Backblaze B2 | Non-blocking streaming I/O, enterprise durability, vendor-neutral S3 compatibility. |
| **HTML Sanitization** | **Jsoup** | `1.18.3` | Parsing & inlining email HTML | Cleans untrusted HTML and inlines CSS styles for consistent rendering across email clients. |
| **Email Transports** | **JavaMailSender + Gmail REST API** | `v1` | Dual-engine message dispatch | Overcomes cloud provider firewall blocks on outbound SMTP ports (Render Free Tier). |
| **Frontend Runtime** | **JavaScript (ES Modules)** | `ES2024` | Client-side scripting | Universal browser support, clean modular imports, and fast native execution. |
| **Frontend Framework** | **React** | `19.0.0` | UI component architecture | Declarative rendering, cutting-edge hooks, concurrent features, and lightweight footprint. |
| **Frontend Build Tool** | **Vite** | `6.0.0` | Dev server & bundle packager | Sub-second Hot Module Replacement (HMR) and optimized Rollup-based production tree-shaking. |
| **Frontend Routing** | **React Router DOM** | `7.1.0` | Client-side page navigation | Declarative routing, nested protected layouts, and browser history synchronization. |
| **Math Typography** | **KaTeX** | `0.18.7` | Mathematical formula rendering | Ultra-fast LaTeX formula parser rendering mathematical notation in evaluation reports. |
| **PDF Rendering** | **PDF.js (`pdfjs-dist`)** | `6.3.289` | In-browser canvas PDF rendering | Renders student lab reports directly in-browser without third-party plugins. |
| **Relational Database** | **MySQL** | `8.0` | Primary transactional datastore | ACID transactions, foreign key cascades, and high-performance composite B-Tree indexing. |
| **Object Storage** | **Backblaze B2** | S3 API | Persistent file storage | 99.999999999% durability, zero disk staging, and 80% cheaper than Amazon AWS S3. |
| **Containerization** | **Docker** | Multi-Stage | Packaging & cloud deployment | Eclipse Temurin 21 JRE runtime, layer caching, and lightweight portable image. |

---

## 2. In-Depth Architectural Justifications

---

### 2.1 Why Java 21 LTS & Spring Boot instead of Node.js/Express or Python/Django?

#### 1. Strict Compile-Time Type Safety for Critical Academic Operations
In higher education platforms managing institutional grades, student identities, and file uploads, runtime type errors are catastrophic. 
- Python and JavaScript (Node.js) are dynamically typed; subtle bugs (e.g., passing a `null` user object or undefined role string) frequently manifest in production runtime crashes.
- Java 21 provides strong static typing, compile-time record immutability (`record BatchSendRequest(...)`), and pattern matching, ensuring that invalid states are caught during build time before deployment.

#### 2. Enterprise-Grade Security Filter Pipeline
Spring Security 6 provides an uncompromised, layered security model. Unlike Node.js Express middleware where authentication guards must be manually wired on every individual route (leaving routes vulnerable if a developer forgets a middleware declaration), Spring Security uses a centralized, declarative `SecurityFilterChain` that enforces:
- Global request matchers (`.requestMatchers("/api/admin/**").hasRole("ADMIN")`).
- Method-level security annotations (`@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")`).
- Centralized exception entry points (`JwtAuthenticationEntryPoint`, `RestAccessDeniedHandler`).

#### 3. Native Multithreading & High Throughput
Node.js operates on a single-threaded event loop. CPU-intensive operations—such as calculating SHA-256 HMAC tokens, inspecting file magic bytes for large multi-part uploads, and compressing multi-gigabyte ZIP archives—block the Node.js event loop, degrading latency for all concurrent users. Java 21 utilizes an advanced multi-threaded execution model capable of handling compute-heavy ZIP streaming and background batch email dispatching across CPU cores without impacting REST API responsiveness.

---

### 2.2 Why React 19 + Vite instead of Next.js, Angular, or Traditional Server MVC?

#### 1. Why Not Next.js (SSR)?
Next.js couples the frontend to a Node.js runtime for Server-Side Rendering (SSR). In our architecture, the backend is strictly powered by Java 21 Spring Boot. Introducing Next.js would require running and maintaining two independent backend server processes (a Node.js SSR server and a Spring Boot API server), increasing hosting costs and operational complexity.
- React 19 + Vite compiles to pure, static HTML, CSS, and JavaScript bundles.
- These static assets can be deployed to high-speed CDNs (Cloudflare, Vercel, or GitHub Pages) for zero dollars, while our Spring Boot container remains the single authoritative API backend.

#### 2. Why Vite 6 instead of Create-React-App (Webpack)?
Create-React-App is deprecated and uses Webpack, which bundles the entire dependency graph before launching the development server, resulting in 30-to-60 second startup delays.
- Vite 6 leverages native ES Modules (ESM) in modern browsers.
- Cold server start occurs in under 300 milliseconds.
- Hot Module Replacement (HMR) updates components in real time without refreshing browser state.
- Production builds use Rollup for optimal dead-code elimination (tree-shaking).

#### 3. Why React 19 instead of Angular or Vue?
React 19 offers the largest, most vibrant open-source ecosystem for academic document rendering. Essential specialized libraries used in this project—such as **Mozilla's PDF.js** (`pdfjs-dist`) for inline PDF viewing and **KaTeX** for mathematical formula rendering—have first-class, battle-tested React integrations.

---

### 2.3 Why MySQL 8.0 & Flyway instead of MongoDB or Raw JDBC?

#### 1. Relational Integrity & Cascading Constraints
Laboratory management is inherently relational:
- A `User` has many `Submissions`.
- A `Submission` contains multiple `SubmissionFiles`.
- A `StudentEvaluation` maps to one `TeacherFeedback`.
- An `EmailBatch` owns multiple `EmailBatchRecipients`.
In a NoSQL database like MongoDB, relationships must be manually maintained in application code. If a student submission is deleted, orphaned files and reviews can linger undetected. In MySQL 8.0, foreign keys enforce referential integrity with declarative cascading actions (`ON DELETE CASCADE`), ensuring database consistency at the engine level.

#### 2. Composite Unique Constraints for Academic Logic
To prevent duplicate submissions or duplicate evaluation records, MySQL enforces composite unique constraints:
- `uq_user_week_year_sec UNIQUE (user_id, week, year, section)`: Guarantees that a student cannot have two conflicting submissions for the same lab assignment.
- `uq_eval_student_week_provider UNIQUE (student_id, week, provider)`: Allows storing both Google Gemini and Ollama evaluations for the same student while preventing duplicate entries.

#### 3. Why Flyway instead of Hibernate `ddl-auto=update`?
Allowing Hibernate to automatically modify database tables (`ddl-auto=update`) is hazardous in production: it never drops columns, cannot handle complex data transformations, and can corrupt indexes during concurrent restarts.
- AuthPortal enforces `spring.jpa.hibernate.ddl-auto=validate`.
- Database schema changes are version-controlled through **12 sequential Flyway migration scripts** (`V1` to `V12`).
- On application startup, Flyway checks the `flyway_schema_history` table, executes unapplied migrations inside database transactions, and records cryptographic checksums, guaranteeing that the local Docker database and cloud Aiven MySQL remain identical.

---

### 2.4 Why Backblaze B2 (AWS SDK v2 S3 API) instead of Local Disk or AWS S3?

#### 1. The Ephemeral Cloud Disk Problem
When hosting applications on Platform-as-a-Service (PaaS) clouds like Render, Heroku, or Fly.io, containers run on **ephemeral filesystems**. Whenever the application redeploys, restarts, or crashes, the local disk is wiped clean. Saving student code and PDF reports to local server disk would result in total data loss.

#### 2. Why Not Amazon AWS S3?
While Amazon S3 is the industry benchmark, it is prohibitively expensive for university projects and budget-constrained educational institutions:
- AWS charges \$0.023 per GB/month for storage and up to \$0.09 per GB for outbound internet egress bandwidth.
- Accidental traffic spikes can trigger unexpected, exorbitant cloud bills.

#### 3. The Backblaze B2 Advantage
- **Cost**: Backblaze B2 costs \$0.006 per GB/month (approximately 75% cheaper than AWS S3).
- **Free Bandwidth**: Offers free egress downloads up to three times stored data per month.
- **Enterprise Durability**: Provides 99.999999999% (11 9's) data durability across multiple redundant data centers.
- **Standard S3 Compatibility**: Backblaze B2 exposes an S3-compatible REST API. AuthPortal integrates the official **AWS SDK for Java v2 (`software.amazon.awssdk:s3`)**, allowing the application to switch seamlessly between Backblaze B2, AWS S3, or local MinIO without altering a single line of Java code.

---

### 2.5 Why a Dual-Engine Mailer (Gmail REST API + SMTP) instead of Brevo or SMTP Alone?

#### 1. The Cloud Firewall Block (The Render Dilemma)
Cloud platforms like Render explicitly block all outbound traffic on standard SMTP ports (25, 465, and 587) on free tiers to prevent malicious actors from using their servers for email spam. Configuring Spring Boot's standard `JavaMailSender` over port 587 on Render results in immediate connection timeouts.

#### 2. Why Not Brevo (Sendinblue) or SendGrid?
- **Institutional Spam Filters**: Free-tier commercial email services (SendGrid, Brevo) send from shared IP pools. University mail servers (like RGUKT's `@rguktn.ac.in`) frequently block or flag emails originating from shared transactional IP addresses.
- **Strict Free Quotas**: Free tiers enforce severe daily caps (e.g., 100–300 emails/day), making it impossible to send weekly lab evaluation reports to cohorts of 500+ students.

#### 3. The Dual-Engine Engineering Solution
AuthPortal implements two independent mail delivery engines:
- **Engine 1: Google Gmail REST API (v1) over HTTPS Port 443**: Bypasses network firewalls by dispatching messages over standard encrypted web traffic (Port 443). Uses OAuth2 refresh tokens and sends directly from the verified institutional Gmail account (`uday@rguktn.ac.in` / `no-reply@rguktn.ac.in`), guaranteeing high inbox deliverability.
- **Engine 2: Gmail SMTP on Port 587**: Provides standard JavaMailSender dispatching for local development and unblocked enterprise hosting environments.

---

### 2.6 Why JJWT with Zero-JWT Single-Use Code Exchange instead of Cookies or Session IDs?

#### 1. Stateless Horizontally Scalable Architecture
Traditional session cookies require the backend to maintain a sticky session or an in-memory session store (like Redis). If the backend is scaled to multiple container instances, session affinity must be managed.
- JWT (JSON Web Tokens) are completely stateless.
- Every token carries its own cryptographically signed payload (`userId`, `role`, `email`, `expiration`).
- Any backend instance can verify token authenticity using the shared HMAC-SHA256 secret key without querying a session database.

#### 2. Zero-JWT in URL Redirection Protocol
Standard OAuth single-page applications pass the JWT directly in the URL redirect (`https://frontend/?token=ey...`). This creates severe security vulnerabilities:
- The token is saved in browser history.
- The token is exposed in server access logs.
- The token leaks via HTTP `Referer` headers when clicking external links.
- Browser extensions can read the URL and steal the token.
AuthPortal eliminates this vulnerability by issuing an ephemeral 32-byte single-use exchange code with a 60-second TTL. The client exchanges this code via an authenticated POST request to receive the JWT in the JSON body, ensuring that sensitive tokens never appear in browser address bars or navigation logs.

---

## 3. Specialized Libraries & Utilities Analysis

### 3.1 Jsoup 1.18.3
- **Role**: Java HTML Parser and Sanitizer.
- **Usage in Project**: When teachers upload evaluation reports or when the system extracts HTML reports from ZIP files, Jsoup cleans untrusted tags, validates document structure, inlines CSS styling, and formats score tables so that evaluation reports render beautifully across all desktop and mobile email clients.

### 3.2 KaTeX 0.18.7
- **Role**: High-performance mathematical typesetting library for the web.
- **Usage in Project**: Evaluated laboratory reports frequently contain mathematical logic, algorithmic recurrence relations (e.g., $T(n) = 2T(n/2) + \mathcal{O}(n)$), and circuit formulas. KaTeX parses LaTeX expressions synchronously without DOM layout thrashing, rendering formulas significantly faster than MathJax.

### 3.3 Mozilla PDF.js (`pdfjs-dist` 6.3.289)
- **Role**: HTML5 Canvas PDF rendering engine.
- **Usage in Project**: Allows faculty to inspect student lab reports inline directly inside the web browser. Streamed directly from Backblaze B2 S3 storage, PDF.js renders pages on an HTML5 canvas without requiring external PDF plugins or Adobe Acrobat.

### 3.4 Project Lombok
- **Role**: Java boilerplate reduction annotation processor.
- **Usage in Project**: Eliminates repetitive getters, setters, constructors, and builder patterns through annotations like `@Getter`, `@Setter`, `@Builder`, `@RequiredArgsConstructor`, and `@Slf4j`. Ensures cleaner, more maintainable code without sacrificing compile-time safety.

### 3.5 HikariCP Connection Pool
- **Role**: High-performance JDBC connection pool.
- **Usage in Project**: Embedded natively in Spring Boot, HikariCP maintains a pool of pre-warmed MySQL connections. With connection test queries and automatic leak detection, it handles high-concurrency student submission bursts without database connection exhaustion.
