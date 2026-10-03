package com.selva.authportal.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class EmailReportHtmlTransformerTest {

    private EmailReportHtmlTransformer transformer;

    private static final String SAMPLE_HTML = "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Lab Notebook Brief — N240035</title>\n" +
            "<style>\n" +
            ":root{--paper:#f5f6f3;--raised:#fff;--ink:#1b2430;--soft:#4b5563;--faint:#7c8794;--rule:#d7dcd7;--accent:#2e6f6e;--amber:#a5691e;--steel:#3b5ba5;--rose:#a1443f}*{box-sizing:border-box}body{margin:0;padding:40px 20px 64px;background:var(--paper);color:var(--ink);font:15px/1.55 'Segoe UI',sans-serif}.sheet{max-width:720px;margin:auto;background:var(--raised);border:1px solid var(--rule);padding:42px 50px;box-shadow:0 1px 2px #0001}.letterhead{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid var(--ink);padding-bottom:14px}h1,h2{font-family:Georgia,serif}h1{font-size:1.55rem;margin:0}.sub,.meta{color:var(--soft);font-size:.83rem}.meta{text-align:right;font-family:monospace;font-size:.72rem}.factshead{font-size:.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);margin:22px 0 8px}.factbar{display:flex;border:1px solid var(--rule)}.fact{flex:1;padding:10px 12px;background:var(--paper);border-right:1px solid var(--rule)}.fact:last-child{border:0}.n{display:block;font:bold 1.1rem monospace;color:var(--accent)}.l{font-size:.65rem;text-transform:uppercase;color:var(--faint)}.dim{margin-top:28px;break-inside:avoid}.dim h2,.authcard h2{font-size:1.05rem;margin:0 0 11px;padding-bottom:7px;border-bottom:1px solid var(--rule)}.tag{font:600 .65rem monospace;color:var(--accent);margin-left:8px}ul{margin:0;padding:0;list-style:none}li{display:flex;gap:10px;margin:0 0 10px;line-height:1.6}.dot{width:8px;height:8px;border-radius:50%;margin-top:7px;flex:none;background:var(--accent)}.dot.amber{background:var(--amber)}.dot.steel{background:var(--steel)}.dot.rose{background:var(--rose)}.cite{font: .78rem monospace;color:var(--faint)}.authcard{margin-top:28px;border:1px solid var(--rose);background:#f6e6e4;padding:16px 20px}.authcard h2{color:var(--rose);border:0}.lenses{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}.lens{padding:14px 16px;background:#f5ead9}.lens.stretch{background:#e6eaf5}.lens h3{font:600 .9rem Georgia;margin:0 0 8px;color:var(--amber)}.lens.stretch h3{color:var(--steel)}.lens li{font-size:.84rem}.disclaimer{margin-top:26px;padding-top:14px;border-top:1px dashed #b9c1ba;font-size:.78rem;color:var(--faint);font-style:italic}.footline{display:flex;justify-content:space-between;margin-top:12px;font: .65rem monospace;color:var(--faint)}@media(max-width:640px){body{padding:14px}.sheet{padding:24px 20px}.letterhead{display:block}.meta{text-align:left;margin-top:8px}.factbar{flex-wrap:wrap}.fact{flex:1 1 45%}.lenses{grid-template-columns:1fr}}@media print{body{padding:0;background:white}.sheet{border:0;box-shadow:none;max-width:none;padding:8mm 10mm}}\n" +
            "</style></head><body><main class=\"sheet\"><header class=\"letterhead\"><div><h1>Lab Notebook Brief</h1><div class=\"sub\">Week 4 · Functions &amp; Recursion · C Programming Lab</div></div><div class=\"meta\">Student N240035<br>Advisory report</div></header>\n" +
            "<h2 class=\"factshead\">Submission at a glance</h2><div class=\"factbar\"><div class=\"fact\"><span class=\"n\">12</span><span class=\"l\">Programs submitted</span></div><div class=\"fact\"><span class=\"n\">Not specified</span><span class=\"l\">Required</span></div><div class=\"fact\"><span class=\"n\">Not determined</span><span class=\"l\">Self-initiated extras</span></div><div class=\"fact\"><span class=\"n\">11</span><span class=\"l\">Code explanations written</span></div></div><section class=\"dim\"><h2>Does the code run without basic mistakes?<span class=\"tag\">D1</span></h2><ul><li><span class=\"dot teal\"></span><span>The student submitted twelve C source files covering fundamental control structures. <span class=\"cite\">(Source files lab1.1.c through lab1.8.c)</span></span></li></ul></section><section class=\"dim\"><h2>Is the logic actually correct?<span class=\"tag\">D2</span></h2><ul><li><span class=\"dot teal\"></span><span>The implementation of conditional logic follows standard patterns.</span></li></ul></section><section class=\"dim\"><h2>How good is the written explanation?<span class=\"tag\">D3</span></h2><ul><li><span class=\"dot amber\"></span><span>The handwritten lab report spans three pages.</span></li></ul></section><section class=\"dim\"><h2>Does the explanation match the code?<span class=\"tag\">D4</span></h2><ul><li><span class=\"dot steel\"></span><span>The notebook observations correspond directly to the implemented source files.</span></li></ul></section><section class=\"dim\"><h2>Did they go beyond what was asked?<span class=\"tag\">D5</span></h2><ul><li><span class=\"dot teal\"></span><span>Because explicit assignment guidelines are not provided...</span></li></ul></section>\n" +
            "<section class=\"authcard\"><h2>Anything worth double-checking in person? <span class=\"tag\">Not a score</span></h2><ul><li><span class=\"dot rose\"></span><span>The lab report header references WEEK-1 LAB REPORT.</span></li></ul></section>\n" +
            "<section class=\"lenses\"><div class=\"lens\"><h3>If reinforcing basics</h3><ul><li>Continue practicing modular programming techniques.</li></ul></div><div class=\"lens stretch\"><h3>If looking for room to grow</h3><ul><li>Explore advanced error handling and input validation.</li></ul></div></section>\n" +
            "<div class=\"disclaimer\">Based only on the code and notebook submitted.</div><div class=\"footline\"><span> · Week 4</span><span>Not a grade · advisory only</span></div></main></body></html>";

    @BeforeEach
    void setUp() {
        transformer = new EmailReportHtmlTransformer();
    }

    @Test
    void testIsHtmlContentDetection() {
        assertTrue(transformer.isHtmlContent(SAMPLE_HTML, "N240035_lab_notebook.html"));
        assertTrue(transformer.isHtmlContent("<html><body>Hi</body></html>", "document.txt"));
        assertFalse(transformer.isHtmlContent("{\"student\": \"N240035\"}", "report.json"));
    }

    @Test
    void testTransformToEmailSafeHtml_PreservesAllSectionsAndAddsFacultyMessage() {
        String customMsg = "Please review your code for Week 4 carefully before the next lab session.";
        String emailSafe = transformer.transformToEmailSafeHtml(SAMPLE_HTML, customMsg);

        assertNotNull(emailSafe);

        // 1. Verify faculty message box is at the top
        assertTrue(emailSafe.contains("Message from Faculty:"));
        assertTrue(emailSafe.contains("Please review your code for Week 4 carefully"));

        // 2. Verify all key report sections are preserved
        assertTrue(emailSafe.contains("Lab Notebook Brief"));
        assertTrue(emailSafe.contains("N240035"));
        assertTrue(emailSafe.contains("Week 4 · Functions &amp; Recursion · C Programming Lab"));
        assertTrue(emailSafe.contains("Submission at a glance"));
        assertTrue(emailSafe.contains("Programs submitted"));
        assertTrue(emailSafe.contains("D1"));
        assertTrue(emailSafe.contains("D2"));
        assertTrue(emailSafe.contains("D3"));
        assertTrue(emailSafe.contains("D4"));
        assertTrue(emailSafe.contains("D5"));
        assertTrue(emailSafe.contains("Anything worth double-checking in person?"));
        assertTrue(emailSafe.contains("If reinforcing basics"));
        assertTrue(emailSafe.contains("If looking for room to grow"));
        assertTrue(emailSafe.contains("Based only on the code and notebook submitted."));

        // 3. Verify CSS variables are inlined / resolved
        assertFalse(emailSafe.contains("var(--paper)"));
        assertFalse(emailSafe.contains("var(--raised)"));
        assertFalse(emailSafe.contains("var(--ink)"));

        // 4. Verify flexbox and grid were transformed to email-safe tables
        assertTrue(emailSafe.contains("<table"));
        assertTrue(emailSafe.contains("border-collapse: collapse") || emailSafe.contains("border-collapse: separate"));
    }
}
