# System Architecture & Technical Diagrams: Institutional Evaluation Portal

---

## 1. High-Level System Architecture

This diagram illustrates the global architecture of AuthPortal, showing the relationship between client web browsers, the Spring Boot application tier, database persistence, cloud object storage, and external Google Cloud APIs.

```mermaid
flowchart TD
    subgraph ClientTier["Client Presentation Tier (React 19 SPA)"]
        Browser["Web Browser (Chrome / Edge / Firefox)"]
        ReactApp["React 19 + Vite Frontend SPA"]
        AuthContext["Auth State (Token in LocalStorage)"]
        SWRCache["Client Memory Caches (Grid, PDF, Report)"]
        Browser --> ReactApp
        ReactApp --> AuthContext
        ReactApp --> SWRCache
    end

    subgraph AppTier["Application Tier (Spring Boot 4 / Java 21)"]
        SecurityFilter["Spring Security Filter Chain\n(JwtAuthenticationFilter & CORS)"]
        
        subgraph Controllers["REST Controllers"]
            AuthController["AuthController\n(/api/auth/*)"]
            SubController["SubmissionController\n(/api/submissions/*)"]
            EvalController["TeacherEvaluationController\n(/api/teacher/evaluations/*)"]
            EmailController["EmailReportController\n(/api/email/*)"]
            AdminController["AdminController\n(/api/admin/*)"]
        end
        
        subgraph Services["Core Business Services"]
            AuthService["AuthService &\nEmailRoleResolver"]
            SubService["SubmissionService &\nMagic Byte Validator"]
            EvalService["EvaluationService"]
            EmailService["EmailBatchService &\nReportEmailService"]
            ZipService["ZipArchiveService\n(On-the-fly streaming)"]
            StorageService["StorageService Abstraction\n(Local vs Backblaze B2)"]
        end

        SecurityFilter --> Controllers
        AuthController --> AuthService
        SubController --> SubService
        SubController --> ZipService
        EvalController --> EvalService
        EmailController --> EmailService
        SubService --> StorageService
        ZipService --> StorageService
        EvalService --> StorageService
    end

    subgraph DataTier["Data & Cloud Storage Tier"]
        MySQL[("MySQL 8.0 Database\n(Aiven Cloud / Local Docker)")]
        Backblaze[("Backblaze B2 Object Storage\n(S3-Compatible Bucket)")]
    end

    subgraph ExternalServices["External Cloud Integrations"]
        GoogleOAuth["Google Cloud Identity\n(OAuth 2.0 / OpenID Connect)"]
        GmailREST["Google Gmail REST API (v1)\n(HTTPS Port 443)"]
        GmailSMTP["Gmail SMTP Server\n(Port 587 STARTTLS)"]
    end

    ReactApp -->|REST API over HTTPS| SecurityFilter
    AuthService -->|OIDC Token Exchange| GoogleOAuth
    Services -->|JPA / Hibernate / JDBC| MySQL
    StorageService -->|AWS SDK v2 S3 API| Backblaze
    EmailService -->|HTTPS 443 / Bypasses Render Blocks| GmailREST
    EmailService -->|Standard SMTP Port 587| GmailSMTP
```

---

## 2. Authentication Flow 1: Google OAuth 2.0 with Zero-JWT in URL

This sequence diagram depicts how AuthPortal prevents token leakage in browser history, proxy logs, and HTTP Referer headers using an ephemeral single-use 60-second exchange code.

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Faculty
    participant Browser as Web Browser
    participant React as React 19 Frontend
    participant Backend as Spring Boot Security
    participant Google as Google Cloud OAuth 2.0
    participant DB as MySQL Database

    User->>React: Clicks "Sign in with Google"
    React->>Backend: GET /oauth2/authorization/google
    Backend-->>Browser: 302 Redirect to Google Accounts Login
    Browser->>Google: Authenticates with Institutional Google Account
    Google-->>Backend: 302 Redirect with Auth Code to /login/oauth2/code/google
    Backend->>Google: Exchange Auth Code for ID Token & User Info
    Google-->>Backend: Verified Profile (email, name, picture)
    
    Note over Backend: EmailRoleResolver validates domain (@rguktn.ac.in)<br/>Derives Role: STUDENT, TEACHER, or ADMIN
    Backend->>DB: Link or Provision User Record
    
    Note over Backend: Generate 60-second Single-Use Exchange Code<br/>Stored in ConcurrentHashMap (OAuth2ExchangeCodeStore)
    Backend-->>Browser: 302 Redirect to ${FRONTEND_URL}/oauth2/callback?code=EXCHANGE_CODE
    Note over Browser: ZERO JWT in URL query params or browser history!
    
    Browser->>React: Loads OAuthCallbackPage with ?code=EXCHANGE_CODE
    React->>Backend: POST /api/auth/oauth2/exchange { "code": "EXCHANGE_CODE" }
    
    Note over Backend: Atomically retrieve & remove exchange code (Burn on read)<br/>Validate code age < 60 seconds<br/>Generate 24-hour signed HMAC-SHA256 JWT
    Backend-->>React: 200 OK { token: "ey...", user: { role, email, name } }
    React->>Browser: Store JWT in localStorage
    React-->>User: Navigate to Role-Based Dashboard (/student or /teacher)
```

---

## 3. Authentication Flow 2: Local Registration & Login (Server-Enforced RBAC)

This diagram details the local email/password registration and login process, illustrating how client-side privilege escalation is completely blocked.

```mermaid
sequenceDiagram
    autonumber
    actor User as Registering Student
    participant React as React 19 Client
    participant Controller as AuthController
    participant Resolver as EmailRoleResolver
    participant Service as AuthService
    participant DB as MySQL Database

    User->>React: Submits Registration Form (Name, Email, Password)
    Note over React: Payload contains NO role field!
    React->>Controller: POST /api/auth/register { name, email, password }
    Controller->>Resolver: resolveRole(email)
    
    alt Invalid Institutional Domain
        Resolver-->>Controller: Reject (Domain not in @rguktn.ac.in, @rguktrkv.ac.in, etc.)
        Controller-->>React: 400 Bad Request ("Only institutional emails permitted")
    else Valid Student Email Pattern
        Resolver-->>Controller: Resolved Role: ROLE_STUDENT
    else Whitelisted Faculty Email
        Resolver-->>Controller: Resolved Role: ROLE_TEACHER
    end

    Controller->>Service: registerUser(request, resolvedRole)
    Service->>DB: Check if email already exists
    Service->>Service: Hash password via BCrypt (Work Factor 10)
    Service->>DB: INSERT INTO users (email, password, name, role, auth_provider)
    Service->>Service: Generate HMAC-SHA256 JWT Token
    Service-->>Controller: AuthResponse (token, user profile)
    Controller-->>React: 201 Created { token, user }
    React-->>User: Store Token & Redirect to Dashboard
```

---

## 4. Database Entity-Relationship (ER) Diagram

This diagram visualizes all 8 tables, primary keys, foreign keys, and indexes managed across Flyway migrations V1 to V12.

```mermaid
erDiagram
    USERS ||--o{ SUBMISSIONS : "owns"
    SUBMISSIONS ||--|{ SUBMISSION_FILES : "contains"
    STUDENT_EVALUATIONS ||--o| TEACHER_FEEDBACKS : "reviewed_by"
    EMAIL_BATCHES ||--|{ EMAIL_BATCH_RECIPIENTS : "dispatches_to"

    USERS {
        bigint id PK
        varchar email UK "Indexed"
        varchar password "BCrypt Hash"
        varchar name
        varchar google_id UK "Indexed"
        varchar profile_picture
        varchar role "STUDENT, TEACHER, ADMIN"
        varchar branch "CSE, ECE, EEE, etc."
        varchar academic_year "E1, E2, E3, E4"
        varchar section "1 to 6"
        varchar auth_provider "LOCAL, GOOGLE"
        boolean enabled
        datetime created_at
        datetime updated_at
    }

    SUBMISSIONS {
        bigint id PK
        bigint user_id FK "References USERS(id)"
        varchar student_id "Indexed"
        int week "1 to 12"
        varchar year "E1 to E4"
        int section "1 to 6"
        varchar branch
        varchar storage_path
        varchar status "SUBMITTED"
        int version "Revision Counter"
        datetime created_at
        datetime updated_at
    }

    SUBMISSION_FILES {
        bigint id PK
        bigint submission_id FK "References SUBMISSIONS(id)"
        varchar original_filename
        varchar stored_filename
        varchar drive_file_id "Optional"
        varchar storage_key "S3 Object Key"
        varchar file_type "C_SOURCE, PDF_REPORT"
        bigint file_size_bytes
        datetime created_at
    }

    STUDENT_EVALUATIONS {
        bigint id PK
        varchar student_id "Indexed"
        varchar week "Indexed"
        int week_number
        varchar section_id
        varchar provider "gemini, ollama"
        varchar model_name
        varchar objective_score
        varchar problem_understanding_score
        varchar logic_score
        varchar variables_score
        varchar observation_score
        varchar total_score
        varchar final_score
        varchar grade
        varchar status
        text assessment
        longtext raw_json
        datetime created_at
        datetime updated_at
    }

    TEACHER_FEEDBACKS {
        bigint id PK
        varchar student_id "Indexed"
        varchar week "Indexed"
        boolean reviewed
        text feedback_text
        varchar teacher_email
        datetime created_at
        datetime updated_at
    }

    EMAIL_BATCHES {
        bigint id PK
        varchar academic_year
        varchar branch
        varchar section
        varchar week
        varchar subject
        varchar provider "all, gemini, ollama"
        varchar report_format "html, json"
        text custom_message
        int total_recipients
        int sent_count
        int failed_count
        int pending_count
        varchar status "PENDING, PROCESSING, COMPLETED"
        varchar created_by
        timestamp created_at
        timestamp completed_at
    }

    EMAIL_BATCH_RECIPIENTS {
        bigint id PK
        bigint batch_id FK "References EMAIL_BATCHES(id)"
        varchar student_id "Indexed"
        varchar email
        varchar status "PENDING, SENT, FAILED"
        varchar message_id "Gmail Message ID"
        text error_message
        timestamp sent_at
        int retry_count
    }

    EMAIL_AUTOMATION_CONFIGS {
        bigint id PK
        boolean enabled
        varchar trigger_type "ON_FEEDBACK_SAVED"
        varchar academic_year
        varchar branch
        varchar section
        varchar week
        varchar report_format
        varchar provider
        varchar gmail_refresh_token "Encrypted"
        varchar gmail_connected_email
        varchar updated_by
        timestamp updated_at
    }
```

---

## 5. Student Submission & Deep Magic Byte Validation Flow

This diagram illustrates how uploaded files are validated against malicious binaries before being safely persisted to cloud storage.

```mermaid
flowchart TD
    Start([Student Clicks Submit Assignment]) --> FormPayload[Form Data: StudentId, Week, Year, Section, Files]
    FormPayload --> Controller[SubmissionController: POST /api/submissions]
    Controller --> ResolveUser[Resolve Authenticated User via JWT]
    ResolveUser --> CheckOwner{Does Student ID match User Profile?}
    
    CheckOwner -->|Mismatch| RejectID[Return 400 Bad Request]
    CheckOwner -->|Matches| LoopFiles[Iterate through Uploaded Files]
    
    LoopFiles --> ReadBytes[Read Initial 8 Magic Bytes from InputStream]
    ReadBytes --> CheckPE{Header == 0x4D, 0x5A? 'MZ'}
    CheckPE -->|Yes| BlockPE[THROW: Disguised Windows Executable Detected]
    
    CheckPE -->|No| CheckELF{Header == 0x7F, 0x45, 0x4C, 0x46? 'ELF'}
    CheckELF -->|Yes| BlockELF[THROW: Disguised Linux Binary Detected]
    
    CheckELF -->|No| CheckFileType{File Extension & Expected Type}
    CheckFileType -->|PDF Report| CheckPDFHeader{Starts with '%PDF-'?}
    CheckPDFHeader -->|No| BlockPDF[THROW: Invalid or Corrupted PDF]
    CheckPDFHeader -->|Yes| FileValid[File Content Verified Safe]
    
    CheckFileType -->|C Source File| CheckCodeText{Plaintext C source?}
    CheckCodeText -->|Yes| FileValid
    
    FileValid --> CheckExisting{Previous Submission for Week/Year/Sec?}
    CheckExisting -->|Yes| IncrementRev[Increment Revision: version = version + 1]
    IncrementRev --> PurgeOld[Purge Old Files from Backblaze B2 / Disk]
    CheckExisting -->|No| SetV1[Set version = 1]
    
    PurgeOld --> WriteStorage[Stream File to StorageService: Backblaze B2 / Local]
    SetV1 --> WriteStorage
    WriteStorage --> SaveDB[Persist Submissions & SubmissionFiles in MySQL]
    SaveDB --> End([Return 201 Created / 200 OK Response])
```

---

## 6. On-The-Fly Streaming ZIP Archive Generation Flow

This diagram shows how teachers can download entire cohorts of lab submissions as structured ZIP archives without exhausting server memory or disk storage.

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Lab Instructor
    participant React as React 19 Frontend
    participant Controller as SubmissionController
    participant ZipService as ZipArchiveService
    participant Storage as StorageService (Backblaze B2)
    participant ClientStream as HTTP Streaming Response

    Teacher->>React: Clicks "Download Section Submissions (ZIP)"
    React->>Controller: GET /api/submissions/teacher/download-zip?week=1&year=E1&section=2
    Controller->>ZipService: streamSubmissionsZip(week, year, section, response)
    
    Note over ZipService: Wrap HttpServletResponse in ZipOutputStream<br/>Set Header: Content-Disposition: attachment; filename="week-1-sec-2.zip"
    
    ZipService->>ZipService: Query DB for all submissions matching Week 1, E1, Section 2
    
    loop For Every Student Submission
        Note over ZipService: Create ZIP Directory: "week-1-sec-2/{studentId}/"
        loop For Every File (.c and .pdf)
            ZipService->>ZipService: PutNextEntry("week-1-sec-2/{studentId}/{originalFilename}")
            ZipService->>Storage: loadFileAsStream(storageKey)
            Storage-->>ZipService: InputStream (Direct S3 / Disk Stream)
            ZipService->>ClientStream: Copy InputStream bytes directly into ZipOutputStream
            Note over ClientStream: Streamed chunk-by-chunk to browser<br/>ZERO staging on server hard drive!
            ZipService->>ZipService: CloseEntry()
        end
    end
    
    ZipService->>ClientStream: Finish & Flush ZipOutputStream
    ClientStream-->>Teacher: Browser completes download of week-1-sec-2.zip
```

---

## 7. Dual-Engine Email Dispatcher Architecture

This diagram demonstrates how AuthPortal guarantees email delivery across restricted cloud environments (such as Render Free Tier) by intelligently toggling between Gmail REST API and SMTP.

```mermaid
flowchart TD
    Trigger([Email Send Requested\nIndividual / Batch / Test]) --> Router[ReportEmailService / EmailBatchService]
    Router --> CheckEngine{Is Gmail REST API configured?\n(Refresh Token Present in DB/Env?)}
    
    subgraph RESTEngine["Engine 1: Google Gmail REST API (v1) — Cloud Resilient"]
        CheckEngine -->|YES: Token Present| FetchToken[Check In-Memory Access Token Cache]
        FetchToken --> CheckExpire{Is Access Token Expired?}
        CheckExpire -->|Yes| RefreshOAuth[POST https://oauth2.googleapis.com/token\nExchange Refresh Token for new Access Token]
        CheckExpire -->|No| UseCached[Use Cached Access Token]
        RefreshOAuth --> BuildMime[Construct RFC 2822 MIME Message\n(HTML body + Attachments)]
        UseCached --> BuildMime
        BuildMime --> Base64Encode[Base64URL Encode Raw Message]
        Base64Encode --> RestCall[POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send\nAuthorization: Bearer AccessToken\nPort 443 HTTPS]
        RestCall --> RenderPass[Bypasses Render Outbound SMTP Port 587/25 Blocks!]
    end

    subgraph SMTPEngine["Engine 2: Gmail SMTP — Standard Delivery"]
        CheckEngine -->|NO: No Token| FallbackSMTP[Initialize JavaMailSender]
        FallbackSMTP --> ConnectSMTP[Connect to smtp.gmail.com:587\nSTARTTLS Authentication]
        ConnectSMTP --> SendSMTP[Dispatch MIME Message via SMTP Protocol]
    end

    RenderPass --> UpdateStatus[Update EmailBatchRecipient Record in MySQL]
    SendSMTP --> UpdateStatus
    UpdateStatus --> Complete([Delivery Recorded: SENT with Message-ID or FAILED with Error Log])
```

---

## 8. Teacher Evaluation Grid & SWR Caching Flow

This diagram illustrates how the frontend achieves instantaneous navigation and sub-second load times using Stale-While-Revalidate (SWR) in-memory caching.

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Faculty Evaluator
    participant UI as TeacherSubmissionsPage (React)
    participant SWR as In-Memory GridCache (gridCache.js)
    participant API as EvaluationService (Frontend)
    participant Backend as Spring Boot REST API
    participant DB as MySQL Database

    Teacher->>UI: Navigates to Evaluation Grid Tab
    UI->>SWR: Check gridCache.has()
    
    alt Cache Hit (Previous fetch exists)
        SWR-->>UI: Return Cached Grid Immediately (0ms)
        Note over UI: UI renders instant table with cached scores!<br/>Spinner is completely bypassed.
        UI->>API: Background fetch: getGrid(forceRefresh = false)
    else Cache Miss (First visit)
        UI->>UI: Display Loading Spinner
        UI->>API: Foreground fetch: getGrid()
    end

    API->>Backend: GET /api/teacher/evaluations/grid
    Backend->>DB: Query dynamic weeks, student evaluations, and feedback
    DB-->>Backend: Result sets
    Backend-->>API: 200 OK (Consolidated Grid Matrix DTO)
    API->>SWR: Update in-memory gridCache
    API-->>UI: Update UI state smoothly if data changed
    UI-->>Teacher: Live evaluation table ready with real-time marks
```

---

## 9. Production Deployment Architecture (Docker & Cloud PaaS)

This diagram shows how the system is deployed in production across Render Web Services, Aiven Cloud MySQL, and Backblaze B2.

```mermaid
flowchart TD
    subgraph Internet["Public Internet"]
        Users["Students & Faculty Browsers"]
    end

    subgraph RenderPaaS["Render Cloud Platform (Oregon Region)"]
        ReverseProxy["Cloudflare / Render Reverse Proxy\n(SSL Termination, HTTPS)"]
        
        subgraph DockerContainer["Docker Web Service Container (Eclipse Temurin 21)"]
            SpringBoot["Spring Boot Executable JAR (app.jar)\nListening on $PORT (8080)"]
            EmbeddedTomcat["Embedded Tomcat Server"]
            LocalVol["Ephemeral Storage (/app/storage)"]
            SpringBoot --- EmbeddedTomcat
            SpringBoot --- LocalVol
        end
        
        ReverseProxy -->|Forward Request with HTTPS Headers| SpringBoot
    end

    subgraph ManagedCloud["Managed Cloud Infrastructure"]
        AivenMySQL[("Aiven Cloud MySQL 8.0\n(SSL Required, Automated Backups)")]
        BackblazeB2[("Backblaze B2 Cloud Storage\n(US-East-005 Private S3 Bucket)")]
        GoogleCloud["Google Cloud Identity & Gmail APIs\n(OAuth2 & Gmail REST v1)"]
    end

    Users -->|HTTPS / Port 443| ReverseProxy
    SpringBoot -->|JDBC / SSL Connection| AivenMySQL
    SpringBoot -->|AWS SDK v2 / HTTPS Port 443| BackblazeB2
    SpringBoot -->|OAuth2 & REST API / Port 443| GoogleCloud
```
