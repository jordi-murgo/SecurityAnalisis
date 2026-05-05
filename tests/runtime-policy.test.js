"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    BINARY_WHITELIST,
    binaryPreflight,
    buildPolicyPrompt,
    resolveToolset,
    shouldFanout
} = require("../src/skill/runtime-policy");
const { buildContext } = require("../src/context/build-context");

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "securityanalisis-runtime-policy-"));
}

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

test("resolveToolset enables bash and sub-agents for agent 1", () => {
    const toolset = resolveToolset(0, { totalFiles: 50 });

    assert.equal(toolset.bash, true);
    assert.equal(toolset.subAgents, true);
    assert.deepEqual(toolset.binaries, BINARY_WHITELIST);
});

test("resolveToolset enables bash and sub-agents for agent 5", () => {
    const toolset = resolveToolset(4, { totalFiles: 50 });

    assert.equal(toolset.bash, true);
    assert.equal(toolset.subAgents, true);
});

test("resolveToolset keeps agent 7 read-only", () => {
    const toolset = resolveToolset(6, { totalFiles: 50 });

    assert.equal(toolset.bash, false);
    assert.equal(toolset.subAgents, false);
    assert.deepEqual(toolset.binaries, []);
});

test("resolveToolset keeps agent 8 read-only", () => {
    const toolset = resolveToolset(7, { totalFiles: 50 });

    assert.equal(toolset.bash, false);
    assert.equal(toolset.subAgents, false);
    assert.deepEqual(toolset.binaries, []);
});

test("shouldFanout respects the file threshold", () => {
    assert.equal(shouldFanout({ totalFiles: 100 }), false);
    assert.equal(shouldFanout({ totalFiles: 200 }), false);
    assert.equal(shouldFanout({ totalFiles: 201 }), true);
});

test("buildPolicyPrompt includes bash and sub-agents when allowed", () => {
    const prompt = buildPolicyPrompt(0, { totalFiles: 250 });

    assert.match(prompt, /bash/);
    assert.match(prompt, /sub-agents/);
    assert.match(prompt, /Fanout: enabled/);
});

test("buildPolicyPrompt marks read-only agents correctly", () => {
    const prompt = buildPolicyPrompt(6, { totalFiles: 100 });

    assert.match(prompt, /read-only agent/);
    assert.doesNotMatch(prompt, /Allowed tools: .*bash/);
});

test("binary whitelist keeps the canonical 18 entries", () => {
    assert.equal(BINARY_WHITELIST.length, 18);
});

test("binaryPreflight returns all binaries as available when which succeeds", async () => {
    const result = await binaryPreflight(() => ({ status: 0 }));

    assert.deepEqual(result.available, BINARY_WHITELIST);
    assert.deepEqual(result.missing, []);
});

test("binaryPreflight degrades gracefully when some binaries are missing", async () => {
    const result = await binaryPreflight((binary) => ({
        status: ["npm", "cargo"].includes(binary) ? 1 : 0
    }));

    assert.deepEqual(result.missing, ["npm", "cargo"]);
    assert.deepEqual(
        result.available,
        BINARY_WHITELIST.filter((binary) => !["npm", "cargo"].includes(binary))
    );
});

test("binaryPreflight returns every whitelist binary as missing when which fails", async () => {
    const result = await binaryPreflight(() => ({ status: 1 }));

    assert.deepEqual(result.available, []);
    assert.deepEqual(result.missing, BINARY_WHITELIST);
});

test("buildContext adds repo metrics totalFiles and detects IaC types", async () => {
    const repoDir = createTempDir();

    fs.mkdirSync(path.join(repoDir, "kubernetes"), { recursive: true });
    fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });

    fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(repoDir, "Dockerfile"), "FROM node:20\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "main.tf"), "resource \"null_resource\" \"demo\" {}\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "kubernetes/deployment.yaml"), "apiVersion: apps/v1\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "template.yaml"), "AWSTemplateFormatVersion: '2010-09-09'\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "serverless.yml"), "service: demo\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "src/index.js"), "module.exports = {};\n", "utf8");

    const context = await buildContext({
        logger: createSilentLogger(),
        repo: "octo/demo",
        scope: "full",
        workspaceDir: repoDir
    });

    assert.equal(context.repoMetrics.totalFiles, 7);
    assert.deepEqual(context.iacTypes, [
        "cloudformation",
        "docker",
        "kubernetes",
        "serverless",
        "terraform"
    ]);
});
