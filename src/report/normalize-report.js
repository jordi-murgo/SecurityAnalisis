"use strict";

function asBulletList(items, fallback) {
    if (!Array.isArray(items) || items.length === 0) {
        return `- ${fallback}`;
    }

    return items.map((item) => `- ${item}`).join("\n");
}

function normalizeFinding(finding) {
    return `[${finding.id}] ${finding.title} — ${finding.what} Impacto: ${finding.why}`;
}

function normalizeRecommendation(finding) {
    return `[${finding.id}] ${finding.fix}`;
}

function normalizeReport({ projectContext, skillResult }) {
    const findings = Array.isArray(skillResult.findings) ? skillResult.findings : [];
    const metadata = skillResult.metadata || {};

    const sections = [
        "# Resumen ejecutivo",
        [
            `El análisis MVP sobre \`${projectContext.repo}\` se ejecutó en modo \`${projectContext.scope}\` con provider \`${metadata.provider || "ollama"}\` y model \`${metadata.model || "deepseek-r1:8b"}\`.`,
            skillResult.summary,
            `Se revisaron ${projectContext.files.length} archivos en alcance y ${projectContext.topFiles.length} archivos priorizados con un runtime que separa assets confiables del skill y contenido no confiable del repositorio.`
        ].join("\n\n"),
        "## Stack detectado",
        asBulletList([
            `Lenguajes detectados: ${projectContext.detectedLanguages.join(", ") || "No detectados"}`,
            `Manifests: ${projectContext.manifests.join(", ") || "Ninguno"}`,
            `Binarios permitidos por el runner: ${(metadata.allowedBinaries || []).join(", ") || "Ninguno"}`
        ], "No se detectó stack relevante."),
        "## Estructura del proyecto",
        asBulletList([
            `Workspace: ${projectContext.workspaceDir}`,
            `Top files: ${projectContext.topFiles.join(", ") || "Ninguno"}`,
            `Changed files: ${projectContext.changedFiles.join(", ") || "N/A"}`,
            `Git: repo=${projectContext.git.hasRepo ? "sí" : "no"}, defaultBranch=${projectContext.git.defaultBranch || "desconocida"}`
        ], "No se pudo construir la estructura del proyecto."),
        "## Observaciones técnicas",
        asBulletList(findings.map((finding) => `${finding.title} (${finding.severity}/${finding.confidence}) — ${finding.what}`), "Sin observaciones técnicas adicionales."),
        "## Riesgos y puntos de atención",
        asBulletList(findings.map(normalizeFinding), "No se detectaron riesgos concluyentes en la pasada heurística."),
        "## Recomendaciones",
        asBulletList(findings.map(normalizeRecommendation), "Mantener revisión humana y ampliar cobertura del skill."),
        "",
        "---",
        "",
        "### Anexo: raw report del skill",
        skillResult.rawReport.trim()
    ];

    return {
        markdown: sections.join("\n\n")
    };
}

module.exports = {
    normalizeReport
};