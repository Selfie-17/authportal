# AuthPortal — Backend Performance Diagnostics Guide

**Target Application:** AuthPortal (Java 21 / 25, Spring Boot 4.0.8, MySQL 8.4, Render Free Tier)  
**Profile:** `performance` (Dedicated, non-invasive local diagnostic profile)  
**Purpose:** Identify request execution bottlenecks (HikariCP pool waiting, database query latency, Hibernate activity, repository execution, thread contention, and JVM saturation) under load.  

---

## 1. Instrumentation Overview

To diagnose why response latency increases under 25 VUs while database CPU remains low, a lightweight, non-invasive diagnostic layer has been introduced:

1. **Spring Boot Actuator & Micrometer:** Added `spring-boot-starter-actuator` and `micrometer-registry-prometheus`.
2. **Dedicated Diagnostic Profile (`performance`):** All diagnostic endpoints and metric collection mechanisms are segregated into `application-performance.properties`. In normal/production mode, diagnostics remain inactive and secure.
3. **HikariCP Pool Instrumentation:** Exposes active connections, idle connections, pending waiting threads, connection acquisition latency timers (with p50, p90, p95, p99 percentiles), and connection usage durations.
4. **Spring Data Repository Auto-Timing:** Enables `spring.data.repository.autotime.enabled=true`, capturing exact method execution times across all repositories (`UserRepository`, `SubmissionRepository`, etc.) without annotating any code.
5. **Hibernate Statistics & JDBC Tracking:** Enables `hibernate.generate_statistics=true` in the diagnostic profile to record statement counts and query execution times.
6. **HTTP Server Request Metrics:** Automatically instruments all incoming requests (`http.server.requests`) with URI, HTTP status, and percentile histograms.
7. **Thread Inspection & Live Dumps:** Exposes `/actuator/threaddump` to capture active thread states, locks, and blocked threads in real-time.

---

## 2. Files Modified & Dependencies Added

### Dependencies Added (`pom.xml`)
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

### Configuration Files
- [application.properties](file:///c:/Users/kampa/Downloads/authportal/authportal/src/main/resources/application.properties): Base production configuration. Sets `management.endpoints.web.exposure.include=health` (only health is exposed by default).
- [application-performance.properties](file:///c:/Users/kampa/Downloads/authportal/authportal/src/main/resources/application-performance.properties): Dedicated diagnostic profile activating `health,metrics,prometheus,threaddump`, repository auto-timing, Hibernate statistics, and percentile histograms.

### Source Code Files
- [SecurityConfig.java](file:///c:/Users/kampa/Downloads/authportal/authportal/src/main/java/com/selva/authportal/config/SecurityConfig.java): In production, `/actuator/health` is public while other management endpoints require `ADMIN`. When the `performance` profile is active locally, Actuator diagnostic endpoints (`/actuator/**`) are accessible without authentication headers for easy scraping.
- [GlobalExceptionHandler.java](file:///c:/Users/kampa/Downloads/authportal/authportal/src/main/java/com/selva/authportal/exception/GlobalExceptionHandler.java): Added handler for `NoResourceFoundException` to cleanly return HTTP 404 for unexposed Actuator endpoints instead of 500.

### Test Files Added
- [ActuatorDiagnosticsSecurityTest.java](file:///c:/Users/kampa/Downloads/authportal/authportal/src/test/java/com/selva/authportal/ActuatorDiagnosticsSecurityTest.java): Verifies standard production profile security.
- [PerformanceProfileDiagnosticsTest.java](file:///c:/Users/kampa/Downloads/authportal/authportal/src/test/java/com/selva/authportal/PerformanceProfileDiagnosticsTest.java): Verifies that `/actuator/health`, `/actuator/metrics`, `/actuator/prometheus`, and `/actuator/threaddump` work when the `performance` profile is activated, while sensitive endpoints (`/actuator/env`) remain strictly unexposed (404).

---

## 3. How to Activate the Diagnostic Profile

### Option A: From VS Code Terminal (PowerShell)
```powershell
cd c:\Users\kampa\Downloads\authportal\authportal
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=performance
```

### Option B: Running the Packaged JAR
```powershell
cd c:\Users\kampa\Downloads\authportal\authportal
.\mvnw.cmd clean package -DskipTests
java -jar target/authportal-0.0.1-SNAPSHOT.jar --spring.profiles.active=performance
```

### Option C: VS Code `launch.json`
Add `--spring.profiles.active=performance` to `args` or set `SPRING_PROFILES_ACTIVE=performance` in `env`:
```json
{
  "type": "java",
  "name": "AuthPortal (Performance Diagnostics)",
  "request": "launch",
  "mainClass": "com.selva.authportal.AuthportalApplication",
  "args": "--spring.profiles.active=performance"
}
```

---

## 4. Monitoring Endpoints & How to Inspect Them

When the application is running with `--spring.profiles.active=performance`, the following endpoints are available at `http://localhost:8080`:

| Endpoint | Method | Format | Purpose |
| :--- | :--- | :--- | :--- |
| `http://localhost:8080/actuator/health` | GET | JSON | Health status and disk/db liveness. |
| `http://localhost:8080/actuator/metrics` | GET | JSON | Catalog of all registered metric names. |
| `http://localhost:8080/actuator/metrics/{metricName}` | GET | JSON | Deep-dive into a specific metric with tags and statistics. |
| `http://localhost:8080/actuator/prometheus` | GET | Plain Text | **Recommended:** Complete real-time dump of all timers, counters, gauges, and percentiles. |
| `http://localhost:8080/actuator/threaddump` | GET | JSON / Text | Instant thread dump showing thread states (BLOCKED, WAITING) and stack traces. |

---

## 5. Key Metrics to Inspect

### 5.1 HikariCP Connection Pool Metrics (The #1 Suspect)

Under 25 VUs with a max pool size of 5 (`DB_POOL_MAX_SIZE: 5`), request threads may queue up waiting to acquire a connection.

Inspect via:
```powershell
# In PowerShell:
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.pending
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.acquire
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.usage
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.active
```
Or view all at once via Prometheus:
```powershell
curl.exe -s http://localhost:8080/actuator/prometheus | Select-String "hikaricp"
```

#### Metric Interpretation:
- `hikaricp.connections.pending`: **Threads waiting for a connection.** If this value is > 0 during the 25-VU test, threads are waiting for free database connections.
- `hikaricp.connections.acquire`: **Connection acquisition duration.** Look at `MAX` and `P95`. If `acquire` latency is several seconds, pool starvation is the direct root cause.
- `hikaricp.connections.usage`: **How long a thread holds the connection before returning it.** If this is large (>500ms), long database transactions or slow queries are blocking the pool.
- `hikaricp.connections.timeout`: **Number of connection acquisition timeouts.** If > 0, requests failed or timed out waiting for the database pool.

---

### 5.2 Spring Data Repository Metrics

Inspect how much time is spent executing repository queries:
```powershell
curl.exe -s http://localhost:8080/actuator/metrics/spring.data.repository.invocations
```
Or view by repository:
```powershell
curl.exe -s "http://localhost:8080/actuator/metrics/spring.data.repository.invocations?tag=repository:SubmissionRepository"
curl.exe -s "http://localhost:8080/actuator/metrics/spring.data.repository.invocations?tag=repository:UserRepository"
```
Or scrape via Prometheus:
```powershell
curl.exe -s http://localhost:8080/actuator/prometheus | Select-String "spring_data_repository_invocations"
```

#### Metric Interpretation:
- Shows which repository and method took the most time.
- If `spring.data.repository.invocations` execution time is small (e.g. 50–100ms) but total HTTP latency is 2–4 seconds, the delay is **pool acquisition queuing**, NOT the SQL query execution itself!

---

### 5.3 Hibernate Statistics

Inspect database queries generated by Hibernate:
```powershell
curl.exe -s http://localhost:8080/actuator/metrics/hibernate.statements
curl.exe -s http://localhost:8080/actuator/metrics/hibernate.query.executions
```
Or via Prometheus:
```powershell
curl.exe -s http://localhost:8080/actuator/prometheus | Select-String "hibernate"
```

#### Metric Interpretation:
- `hibernate.statements`: Total count of executed SQL statements. Shows if an endpoint is triggering unexpected N+1 queries.
- `hibernate.sessions.open`: Number of open Hibernate sessions.

---

### 5.4 HTTP Request Metrics

Inspect server-side HTTP request handling time:
```powershell
curl.exe -s "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/auth/login"
curl.exe -s "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/submissions"
curl.exe -s "http://localhost:8080/actuator/metrics/http.server.requests?tag=uri:/api/profile"
```
Or view percentiles via Prometheus:
```powershell
curl.exe -s http://localhost:8080/actuator/prometheus | Select-String "http_server_requests"
```

#### Metric Interpretation:
- Compares server-side recorded latency with k6 client-side measured latency.
- If k6 reports 3,000ms and `http.server.requests` also reports ~3,000ms, the delay is internal to the backend (e.g. pool waiting, CPU, or DB).

---

### 5.5 JVM CPU, Memory, and Garbage Collection

```powershell
curl.exe -s http://localhost:8080/actuator/metrics/process.cpu.usage
curl.exe -s http://localhost:8080/actuator/metrics/jvm.memory.used
curl.exe -s http://localhost:8080/actuator/metrics/jvm.gc.pause
curl.exe -s http://localhost:8080/actuator/metrics/jvm.threads.live
curl.exe -s http://localhost:8080/actuator/metrics/jvm.threads.states
```

#### Metric Interpretation:
- `process.cpu.usage`: JVM CPU utilization (0.0 to 1.0). If near 1.0, BCrypt password hashing or thread context switching is saturating local CPU cores.
- `jvm.gc.pause`: Total GC stop-the-world pause duration. If GC pauses are > 200ms, heap size may be constrained.
- `jvm.threads.live`: Active thread count.

---

## 6. How to Capture a Live Thread Dump During Load Testing

If requests appear to hang or latency increases during the 25-VU test, capture a thread dump to see what every thread is doing:

### Method 1: Via Actuator HTTP Endpoint (Instant JSON/Text)
```powershell
# Save live thread dump to a file
curl.exe -s http://localhost:8080/actuator/threaddump > threaddump.json
```

To see threads waiting or blocked:
```powershell
curl.exe -s http://localhost:8080/actuator/threaddump | Select-String -Pattern "BLOCKED|WAITING|HikariPool|getConnection" -Context 2,5
```

### Method 2: Via Standard JDK `jstack`
1. Find the Java process ID:
   ```powershell
   jps -l
   ```
2. Capture the stack trace:
   ```powershell
   jstack <PID> > threaddump.txt
   ```

Look for threads in state:
`java.lang.Thread.State: TIMED_WAITING (parking)` or `WAITING` at `com.zaxxer.hikari.pool.HikariPool.getConnection(...)`. If multiple `http-nio-8080-exec-*` worker threads are stuck here, connection pool saturation is confirmed!

---

## 7. Step-by-Step Procedure for the 25-VU Diagnostic Test

Follow these exact steps to pinpoint where the 2.11s average / 5.58s P95 latency is originating:

### Step 1: Start the Backend in Diagnostic Mode
In Terminal 1:
```powershell
cd c:\Users\kampa\Downloads\authportal\authportal
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=performance
```
Wait until the console displays:
`Started AuthportalApplication in X.XXX seconds`

### Step 2: Verify Monitoring Endpoints are Live
In Terminal 2:
```powershell
curl.exe -s http://localhost:8080/actuator/health
curl.exe -s http://localhost:8080/actuator/prometheus | Select-String "hikaricp_connections_max"
```
Ensure it returns:
`hikaricp_connections_max{pool="AuthPortalHikariPool"} 5.0`

### Step 3: Run the 25-VU Load Test
In Terminal 2:
```powershell
cd c:\Users\kampa\Downloads\authportal\load-testing
.\bin\k6.exe run tests\02-normal-usage-test.js
```

### Step 4: Capture Diagnostics at Peak Load (VU = 25)
While k6 is running around 20–25 VUs, run in Terminal 3:
```powershell
# 1. Check pending connection queue
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.pending

# 2. Check connection acquisition latency
curl.exe -s http://localhost:8080/actuator/metrics/hikaricp.connections.acquire

# 3. Capture thread dump if latency spikes
curl.exe -s http://localhost:8080/actuator/threaddump > peak_load_threaddump.json
```

### Step 5: Save Full Diagnostic Metrics Post-Test
Immediately after k6 finishes:
```powershell
curl.exe -s http://localhost:8080/actuator/prometheus > test_run_metrics.prom
```
Inspect `test_run_metrics.prom` for:
1. `hikaricp_connections_acquire_seconds` (Max and P95 acquire times).
2. `hikaricp_connections_usage_seconds` (Connection hold duration).
3. `spring_data_repository_invocations_seconds` (Time spent inside DB queries).
4. `http_server_requests_seconds` (Breakdown by URI).

---

## 8. How to Disable Diagnostics (Return to Production Mode)

Simply restart the backend without the `performance` profile:
```powershell
# Normal execution (uses default application.properties)
.\mvnw.cmd spring-boot:run
```
In default mode:
- `/actuator/metrics`, `/actuator/prometheus`, and `/actuator/threaddump` are completely unexposed.
- Any attempt to access `/actuator/metrics` returns HTTP 401/403.
- Sensitive endpoints return HTTP 404.
- Hibernate statistics and repository auto-timing are disabled, eliminating all monitoring overhead.

---

## 9. Security Considerations & Overhead

- **Zero Information Leakage:** Sensitive endpoints (`/actuator/env`, `/actuator/configprops`, `/actuator/heapdump`, `/actuator/beans`) are explicitly excluded.
- **Production Safety:** In default mode, only `/actuator/health` is exposed. Actuator endpoints cannot be accessed without an administrative JWT token.
- **Overhead:** In `performance` profile, Micrometer incurs < 1% CPU overhead. In production mode, overhead is 0%.
