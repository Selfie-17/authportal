# RGUKT AuthPortal: Presentation, Technical Documentation & Viva Defense Kit

Welcome to the definitive **Presentation, Technical Documentation, and Viva Defense Kit** for the **RGUKT Institutional Authentication, Laboratory Submission Management & Academic Evaluation Portal (AuthPortal)**.

This documentation package has been engineered to provide final-year B.Tech students, project leads, and software engineers with everything needed to build a professional PowerPoint presentation, write thesis/project reports, conduct live demonstrations, and defend the project in technical viva examinations.

---

## 📂 Document Index & Navigation

The documentation kit is organized into 9 specialized, in-depth technical documents:

| File Name | Primary Focus | Best Used For |
| :--- | :--- | :--- |
| [**`01_Project_Overview_and_Abstract.md`**](./01_Project_Overview_and_Abstract.md) | Academic abstract, institutional context (RGUKT), executive summary, core innovations, and project scope. | Project reports, synopsis submission, PPT introductory slides, and project title defense. |
| [**`02_Complete_Technical_Documentation.md`**](./02_Complete_Technical_Documentation.md) | Exhaustive 28-section technical manual covering architecture, functional/non-functional requirements, API catalog, data models, and testing coverage. | Writing the comprehensive project thesis report, technical whitepapers, and deep architectural study. |
| [**`03_System_Architecture_and_Diagrams.md`**](./03_System_Architecture_and_Diagrams.md) | Complete collection of Mermaid diagrams: High-level architecture, Zero-JWT OAuth sequence, ER diagram, Magic Byte inspection, and Dual Mailer flow. | Exporting high-resolution vector diagrams into PowerPoint slides, report figures, and posters. |
| [**`04_PPT_Slide_By_Slide_Content.md`**](./04_PPT_Slide_By_Slide_Content.md) | Complete 15-slide PowerPoint deck content: exact slide titles, bullet points, technical notes, visual assets, and slide takeaways. | Building the actual `.pptx` presentation deck in Microsoft PowerPoint, Google Slides, or Canva. |
| [**`05_Presenter_Notes_and_Speaking_Script.md`**](./05_Presenter_Notes_and_Speaking_Script.md) | Verbal scripts: 1-minute elevator pitch, 3-minute standard academic viva script, 5-minute technical defense, and slide-by-slide verbal cues. | Rehearsing oral presentation delivery, timing practice, and building stage confidence. |
| [**`06_Technical_Viva_Questions_and_Answers.md`**](./06_Technical_Viva_Questions_and_Answers.md) | Comprehensive 85-question technical viva bank across basic, intermediate, advanced, design, database, and edge-case categories. | Preparing for cross-examination by university faculty, external evaluators, and technical interviewers. |
| [**`07_Screenshot_Collection_Guide.md`**](./07_Screenshot_Collection_Guide.md) | Catalog of 12 essential application screenshots with routes, required roles, UI callouts, and capture instructions. | Capturing presentation-ready screenshots from the running application to embed into slides. |
| [**`08_Technology_Stack_and_Justification.md`**](./08_Technology_Stack_and_Justification.md) | Deep architectural justification of Java 21, Spring Boot 4, React 19, Backblaze B2 S3, Flyway, and Gmail REST API vs alternatives. | Answering *"Why did you choose this technology instead of X?"* during viva and architectural reviews. |
| [**`09_Project_Demo_Guide.md`**](./09_Project_Demo_Guide.md) | Step-by-step 5-phase live demonstration script with fail-safes, talking points, and emergency troubleshooting. | Conducting a flawless live software demonstration during the practical evaluation phase. |

---

## 🚀 How to Prepare Your PowerPoint Presentation (Step-by-Step)

### Step 1: Create the Slides (30–45 Minutes)
1. Open Microsoft PowerPoint, Google Slides, or Canva.
2. Select a clean, modern dark academic theme (e.g., Deep Navy Blue `#0f172a`, Slate Gray `#334155`, and Accent Blue `#3b82f6`).
3. Open [`04_PPT_Slide_By_Slide_Content.md`](./04_PPT_Slide_By_Slide_Content.md). Copy the exact titles, bullet points, and structure for Slide 1 through Slide 15.
4. Keep text concise. Use bullet points rather than paragraphs.

### Step 2: Embed Architecture Diagrams & Visuals
1. Open [`03_System_Architecture_and_Diagrams.md`](./03_System_Architecture_and_Diagrams.md).
2. Render or export the Mermaid diagrams (using the [Mermaid Live Editor](https://mermaid.live/) or IDE preview) to high-resolution PNG or SVG format.
3. Embed key diagrams:
   - **Slide 7**: High-Level System Architecture.
   - **Slide 8**: Database Entity-Relationship (ER) Diagram.
   - **Slide 9**: Zero-JWT OAuth 2.0 Sequence Diagram.
   - **Slide 12**: Dual-Engine Mailer Architecture.

### Step 3: Capture and Embed Live Screenshots
1. Launch the local application using Docker, Spring Boot, and Vite.
2. Follow [`07_Screenshot_Collection_Guide.md`](./07_Screenshot_Collection_Guide.md) to capture the 12 key screens.
3. Embed screenshots into:
   - **Slide 10**: Student Submission Interface & Revision History.
   - **Slide 11**: Teacher Evaluation Grid & Inline PDF Viewer.
   - **Slide 12**: Email Reports Distribution Center & Received Email in Gmail.
   - **Slide 13**: Administrative Console & KPI Cards.

### Step 4: Rehearse Speaking Scripts & Timing
1. Open [`05_Presenter_Notes_and_Speaking_Script.md`](./05_Presenter_Notes_and_Speaking_Script.md).
2. Choose the script matching your allocated time:
   - If given 3 minutes: Practice **Script B (3-Minute Academic Summary)**.
   - If given 5–10 minutes: Practice **Script C (5-Minute Technical Defense)** and use the **Slide-by-Slide Speaking Script**.
3. Rehearse with a stopwatch. Aim for a confident, steady speaking rate (~130 words per minute).

### Step 5: Master the Viva Questions
1. Open [`06_Technical_Viva_Questions_and_Answers.md`](./06_Technical_Viva_Questions_and_Answers.md) and [`08_Technology_Stack_and_Justification.md`](./08_Technology_Stack_and_Justification.md).
2. Focus especially on:
   - How the **Zero-JWT exchange code** prevents token leakage.
   - How **magic byte inspection** detects disguised executables.
   - Why the **Gmail REST API over HTTPS Port 443** is necessary to bypass cloud SMTP blocks.
   - How the **evaluation grid SWR cache** provides sub-second navigation.

### Step 6: Execute the Live Demo
1. Follow [`09_Project_Demo_Guide.md`](./09_Project_Demo_Guide.md).
2. Keep Incognito and standard browser windows ready.
3. Walk the committee through the 5 demonstration phases in under 10 minutes.

---

## 🛡️ Key Project Metrics at a Glance

- **Backend Tests**: 121 automated tests passing with 0 failures (Unit, Integration, Security, and Controller slices).
- **Database Migrations**: 12 sequential Flyway scripts (`V1` to `V12`).
- **Supported Campuses**: RGUKT Nuzvid (`@rguktn.ac.in`), RK Valley (`@rguktrkv.ac.in`), Ongole (`@rguktong.ac.in`), Srikakulam (`@rguktsklm.ac.in`), and Central (`@rgukt.in`).
- **Supported Submissions**: C Programming Source Files (`.c`) and Lab Reports (`.pdf`).
- **Maximum File Limit**: 20MB per file; 500MB per aggregate request.
- **Storage Providers**: Local Filesystem and Backblaze B2 (AWS SDK for Java v2 S3 API).
- **Mail Transports**: Google Gmail REST API (v1) over HTTPS Port 443 and standard Gmail SMTP on Port 587.

---
*Created for RGUKT Academic Project Defense & Technical Evaluation.*
