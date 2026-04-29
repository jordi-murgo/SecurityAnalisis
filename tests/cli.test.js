"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runCli } = require("../src/cli/run-cli");
const { resolveConfig } = require("../src/config/resolve-config");
const { acquireRepo } = require("../src/repo/acquire-repo");
const { validateReport } = require("../src/report/validate-report");

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
            acquireRepo: async () => ({ repoName: "sample-repo", reused: true, workspaceDir })
        },
        stderr,
        stdout
    });

    assert.equal(result.exitCode, 0);
    assert.match(stdout.toString(), /report\.md/);
    assert.equal(stderr.toString(), "");

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
            CC_WORKSPACE_DIR: "./env-workspace"
        },
        flags: {
            model: "flag-model",
            output: "./flag-workspace",
            provider: "flag-provider",
            scope: "quick"
        }
    });

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