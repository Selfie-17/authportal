package com.selva.authportal.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Transforms evaluation reports (such as N240035_lab_notebook.html or generated reports)
 * into email-safe, beautifully rendered HTML bodies compatible with Gmail, Outlook, Apple Mail, etc.
 *
 * Replaces unsupported email features:
 * - CSS variables (:root and var(--...)) with solid hex colors
 * - flexbox (.letterhead, .factbar, li) with email-safe HTML tables
 * - CSS grid (.lenses) with 2-column email tables
 * - Prepend faculty message box above the report if provided
 */
@Slf4j
@Service
public class EmailReportHtmlTransformer {

    private static final String DEFAULT_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    private static final String SERIF_FONT = "Georgia, 'Times New Roman', serif";
    private static final String MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

    // Palette extracted from the Lab Notebook design
    private static final String COLOR_PAPER = "#f5f6f3";
    private static final String COLOR_RAISED = "#ffffff";
    private static final String COLOR_INK = "#1b2430";
    private static final String COLOR_SOFT = "#4b5563";
    private static final String COLOR_FAINT = "#7c8794";
    private static final String COLOR_RULE = "#d7dcd7";
    private static final String COLOR_ACCENT = "#2e6f6e";
    private static final String COLOR_AMBER = "#a5691e";
    private static final String COLOR_STEEL = "#3b5ba5";
    private static final String COLOR_ROSE = "#a1443f";

    /**
     * Checks if the content is an HTML evaluation report.
     */
    public boolean isHtmlContent(String content, String filename) {
        if (filename != null && (filename.toLowerCase().endsWith(".html") || filename.toLowerCase().endsWith(".htm"))) {
            return true;
        }
        if (content == null || content.isBlank()) {
            return false;
        }
        String trimmed = content.trim().toLowerCase();
        return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.contains("<body");
    }

    /**
     * Transforms an arbitrary HTML report into a complete, email-safe HTML document
     * with the faculty message prepended.
     */
    public String transformToEmailSafeHtml(String rawHtml, String customMessage) {
        if (rawHtml == null || rawHtml.isBlank()) {
            return "";
        }

        try {
            // First resolve any CSS variables in raw string if present
            String inlinedVarsHtml = resolveCssVariables(rawHtml);

            Document doc = Jsoup.parse(inlinedVarsHtml);
            doc.outputSettings().prettyPrint(true);

            // Check if this is the specialized "Lab Notebook Brief" format
            boolean isLabNotebook = doc.select(".sheet, .letterhead, .factbar, .dim, .authcard, .lenses").size() > 0;

            if (isLabNotebook) {
                transformLabNotebookReport(doc);
            } else {
                transformGenericHtmlReport(doc);
            }

            // Build Faculty Message Banner if customMessage exists
            String facultyMessageHtml = "";
            if (customMessage != null && !customMessage.trim().isEmpty()) {
                facultyMessageHtml = buildFacultyMessageBanner(customMessage.trim());
            }

            Element body = doc.body();
            if (body != null) {
                // Ensure email background wrapper
                body.attr("style", "margin:0; padding:24px 12px; background-color:" + COLOR_PAPER + "; color:" + COLOR_INK + "; font-family:" + DEFAULT_FONT + "; font-size:15px; line-height:1.55;");

                if (!facultyMessageHtml.isEmpty()) {
                    body.prepend(facultyMessageHtml);
                }
            }

            return doc.html();

        } catch (Exception e) {
            log.error("Failed to transform HTML report for email, falling back to sanitizing raw HTML: {}", e.getMessage(), e);
            // Fallback: attach faculty message above the raw HTML
            if (customMessage != null && !customMessage.isBlank()) {
                return buildFacultyMessageBanner(customMessage.trim()) + "<div style='margin-top:16px;'>" + rawHtml + "</div>";
            }
            return rawHtml;
        }
    }

    /**
     * Transforms the specific RGUKT / AI "Lab Notebook Brief" layout into an email-safe table structure.
     */
    private void transformLabNotebookReport(Document doc) {
        // 1. .sheet wrapper
        Elements sheets = doc.select(".sheet");
        for (Element sheet : sheets) {
            sheet.attr("style", "max-width: 680px; margin: 0 auto; background-color: " + COLOR_RAISED + "; border: 1px solid " + COLOR_RULE + "; padding: 32px 36px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-radius: 4px;");
        }

        // 2. .letterhead -> Replace flexbox with an email-safe 2-column table
        Elements letterheads = doc.select(".letterhead");
        for (Element lh : letterheads) {
            Element leftDiv = lh.children().first();
            Element metaDiv = lh.selectFirst(".meta");

            String leftContent = (leftDiv != null) ? leftDiv.html() : "";
            String rightContent = (metaDiv != null) ? metaDiv.html() : "";

            // Format typography inside header
            leftContent = leftContent
                    .replaceAll("<h1([^>]*)>", "<h1$1 style=\"font-family: " + SERIF_FONT + "; font-size: 24px; font-weight: 700; color: " + COLOR_INK + "; margin: 0 0 4px 0; line-height: 1.2;\">")
                    .replaceAll("<div class=\"sub\"([^>]*)>", "<div class=\"sub\"$1 style=\"color: " + COLOR_SOFT + "; font-size: 13px; margin: 0;\">");

            String letterheadTable = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-bottom: 2px solid " + COLOR_INK + "; padding-bottom: 14px; margin-bottom: 18px;\">" +
                    "<tr>" +
                    "<td align=\"left\" valign=\"bottom\" style=\"vertical-align: bottom;\">" + leftContent + "</td>" +
                    "<td align=\"right\" valign=\"bottom\" style=\"text-align: right; vertical-align: bottom; font-family: " + MONO_FONT + "; font-size: 11px; color: " + COLOR_SOFT + "; line-height: 1.4;\">" + rightContent + "</td>" +
                    "</tr>" +
                    "</table>";

            lh.after(letterheadTable);
            lh.remove();
        }

        // 3. .factshead
        Elements factsheads = doc.select(".factshead");
        for (Element fh : factsheads) {
            fh.attr("style", "font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: " + COLOR_FAINT + "; margin: 20px 0 8px 0;");
        }

        // 4. .factbar -> Replace flexbox with table columns
        Elements factbars = doc.select(".factbar");
        for (Element fb : factbars) {
            Elements facts = fb.select(".fact");
            int count = Math.max(1, facts.size());
            int colWidth = 100 / count;

            StringBuilder tableSb = new StringBuilder();
            tableSb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border: 1px solid ").append(COLOR_RULE).append("; border-collapse: collapse; margin-bottom: 22px;\">");
            tableSb.append("<tr>");

            for (int i = 0; i < facts.size(); i++) {
                Element fact = facts.get(i);
                boolean isLast = (i == facts.size() - 1);
                String borderRight = isLast ? "border-right: none;" : "border-right: 1px solid " + COLOR_RULE + ";";

                Element nElem = fact.selectFirst(".n");
                Element lElem = fact.selectFirst(".l");

                String nText = (nElem != null) ? nElem.text() : "";
                String lText = (lElem != null) ? lElem.text() : "";

                tableSb.append("<td width=\"").append(colWidth).append("%\" style=\"padding: 10px 12px; background-color: ").append(COLOR_PAPER)
                        .append("; ").append(borderRight).append(" text-align: center; vertical-align: top;\">")
                        .append("<span style=\"display: block; font-family: ").append(MONO_FONT).append("; font-weight: bold; font-size: 18px; color: ").append(COLOR_ACCENT).append(";\">")
                        .append(escapeHtml(nText))
                        .append("</span>")
                        .append("<span style=\"display: block; font-size: 10px; text-transform: uppercase; color: ").append(COLOR_FAINT).append("; margin-top: 3px; font-weight: 600;\">")
                        .append(escapeHtml(lText))
                        .append("</span>")
                        .append("</td>");
            }

            tableSb.append("</tr></table>");
            fb.after(tableSb.toString());
            fb.remove();
        }

        // 5. Dimension Sections (.dim)
        Elements dims = doc.select(".dim");
        for (Element dim : dims) {
            dim.attr("style", "margin-top: 24px;");

            Elements h2s = dim.select("h2");
            for (Element h2 : h2s) {
                h2.attr("style", "font-family: " + SERIF_FONT + "; font-size: 17px; font-weight: 700; color: " + COLOR_INK + "; margin: 0 0 12px 0; padding-bottom: 7px; border-bottom: 1px solid " + COLOR_RULE + ";");
            }

            // Style dimension tags
            Elements tags = dim.select(".tag");
            for (Element tag : tags) {
                tag.attr("style", "display: inline-block; font-family: " + MONO_FONT + "; font-weight: 700; font-size: 11px; color: " + COLOR_ACCENT + "; margin-left: 8px; background-color: #e6f0f0; padding: 2px 7px; border-radius: 3px;");
            }

            // Replace ul/li flex with email-safe bullet table
            Elements uls = dim.select("ul");
            for (Element ul : uls) {
                Elements lis = ul.select("li");
                StringBuilder liTableSb = new StringBuilder();

                for (Element li : lis) {
                    Element dot = li.selectFirst(".dot");
                    String dotColor = COLOR_ACCENT;
                    if (dot != null) {
                        if (dot.hasClass("amber")) dotColor = COLOR_AMBER;
                        else if (dot.hasClass("steel")) dotColor = COLOR_STEEL;
                        else if (dot.hasClass("rose")) dotColor = COLOR_ROSE;
                        dot.remove(); // remove so we render the inline circle
                    }

                    // Style cite spans inside li
                    Elements cites = li.select(".cite");
                    for (Element cite : cites) {
                        cite.attr("style", "font-family: " + MONO_FONT + "; font-size: 12px; color: " + COLOR_FAINT + ";");
                    }

                    String liContent = li.html();

                    liTableSb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-bottom: 10px;\">")
                            .append("<tr>")
                            .append("<td width=\"16\" valign=\"top\" style=\"width: 16px; padding-top: 7px;\">")
                            .append("<div style=\"width: 8px; height: 8px; border-radius: 50%; background-color: ").append(dotColor).append(";\"></div>")
                            .append("</td>")
                            .append("<td valign=\"top\" style=\"font-size: 14px; line-height: 1.6; color: ").append(COLOR_INK).append("; padding-left: 8px;\">")
                            .append(liContent)
                            .append("</td>")
                            .append("</tr>")
                            .append("</table>");
                }

                ul.after(liTableSb.toString());
                ul.remove();
            }
        }

        // 6. .authcard (Double-checking in person section)
        Elements authcards = doc.select(".authcard");
        for (Element ac : authcards) {
            ac.attr("style", "margin-top: 24px; border: 1px solid " + COLOR_ROSE + "; background-color: #f6e6e4; padding: 16px 20px; border-radius: 4px;");

            Elements h2s = ac.select("h2");
            for (Element h2 : h2s) {
                h2.attr("style", "font-family: " + SERIF_FONT + "; font-size: 16px; font-weight: 700; color: " + COLOR_ROSE + "; margin: 0 0 10px 0; border: none; padding: 0;");
            }

            Elements tags = ac.select(".tag");
            for (Element tag : tags) {
                tag.attr("style", "display: inline-block; font-family: " + MONO_FONT + "; font-size: 11px; font-weight: 600; color: " + COLOR_ROSE + "; background-color: #fadcd9; padding: 2px 6px; border-radius: 3px; margin-left: 8px;");
            }

            Elements uls = ac.select("ul");
            for (Element ul : uls) {
                Elements lis = ul.select("li");
                StringBuilder liTableSb = new StringBuilder();

                for (Element li : lis) {
                    Element dot = li.selectFirst(".dot");
                    if (dot != null) dot.remove();

                    Elements cites = li.select(".cite");
                    for (Element cite : cites) {
                        cite.attr("style", "font-family: " + MONO_FONT + "; font-size: 12px; color: " + COLOR_FAINT + ";");
                    }

                    liTableSb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-bottom: 8px;\">")
                            .append("<tr>")
                            .append("<td width=\"16\" valign=\"top\" style=\"width: 16px; padding-top: 7px;\">")
                            .append("<div style=\"width: 8px; height: 8px; border-radius: 50%; background-color: ").append(COLOR_ROSE).append(";\"></div>")
                            .append("</td>")
                            .append("<td valign=\"top\" style=\"font-size: 14px; line-height: 1.6; color: ").append(COLOR_INK).append("; padding-left: 8px;\">")
                            .append(li.html())
                            .append("</td>")
                            .append("</tr>")
                            .append("</table>");
                }
                ul.after(liTableSb.toString());
                ul.remove();
            }
        }

        // 7. .lenses (2-Column recommendations) -> Replace CSS Grid with 2-Column Email Table
        Elements lensesContainers = doc.select(".lenses");
        for (Element lc : lensesContainers) {
            Elements lenses = lc.select(".lens");
            if (lenses.size() >= 2) {
                Element lens1 = lenses.get(0);
                Element lens2 = lenses.get(1);

                styleLensBox(lens1, "#f5ead9", COLOR_AMBER);
                styleLensBox(lens2, "#e6eaf5", COLOR_STEEL);

                String tableHtml = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-top: 24px; border-collapse: separate; border-spacing: 12px 0;\">" +
                        "<tr>" +
                        "<td width=\"50%\" valign=\"top\" style=\"background-color: #f5ead9; padding: 14px 16px; border-radius: 4px; vertical-align: top;\">" + lens1.html() + "</td>" +
                        "<td width=\"50%\" valign=\"top\" style=\"background-color: #e6eaf5; padding: 14px 16px; border-radius: 4px; vertical-align: top;\">" + lens2.html() + "</td>" +
                        "</tr>" +
                        "</table>";

                lc.after(tableHtml);
                lc.remove();
            } else {
                for (Element lens : lenses) {
                    styleLensBox(lens, "#f5ead9", COLOR_AMBER);
                }
            }
        }

        // 8. .disclaimer
        Elements disclaimers = doc.select(".disclaimer");
        for (Element disc : disclaimers) {
            disc.attr("style", "margin-top: 26px; padding-top: 14px; border-top: 1px dashed #b9c1ba; font-size: 12px; color: " + COLOR_FAINT + "; font-style: italic; line-height: 1.5;");
        }

        // 9. .footline -> Replace flex with 2-column table
        Elements footlines = doc.select(".footline");
        for (Element fl : footlines) {
            Elements spans = fl.select("span");
            String left = (spans.size() > 0) ? spans.get(0).html() : "";
            String right = (spans.size() > 1) ? spans.get(1).html() : "";

            String tableHtml = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-top: 14px; font-family: " + MONO_FONT + "; font-size: 11px; color: " + COLOR_FAINT + ";\">" +
                    "<tr>" +
                    "<td align=\"left\" style=\"text-align: left;\">" + left + "</td>" +
                    "<td align=\"right\" style=\"text-align: right;\">" + right + "</td>" +
                    "</tr>" +
                    "</table>";

            fl.after(tableHtml);
            fl.remove();
        }
    }

    private void styleLensBox(Element lens, String bgColor, String headingColor) {
        lens.attr("style", "padding: 14px 16px; background-color: " + bgColor + "; border-radius: 4px; margin-bottom: 12px;");
        Elements h3s = lens.select("h3");
        for (Element h3 : h3s) {
            h3.attr("style", "font-family: " + SERIF_FONT + "; font-size: 14px; font-weight: 700; color: " + headingColor + "; margin: 0 0 8px 0;");
        }
        Elements uls = lens.select("ul");
        for (Element ul : uls) {
            ul.attr("style", "margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.5; color: " + COLOR_INK + ";");
        }
        Elements lis = lens.select("li");
        for (Element li : lis) {
            li.attr("style", "margin-bottom: 6px;");
        }
    }

    /**
     * Fallback general transformer that inlines essential container and typography styles.
     */
    private void transformGenericHtmlReport(Document doc) {
        Element body = doc.body();
        if (body != null) {
            body.attr("style", "font-family: " + DEFAULT_FONT + "; margin: 0; padding: 20px; background-color: #f8fafc; color: #1e293b;");
        }
    }

    /**
     * Builds the faculty custom message alert banner displayed at the top of the email.
     */
    private String buildFacultyMessageBanner(String customMessage) {
        return "<div style=\"max-width: 680px; margin: 0 auto 20px auto; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); font-family: " + DEFAULT_FONT + ";\">" +
                "<div style=\"font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1d4ed8; margin-bottom: 4px;\">Message from Faculty:</div>" +
                "<div style=\"font-size: 14px; color: #1e293b; line-height: 1.5; white-space: pre-wrap;\">" + escapeHtml(customMessage) + "</div>" +
                "</div>";
    }

    /**
     * Replaces CSS variables (var(--...)) with solid hex colors.
     */
    private String resolveCssVariables(String html) {
        return html
                .replaceAll("var\\(--paper\\)", COLOR_PAPER)
                .replaceAll("var\\(--raised\\)", COLOR_RAISED)
                .replaceAll("var\\(--ink\\)", COLOR_INK)
                .replaceAll("var\\(--soft\\)", COLOR_SOFT)
                .replaceAll("var\\(--faint\\)", COLOR_FAINT)
                .replaceAll("var\\(--rule\\)", COLOR_RULE)
                .replaceAll("var\\(--accent\\)", COLOR_ACCENT)
                .replaceAll("var\\(--amber\\)", COLOR_AMBER)
                .replaceAll("var\\(--steel\\)", COLOR_STEEL)
                .replaceAll("var\\(--rose\\)", COLOR_ROSE);
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
