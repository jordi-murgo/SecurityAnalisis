"use strict";

const fs = require("fs");
const path = require("path");

function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function inlineMarkdown(text) {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function markdownToHtml(markdown) {
    const lines = markdown.split(/\r?\n/);
    const html = [];
    let listOpen = false;

    function closeList() {
        if (listOpen) {
            html.push("</ul>");
            listOpen = false;
        }
    }

    for (const line of lines) {
        if (!line.trim()) {
            closeList();
            continue;
        }

        if (line.startsWith("# ")) {
            closeList();
            html.push(`<h1>${inlineMarkdown(line.slice(2).trim())}</h1>`);
            continue;
        }

        if (line.startsWith("## ")) {
            closeList();
            html.push(`<h2>${inlineMarkdown(line.slice(3).trim())}</h2>`);
            continue;
        }

        if (line.startsWith("### ")) {
            closeList();
            html.push(`<h3>${inlineMarkdown(line.slice(4).trim())}</h3>`);
            continue;
        }

        if (line === "---") {
            closeList();
            html.push("<hr />");
            continue;
        }

        if (line.startsWith("- ")) {
            if (!listOpen) {
                html.push("<ul>");
                listOpen = true;
            }
            html.push(`<li>${inlineMarkdown(line.slice(2).trim())}</li>`);
            continue;
        }

        closeList();
        html.push(`<p>${inlineMarkdown(line.trim())}</p>`);
    }

    closeList();

    return [
        "<!doctype html>",
        "<html lang=\"es\">",
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
        "  <title>Cybersecurity Report</title>",
        "  <style>",
        "    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }",
        "    main { max-width: 960px; margin: 0 auto; padding: 32px 24px 64px; }",
        "    h1, h2, h3 { color: #f8fafc; }",
        "    h1 { font-size: 2rem; }",
        "    h2 { margin-top: 2rem; font-size: 1.35rem; border-bottom: 1px solid #334155; padding-bottom: 0.35rem; }",
        "    p, li { line-height: 1.6; }",
        "    code { background: #1e293b; padding: 0.15rem 0.35rem; border-radius: 4px; }",
        "    ul { padding-left: 1.25rem; }",
        "    hr { border: none; border-top: 1px solid #334155; margin: 2rem 0; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <main>",
        html.map((line) => `    ${line}`).join("\n"),
        "  </main>",
        "</body>",
        "</html>"
    ].join("\n");
}

async function writeReport(options = {}) {
    const workspaceDir = options.workspaceDir;
    const markdown = options.markdown;
    const logger = options.logger;
    const markdownPath = path.join(workspaceDir, "report.md");
    const htmlPath = path.join(workspaceDir, "report.html");

    if (logger) {
        logger.info("Escribiendo artefactos del reporte", { htmlPath, markdownPath });
    }

    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(markdownPath, markdown, "utf8");
    fs.writeFileSync(htmlPath, markdownToHtml(markdown), "utf8");

    return {
        htmlPath,
        markdownPath
    };
}

module.exports = {
    markdownToHtml,
    writeReport
};