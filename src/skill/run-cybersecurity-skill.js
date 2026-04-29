"use strict";

const fs = require("fs");
const path = require("path");

const ALLOWED_BINARIES = ["find", "gh", "git", "grep", "ls"];
const MAX_SCAN_BYTES = 32 * 1024;

function listFilesRecursively(rootDir) {
    const results = [];
    const queue = [rootDir];

    while (queue.length > 0) {
        const current = queue.shift();
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            const absolutePath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queue.push(absolutePath);
                continue;
            }
            results.push(path.relative(rootDir, absolutePath));
        }
    }

    return results.sort();
}

function extractSkillTitle(skillMarkdown) {
    const headingMatch = skillMarkdown.match(/^#\s+(.+)$/m);
    return headingMatch ? headingMatch[1].trim() : "Cybersecurity Skill";
}

function extractMethodHints(skillMarkdown) {
    const lines = skillMarkdown.split(/\r?\n/);
    const hints = [];

    for (const line of lines) {
        const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s+—\s+(.+)$/);
        if (match) {
            hints.push(`${match[1]} — ${match[2]}`);
        }
        if (hints.length === 3) {
            break;
        }
    }

    if (hints.length > 0) {
        return hints;
    }

    return [
        "Gather — detectar stack y límites de confianza",
        "Analyze — priorizar superficies de riesgo",
        "Recommend — proponer remediaciones accionables"
    ];
}

function readFileSnippet(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8").slice(0, MAX_SCAN_BYTES);
    } catch (error) {
        return "";
    }
}

function buildHeuristicFindings(projectContext) {
    const findings = [];
    const repoRoot = projectContext.workspaceDir;
    const filesToInspect = Array.from(new Set([
        ...projectContext.topFiles,
        ...projectContext.changedFiles,
        ...projectContext.manifests
    ])).slice(0, 30);

    const packageLockPresent = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"].some((fileName) => fs.existsSync(path.join(repoRoot, fileName)));
    if (projectContext.manifests.includes("package.json") && !packageLockPresent) {
        findings.push({
            confidence: "MEDIUM",
            fix: "Versiona un lockfile y ejecútalo en CI para fijar dependencias reproducibles.",
            id: "VULN-001",
            severity: "MEDIUM",
            title: "Dependencias JavaScript sin lockfile versionado",
            what: "El repositorio incluye `package.json` pero no muestra un lockfile compatible en la raíz.",
            why: "La resolución no determinista de dependencias dificulta auditorías reproducibles y aumenta riesgo de supply chain."
        });
    }

    if (fs.existsSync(path.join(repoRoot, ".env")) || fs.existsSync(path.join(repoRoot, ".env.local"))) {
        findings.push({
            confidence: "MEDIUM",
            fix: "Confirma que los ficheros `.env*` no se versionan y sustituye secretos reales por placeholders.",
            id: "VULN-002",
            severity: "MEDIUM",
            title: "Presencia de archivo de variables de entorno sensible",
            what: "Se detectó un archivo `.env` o `.env.local` dentro del workspace auditado.",
            why: "Estos ficheros suelen concentrar credenciales y merecen control estricto de acceso y exclusión del VCS."
        });
    }

    for (const relativePath of filesToInspect) {
        const absolutePath = path.join(repoRoot, relativePath);
        const content = readFileSnippet(absolutePath);
        if (!content) {
            continue;
        }

        if (/(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/.test(content)) {
            findings.push({
                confidence: "HIGH",
                fix: "Revoca el secreto expuesto, elimínalo del historial y muévelo a un gestor de secretos.",
                id: "VULN-003",
                severity: "CRITICAL",
                title: "Posible secreto o clave privada expuesta",
                what: `El archivo \`${relativePath}\` contiene un patrón compatible con credenciales de alto impacto.`,
                why: "Una credencial reutilizable en repositorio permite acceso directo o pivoting sobre sistemas externos."
            });
        }

        if (/\beval\s*\(|child_process\.(exec|spawn)\s*\(/.test(content)) {
            findings.push({
                confidence: "MEDIUM",
                fix: "Sustituye evaluación dinámica por APIs seguras y valida exhaustivamente cualquier dato que llegue a shell.",
                id: "VULN-004",
                severity: "HIGH",
                title: "Uso de primitivas de ejecución dinámica",
                what: `El archivo \`${relativePath}\` usa evaluación dinámica o ejecución de procesos del sistema.`,
                why: "Estas primitivas amplían la superficie de inyección y requieren aislamiento o sanitización fuerte."
            });
        }

        if (/md5\s*\(|sha1\s*\(/i.test(content)) {
            findings.push({
                confidence: "MEDIUM",
                fix: "Usa primitivas modernas como SHA-256/512 o Argon2/bcrypt según el caso de uso.",
                id: "VULN-005",
                severity: "MEDIUM",
                title: "Uso de hash criptográfico débil",
                what: `El archivo \`${relativePath}\` referencia algoritmos débiles como md5 o sha1.`,
                why: "Algoritmos débiles facilitan colisiones o verificaciones inseguras en flujos críticos."
            });
        }

        if (findings.length >= 5) {
            break;
        }
    }

    if (findings.length === 0) {
        findings.push({
            confidence: "LOW",
            fix: "Amplía el análisis con ejecución real del skill/LLM y añade validaciones específicas por framework.",
            id: "VULN-000",
            severity: "INFO",
            title: "Cobertura heurística inicial sin hallazgos concluyentes",
            what: "La pasada determinista no encontró patrones de alto riesgo en los archivos priorizados.",
            why: "El MVP inspecciona contexto y señales rápidas, pero no reemplaza un análisis profundo orientado a flujos."
        });
    }

    return findings;
}

async function runCybersecuritySkill(projectContext, executionOptions = {}) {
    const repoRoot = path.resolve(projectContext.workspaceDir);
    const skillRoot = path.resolve(__dirname, "../../.agent/cybersecurity");
    const skillPath = path.join(skillRoot, "SKILL.md");

    const skillMarkdown = fs.readFileSync(skillPath, "utf8");
    const assetIndex = listFilesRecursively(skillRoot);
    const skillTitle = extractSkillTitle(skillMarkdown);
    const methodHints = extractMethodHints(skillMarkdown);
    const findings = buildHeuristicFindings(projectContext);

    const summary = [
        `${skillTitle} ejecutado sobre ${projectContext.repo} en modo ${projectContext.scope}.`,
        `Se priorizaron ${projectContext.files.length} archivos de alcance con ${projectContext.topFiles.length} entradas destacadas y ${assetIndex.length} assets confiables del skill.`,
        `La salida sigue el enfoque ${methodHints.join(" | ")}.`
    ].join(" ");

    const rawReport = [
        `# ${skillTitle}`,
        "",
        `- Repo: ${projectContext.repo}`,
        `- Scope: ${projectContext.scope}`,
        `- CWD: ${repoRoot}`,
        `- Trusted skill assets: ${assetIndex.length}`,
        `- Allowed binaries: ${ALLOWED_BINARIES.join(", ")}`,
        "",
        "## Summary",
        summary,
        "",
        "## Findings",
        ...findings.map((finding) => `- [${finding.id}] ${finding.title} (${finding.severity}/${finding.confidence}) — ${finding.what}`),
        "",
        "## Context",
        `Languages: ${projectContext.detectedLanguages.join(", ") || "No detectadas"}`,
        `Manifests: ${projectContext.manifests.join(", ") || "Ninguno"}`,
        `Changed files: ${projectContext.changedFiles.join(", ") || "N/A"}`
    ].join("\n");

    return {
        findings,
        metadata: {
            allowedBinaries: ALLOWED_BINARIES.slice(),
            assetIndex,
            cwd: repoRoot,
            model: executionOptions.model,
            provider: executionOptions.provider,
            scope: projectContext.scope,
            skillPath,
            trustedRoots: [skillPath, skillRoot],
            untrustedRoots: [repoRoot]
        },
        rawReport,
        summary
    };
}

module.exports = {
    runCybersecuritySkill
};