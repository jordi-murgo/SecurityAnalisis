"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runCli } = require("../src/cli/run-cli");
const { buildContext } = require("../src/context/build-context");
const { resolveConfig } = require("../src/config/resolve-config");
const { acquireRepo } = require("../src/repo/acquire-repo");
const { validateReport } = require("../src/report/validate-report");
const { runCybersecuritySkill } = require("../src/skill/run-cybersecurity-skill");

function createSilentLogger() {
    return {
        child() {
            return createSilentLogger();
        },
        debug() { },
        error() { },
        info() { },
        warn() { }
    };
}

function createMemoryStream() {
    let buffer = "";
    return {
        write(chunk) {
            buffer += String(chunk);
        },
        toString() {
            return buffer;
        }
    };
}

function copyDirectory(sourceDir, targetDir) {
    fs.cpSync(sourceDir, targetDir, { recursive: true });
}

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "securityanalisis-"));
}

test("happy path generates markdown and html report without gh", async () => {
    const fixtureRepo = path.join(__dirname, "fixtures/sample-repo");
    const tempRoot = createTempDir();
    const workspaceRoot = path.join(tempRoot, "workspace");
    const workspaceDir = path.join(workspaceRoot, "sample-repo");

    fs.mkdirSync(workspaceRoot, { recursive: true });
    copyDirectory(fixtureRepo, workspaceDir);

    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const result = await runCli([
        "node",
        "src/cli.js",
        "octo/sample-repo",
        "--scope",
        "quick",
        "--output",
        workspaceRoot
    ], {
        cwd: tempRoot,
        env: {},
        services: {
            acquireRepo: async () => ({ repoName: "sample-repo", reused: true, workspaceDir }),
            llmClient: async () => ({
                rawReport: [
                    "# Resumen ejecutivo",
                    "",
                    "Reporte generado por el LLM de prueba.",
                    "",
                    "## Stack detectado",
                    "- Lenguajes detectados: JavaScript/TypeScript",
                    "",
                    "## Estructura del proyecto",
                    "- Workspace: demo",
                    "",
                    "## Observaciones técnicas",
                    "- Sin observaciones técnicas adicionales.",
                    "",
                    "## Riesgos y puntos de atención",
                    "- No se detectaron riesgos concluyentes.",
                    "",
                    "## Recomendaciones",
                    "- Mantener revisión humana del reporte."
                ].join("\n"),
                summary: "Resumen LLM de prueba para happy path"
            })
        },
        logger: createSilentLogger(),
        stderr,
        stdout
    });

    assert.equal(result.exitCode, 0);
    assert.match(stdout.toString(), /report\.md/);

    const markdown = fs.readFileSync(path.join(workspaceDir, "report.md"), "utf8");
    const html = fs.readFileSync(path.join(workspaceDir, "report.html"), "utf8");

    assert.doesNotThrow(() => validateReport(markdown));
    assert.match(html, /<h1>Resumen ejecutivo<\/h1>/);
});

test("invalid repo returns exit code 2", async () => {
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    const result = await runCli(["node", "src/cli.js", "repo-invalido"], {
        cwd: process.cwd(),
        env: {},
        logger: createSilentLogger(),
        stderr,
        stdout
    });

    assert.equal(result.exitCode, 2);
    assert.match(stderr.toString(), /owner\/repo inválido/);
});

test("config precedence is flags over env over file", () => {
    const tempRoot = createTempDir();
    const configPath = path.join(tempRoot, "cybersecurity.json");

    fs.writeFileSync(configPath, JSON.stringify({
        llmModel: "file-model",
        llmProvider: "file-provider",
        workspaceDir: "./file-workspace"
    }), "utf8");

    const resolved = resolveConfig({
        cwd: tempRoot,
        env: {
            CC_LLM_MODEL: "env-model",
            CC_LLM_PROVIDER: "env-provider",
            CC_LLM_BASE_URL: "http://env-base",
            CC_WORKSPACE_DIR: "./env-workspace"
        },
        flags: {
            model: "flag-model",
            output: "./flag-workspace",
            provider: "flag-provider",
            scope: "quick"
        },
        logger: createSilentLogger()
    });

    assert.equal(resolved.llmBaseUrl, "http://env-base");
    assert.equal(resolved.model, "flag-model");
    assert.equal(resolved.provider, "flag-provider");
    assert.equal(resolved.workspaceDir, path.join(tempRoot, "flag-workspace"));
    assert.equal(resolved.scope, "quick");
});

test("acquireRepo reuses existing workspace when force is false", async () => {
    const tempRoot = createTempDir();
    const outputDir = path.join(tempRoot, "workspace");
    const workspaceDir = path.join(outputDir, "sample-repo");
    fs.mkdirSync(workspaceDir, { recursive: true });

    let runnerCalls = 0;
    const result = await acquireRepo({
        commandRunner() {
            runnerCalls += 1;
            return "";
        },
        force: false,
        logger: createSilentLogger(),
        outputDir,
        ownerRepo: "octo/sample-repo"
    });

    assert.equal(result.reused, true);
    assert.equal(result.workspaceDir, workspaceDir);
    assert.equal(runnerCalls, 0);
});

test("final report format validator rejects non canonical markdown", () => {
    assert.throws(() => validateReport("# Resumen ejecutivo\n\nCorto"), /200 caracteres|encabezado/i);
});

test("quick context de-prioritizes skill assets and fixtures in topFiles", async () => {
    const tempRoot = createTempDir();
    const repoDir = path.join(tempRoot, "repo");

    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".agent/cybersecurity/references"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "tests/fixtures/demo"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".github/workflows"), { recursive: true });

    fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(repoDir, "src/app.js"), "require('child_process').exec('echo test')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, ".github/workflows/ci.yml"), "name: ci\n", "utf8");
    fs.writeFileSync(path.join(repoDir, ".agent/cybersecurity/references/noisy.md"), "eval('boom')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "tests/fixtures/demo/noisy.js"), "sha1('x')\n", "utf8");

    const context = await buildContext({
        logger: createSilentLogger(),
        repo: "octo/demo",
        scope: "quick",
        workspaceDir: repoDir
    });

    assert.equal(context.topFiles[0], "package.json");
    assert.ok(context.topFiles.includes("src/app.js"));
    assert.ok(!context.topFiles.includes(".agent/cybersecurity/references/noisy.md"));
    assert.ok(!context.topFiles.includes("tests/fixtures/demo/noisy.js"));
});

test("quick skill runner excludes noisy paths and emits unique ids", async () => {
    const tempRoot = createTempDir();
    const repoDir = path.join(tempRoot, "repo");

    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".agent/cybersecurity/references"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "tests/fixtures/demo"), { recursive: true });

    fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(repoDir, "src/app.js"), "require('child_process').exec('echo test')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "src/hash.js"), "function x(){ return md5('a'); }\n", "utf8");
    fs.writeFileSync(path.join(repoDir, ".agent/cybersecurity/references/noisy.md"), "eval('boom')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "tests/fixtures/demo/noisy.js"), "child_process.exec('boom')\n", "utf8");

    const projectContext = await buildContext({
        logger: createSilentLogger(),
        repo: "octo/demo",
        scope: "quick",
        workspaceDir: repoDir
    });

    const skillResult = await runCybersecuritySkill(projectContext, {
        llmClient: async () => ({
            rawReport: [
                "# Resumen ejecutivo",
                "",
                "Resumen generado por LLM de prueba.",
                "",
                "## Stack detectado",
                "- Lenguajes detectados: JavaScript/TypeScript",
                "",
                "## Estructura del proyecto",
                "- Workspace: demo",
                "- Top files: src/app.js, src/hash.js",
                "",
                "## Observaciones técnicas",
                "- Uso de primitivas de ejecución dinámica (HIGH/LOW) — El archivo `src/app.js` usa ejecución dinámica.",
                "",
                "## Riesgos y puntos de atención",
                "- [VULN-001] Uso de primitivas de ejecución dinámica — El archivo `src/app.js` usa ejecución dinámica. Impacto: Aumenta la superficie de inyección.",
                "",
                "## Recomendaciones",
                "- [VULN-001] Corregir el uso de shell."
            ].join("\n"),
            summary: "Resumen generado por LLM de prueba"
        }),
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    assert.match(skillResult.summary, /Resumen generado por LLM de prueba|LLM/);
    assert.ok(skillResult.rawReport.includes("# Resumen ejecutivo"));
    assert.ok(skillResult.rawReport.includes("src/app.js") || skillResult.rawReport.includes("src/hash.js"));
    assert.ok(!skillResult.rawReport.includes(".agent/cybersecurity/references/noisy.md"));
    assert.ok(!skillResult.rawReport.includes("tests/fixtures/demo/noisy.js"));
});

test("heuristic fallback findings have unique sequential IDs", async () => {
    const tempRoot = createTempDir();
    const repoDir = path.join(tempRoot, "repo");

    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });

    fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(repoDir, "src/app.js"), "require('child_process').exec('echo test')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "src/hash.js"), "function x(){ return md5('a'); }\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "src/keys.js"), "var k = 'AKIAIOSFODNN7EXAMPLE'\n", "utf8");

    const projectContext = await buildContext({
        logger: createSilentLogger(),
        repo: "octo/demo",
        scope: "quick",
        workspaceDir: repoDir
    });

    const skillResult = await runCybersecuritySkill(projectContext, {
        llmClient: async () => { throw new Error("LLM unavailable"); },
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    const ids = skillResult.findings.map((f) => f.id);
    const uniqueIds = new Set(ids);

    assert.equal(ids.length, uniqueIds.size, `Duplicate IDs found: ${JSON.stringify(ids)}`);

    for (let i = 0; i < ids.length; i++) {
        const expected = `VULN-${String(i + 1).padStart(3, "0")}`;
        assert.equal(ids[i], expected, `Expected ${expected} at index ${i}, got ${ids[i]}`);
    }
});

test("heuristic findings exclude noisy paths in quick scope", async () => {
    const tempRoot = createTempDir();
    const repoDir = path.join(tempRoot, "repo");

    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, ".agent/skills/cybersecurity/references"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "tests/fixtures/demo"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "workspace-e2e"), { recursive: true });

    fs.writeFileSync(path.join(repoDir, "src/app.js"), "require('child_process').exec('echo legit')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, ".agent/skills/cybersecurity/references/noisy.md"), "eval('boom')\nchild_process.exec('pwned')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "tests/fixtures/demo/noisy.js"), "child_process.exec('fixture')\nmd5('x')\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "workspace-e2e/noisy.js"), "eval('workspace')\n", "utf8");

    const projectContext = await buildContext({
        logger: createSilentLogger(),
        repo: "octo/demo",
        scope: "quick",
        workspaceDir: repoDir
    });

    const skillResult = await runCybersecuritySkill(projectContext, {
        llmClient: async () => { throw new Error("LLM unavailable"); },
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    for (const finding of skillResult.findings) {
        assert.ok(
            !finding.location || !finding.location.includes(".agent/skills"),
            `Finding ${finding.id} originates from skill assets: ${finding.location}`
        );
        assert.ok(
            !finding.location || !finding.location.includes("tests/fixtures"),
            `Finding ${finding.id} originates from test fixtures: ${finding.location}`
        );
        assert.ok(
            !finding.location || !finding.location.includes("workspace-e2e"),
            `Finding ${finding.id} originates from workspace directory: ${finding.location}`
        );
    }
});

test("runCli preserves enriched context and report pipeline contracts", async () => {
    const tempRoot = createTempDir();
    const workspaceRoot = path.join(tempRoot, "workspace");
    const workspaceDir = path.join(workspaceRoot, "sample-repo");
    const stdout = createMemoryStream();
    const stderr = createMemoryStream();

    fs.mkdirSync(workspaceDir, { recursive: true });

    const expectedContext = {
        changedFiles: [],
        detectedLanguages: ["JavaScript/TypeScript"],
        files: ["package.json", "src/app.js"],
        git: { defaultBranch: "main", hasRepo: true },
        iacTypes: ["docker", "terraform"],
        manifests: ["package.json"],
        repo: "octo/sample-repo",
        repoMetrics: { totalFiles: 250 },
        scope: "quick",
        topFiles: ["package.json", "src/app.js"],
        workspaceDir
    };

    let receivedContext = null;

    const result = await runCli([
        "node",
        "src/cli.js",
        "octo/sample-repo",
        "--scope",
        "quick",
        "--output",
        workspaceRoot
    ], {
        cwd: tempRoot,
        env: {},
        services: {
            acquireRepo: async () => ({ repoName: "sample-repo", reused: true, workspaceDir }),
            buildContext: async () => expectedContext,
            runCybersecuritySkill: async (projectContext) => {
                receivedContext = projectContext;
                return {
                    rawReport: [
                        "# Resumen ejecutivo",
                        "",
                        "Reporte integrado con contexto enriquecido.",
                        "",
                        "## Stack detectado",
                        "- Lenguajes detectados: JavaScript/TypeScript",
                        "",
                        "## Estructura del proyecto",
                        "- Repo metrics: totalFiles=250",
                        "- IaC types: docker, terraform",
                        "",
                        "## Observaciones técnicas",
                        "- Fanout preparado para agentes 1 y 5.",
                        "",
                        "## Riesgos y puntos de atención",
                        "- El pipeline conserva metadata y contexto enriquecido.",
                        "",
                        "## Recomendaciones",
                        "- Mantener congelado este contrato con tests."
                    ].join("\n"),
                    summary: "Resumen de pipeline",
                    findings: [],
                    metadata: {
                        provider: "ollama",
                        model: "test-model",
                        scope: "quick"
                    }
                };
            }
        },
        logger: createSilentLogger(),
        stderr,
        stdout
    });

    assert.deepEqual(receivedContext, expectedContext);
    assert.deepEqual(result.projectContext.repoMetrics, { totalFiles: 250 });
    assert.deepEqual(result.projectContext.iacTypes, ["docker", "terraform"]);
    assert.equal(result.skillResult.summary, "Resumen de pipeline");
    assert.deepEqual(result.skillResult.findings, []);
    assert.equal(result.skillResult.metadata.scope, "quick");
    assert.ok(fs.existsSync(path.join(workspaceDir, "report.md")));
    assert.ok(fs.existsSync(path.join(workspaceDir, "report.html")));
});
