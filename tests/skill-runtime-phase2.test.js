"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { invokeLlm } = require("../src/skill/invoke-llm");
const { runCybersecuritySkill } = require("../src/skill/run-cybersecurity-skill");
const { executeTool, getToolDefinitions } = require("../src/skill/tools");
const { BINARY_WHITELIST, resolveToolset } = require("../src/skill/runtime-policy");

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "securityanalisis-phase2-"));
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

function createCapturingLogger() {
    const warnings = [];

    return {
        child() {
            return createCapturingLogger();
        },
        debug() { },
        error() { },
        info() { },
        warn(message, payload) {
            warnings.push({ message, payload });
        },
        warnings
    };
}

function createProjectContext(workspaceDir) {
    return {
        changedFiles: ["src/app.js"],
        detectedLanguages: ["JavaScript/TypeScript"],
        files: ["package.json", "src/app.js"],
        git: {
            defaultBranch: "main",
            hasRepo: true
        },
        iacTypes: ["terraform"],
        manifests: ["package.json"],
        repo: "octo/demo",
        repoMetrics: {
            totalFiles: 250
        },
        scope: "quick",
        topFiles: ["package.json", "src/app.js"],
        workspaceDir
    };
}

function createProjectContextWithOptions(workspaceDir, overrides = {}) {
    const base = createProjectContext(workspaceDir);
    return {
        ...base,
        ...overrides,
        repoMetrics: {
            ...base.repoMetrics,
            ...(overrides.repoMetrics || {})
        }
    };
}

function createCanonicalReport(agentNumber) {
    return [
        "# Resumen ejecutivo",
        "",
        `Hallazgos principales del agente ${agentNumber}.`,
        "",
        "## Stack detectado",
        `- Agente ${agentNumber}: JavaScript/TypeScript`,
        "",
        "## Estructura del proyecto",
        `- Agente ${agentNumber}: src/app.js`,
        "",
        "## Observaciones técnicas",
        `- Agente ${agentNumber}: observación técnica especializada.`,
        "",
        "## Riesgos y puntos de atención",
        `- Agente ${agentNumber}: riesgo detectado.`,
        "",
        "## Recomendaciones",
        `- Agente ${agentNumber}: remediación propuesta.`
    ].join("\n");
}

test("getToolDefinitions filters bash and sub-agent tools per runtime policy", () => {
    const readOnlyDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob"]
    });
    const orchestratedDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob", "bash", "sub-agents"]
    });

    assert.deepEqual(
        readOnlyDefinitions.map((tool) => tool.function.name),
        ["read_file", "grep", "glob"]
    );
    assert.deepEqual(
        orchestratedDefinitions.map((tool) => tool.function.name),
        ["read_file", "grep", "glob", "bash", "dispatch_sub_agent"]
    );
});

test("dispatch_sub_agent is exposed only for agents 1 and 5", () => {
    const agentOneDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob", "bash", "sub-agents"]
    });
    const agentTwoDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob", "bash"]
    });
    const agentFiveDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob", "bash", "sub-agents"]
    });
    const agentSevenDefinitions = getToolDefinitions({
        allowedTools: ["read", "grep", "glob"]
    });

    assert.ok(agentOneDefinitions.some((tool) => tool.function.name === "dispatch_sub_agent"));
    assert.ok(agentFiveDefinitions.some((tool) => tool.function.name === "dispatch_sub_agent"));
    assert.ok(agentTwoDefinitions.every((tool) => tool.function.name !== "dispatch_sub_agent"));
    assert.ok(agentSevenDefinitions.every((tool) => tool.function.name !== "dispatch_sub_agent"));
});

test("executeTool enforces the bash binary whitelist", () => {
    const workspaceDir = createTempDir();
    fs.writeFileSync(path.join(workspaceDir, "sample.txt"), "demo\n", "utf8");

    const allowedResult = executeTool("bash", { command: "ls ." }, [workspaceDir], {
        allowedBinaries: ["ls"],
        cwd: workspaceDir
    });
    const rejectedResult = executeTool("bash", { command: "ls . && rm -rf /" }, [workspaceDir], {
        allowedBinaries: ["ls"],
        cwd: workspaceDir
    });
    const rejectedBinary = executeTool("bash", { command: "rm -rf /" }, [workspaceDir], {
        allowedBinaries: ["ls"],
        cwd: workspaceDir
    });

    assert.match(allowedResult, /sample\.txt/);
    assert.match(rejectedResult, /binario no permitido/i);
    assert.match(rejectedBinary, /binario no permitido/i);
});

test("dispatch_sub_agent rejects agents outside the runtime policy", () => {
    const workspaceDir = createTempDir();

    const agentOneResult = executeTool("dispatch_sub_agent", { intent: "per-language", target: "JavaScript/TypeScript" }, [workspaceDir], {
        agentIndex: 0,
        fanout: true
    });
    const agentFiveResult = executeTool("dispatch_sub_agent", { intent: "per-iac", target: "terraform" }, [workspaceDir], {
        agentIndex: 4,
        fanout: true
    });
    const agentTwoResult = executeTool("dispatch_sub_agent", { intent: "unauthorized", target: "scope" }, [workspaceDir], {
        agentIndex: 1,
        fanout: true
    });
    const agentEightResult = executeTool("dispatch_sub_agent", { intent: "unauthorized", target: "scope" }, [workspaceDir], {
        agentIndex: 7,
        fanout: false
    });

    assert.match(agentOneResult, /agentIndex=0/);
    assert.match(agentFiveResult, /agentIndex=4/);
    assert.match(agentTwoResult, /solo está habilitado para los agentes 1 y 5/i);
    assert.match(agentEightResult, /solo está habilitado para los agentes 1 y 5/i);
});

test("invokeLlm forwards runtimeConfig policy and filtered tools", async () => {
    const workspaceDir = createTempDir();
    const originalFetch = global.fetch;
    const requests = [];

    global.fetch = async function fetchStub(url, options) {
        requests.push({
            body: JSON.parse(options.body),
            url
        });

        return {
            ok: true,
            async json() {
                return {
                    message: {
                        content: createCanonicalReport(1),
                        tool_calls: []
                    }
                };
            }
        };
    };

    try {
        const result = await invokeLlm({
            baseUrl: "http://localhost:11434",
            logger: createSilentLogger(),
            model: "demo-model",
            provider: "ollama",
            runtimeConfig: {
                agentIndex: 6,
                allowedTools: ["read", "grep", "glob"],
                binaryAvailability: {
                    available: ["git"],
                    missing: ["npm"]
                },
                policyBlock: "## Runtime Tool Policy (overrides TOOL RESTRICTION)\nAllowed tools: read, grep, glob"
            },
            systemPrompt: "SYSTEM BASE",
            userPrompt: "USER BASE",
            workspaceDir
        });

        assert.match(result.rawReport, /Hallazgos principales del agente 1/);
        assert.equal(requests.length, 1);
        assert.deepEqual(
            requests[0].body.tools.map((tool) => tool.function.name),
            ["read_file", "grep", "glob"]
        );
        assert.match(requests[0].body.messages[0].content, /Runtime Tool Policy/);
        assert.match(requests[0].body.messages[1].content, /Available binaries: git/);
        assert.match(requests[0].body.messages[1].content, /Missing binaries: npm/);
    } finally {
        global.fetch = originalFetch;
    }
});

test("runCybersecuritySkill coordinates eight agents and records binary availability metadata", async () => {
    const workspaceDir = createTempDir();
    const logger = createCapturingLogger();
    const projectContext = createProjectContext(workspaceDir);
    const calls = [];

    fs.mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(workspaceDir, "src/app.js"), "module.exports = {};\n", "utf8");

    const skillResult = await runCybersecuritySkill(projectContext, {
        binaryPreflight: async () => ({
            available: ["git", "grep", "ls"],
            missing: ["npm"]
        }),
        llmClient: async (options) => {
            calls.push(options);
            return {
                rawReport: createCanonicalReport(options.runtimeConfig.agentIndex + 1),
                summary: `Resumen agente ${options.runtimeConfig.agentIndex + 1}`
            };
        },
        llmBaseUrl: "http://unused",
        logger,
        model: "test-model",
        provider: "ollama"
    });

    assert.equal(calls.length, 8);
    assert.deepEqual(calls[0].runtimeConfig.allowedTools, ["read", "grep", "glob", "bash", "sub-agents"]);
    assert.deepEqual(calls[4].runtimeConfig.allowedTools, ["read", "grep", "glob", "bash", "sub-agents"]);
    assert.deepEqual(calls[6].runtimeConfig.allowedTools, ["read", "grep", "glob"]);
    assert.match(calls[0].runtimeConfig.policyBlock, /Allowed binaries:/);
    assert.match(calls[0].runtimeConfig.policyBlock, /Fanout: enabled/);
    assert.deepEqual(skillResult.metadata.binaryAvailability, {
        available: ["git", "grep", "ls"],
        missing: ["npm"]
    });
    assert.deepEqual(calls[0].runtimeConfig.binaryAvailability, {
        available: ["git", "grep", "ls"],
        missing: ["npm"]
    });
    assert.ok(skillResult.metadata.runtimeWarnings.some((warning) => /Missing binaries: npm/.test(warning)));
    assert.equal(skillResult.metadata.agentReports.length, 8);
    assert.equal(skillResult.findings.length, 0);
    assert.match(skillResult.rawReport, /Agente 1: observación técnica especializada/);
    assert.match(skillResult.rawReport, /Agente 8: remediación propuesta/);
    assert.ok(logger.warnings.some((entry) => /binarios faltantes/i.test(entry.message)));
});

test("runCybersecuritySkill completes without crashing when every whitelisted binary is missing", async () => {
    const workspaceDir = createTempDir();
    const projectContext = createProjectContextWithOptions(workspaceDir, {
        repoMetrics: { totalFiles: 100 }
    });

    fs.mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(workspaceDir, "src/app.js"), "module.exports = {};\n", "utf8");

    const skillResult = await runCybersecuritySkill(projectContext, {
        binaryPreflight: async () => ({ available: [], missing: BINARY_WHITELIST.slice() }),
        llmClient: async (options) => ({
            rawReport: createCanonicalReport(options.runtimeConfig.agentIndex + 1),
            summary: `Resumen agente ${options.runtimeConfig.agentIndex + 1}`
        }),
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    assert.deepEqual(skillResult.metadata.binaryAvailability, {
        available: [],
        missing: BINARY_WHITELIST
    });
    assert.ok(skillResult.metadata.runtimeWarnings.some((warning) => /Missing binaries: gh, git, find/.test(warning)));
    assert.equal(skillResult.metadata.agentReports.length, 8);
});

test("resolveToolset keeps agents 1 and 5 privileged while agents 7 and 8 stay read-only", () => {
    assert.equal(resolveToolset(0, { totalFiles: 50 }).bash, true);
    assert.equal(resolveToolset(0, { totalFiles: 50 }).subAgents, true);
    assert.equal(resolveToolset(4, { totalFiles: 50 }).bash, true);
    assert.equal(resolveToolset(4, { totalFiles: 50 }).subAgents, true);
    assert.equal(resolveToolset(6, { totalFiles: 50 }).bash, false);
    assert.equal(resolveToolset(6, { totalFiles: 50 }).subAgents, false);
    assert.equal(resolveToolset(7, { totalFiles: 50 }).bash, false);
    assert.equal(resolveToolset(7, { totalFiles: 50 }).subAgents, false);
});

test("runCybersecuritySkill fans out agent 1 per detected language on large repos", async () => {
    const workspaceDir = createTempDir();
    const projectContext = createProjectContextWithOptions(workspaceDir, {
        detectedLanguages: ["JavaScript/TypeScript", "Python"],
        iacTypes: ["terraform"]
    });
    const calls = [];

    fs.mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(workspaceDir, "src/app.js"), "module.exports = {};\n", "utf8");

    const skillResult = await runCybersecuritySkill(projectContext, {
        binaryPreflight: async () => ({ available: ["git"], missing: [] }),
        llmClient: async (options) => {
            calls.push(options);
            const target = options.runtimeConfig.subTarget || `agent-${options.runtimeConfig.agentIndex + 1}`;
            return {
                rawReport: createCanonicalReport(target),
                summary: `Resumen ${target}`
            };
        },
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    const agentOneCalls = calls.filter((entry) => entry.runtimeConfig.agentIndex === 0);

    assert.equal(agentOneCalls.length, 2);
    assert.deepEqual(
        agentOneCalls.map((entry) => entry.runtimeConfig.subTarget),
        ["JavaScript/TypeScript", "Python"]
    );
    assert.ok(agentOneCalls.every((entry) => entry.runtimeConfig.fanout === true));
    assert.ok(agentOneCalls.every((entry) => entry.runtimeConfig.allowedTools.includes("bash")));
    assert.ok(agentOneCalls.every((entry) => entry.runtimeConfig.allowedTools.includes("sub-agents")));
    assert.ok(agentOneCalls.every((entry) => entry.runtimeConfig.allowedBinaries.includes("git")));
    assert.ok(agentOneCalls.every((entry) => entry.userPrompt.includes("Focus exclusively on JavaScript/TypeScript files.") || entry.userPrompt.includes("Focus exclusively on Python files.")));
    assert.equal(skillResult.metadata.agentReports.length, 8);
    assert.match(skillResult.metadata.agentReports[0].summary, /JavaScript\/TypeScript/);
    assert.match(skillResult.metadata.agentReports[0].summary, /Python/);
    assert.match(skillResult.rawReport, /Agente JavaScript\/TypeScript: observación técnica especializada\./);
    assert.match(skillResult.rawReport, /Agente Python: observación técnica especializada\./);
});

test("runCybersecuritySkill fans out agent 5 per IaC type on large repos", async () => {
    const workspaceDir = createTempDir();
    const projectContext = createProjectContextWithOptions(workspaceDir, {
        detectedLanguages: ["JavaScript/TypeScript"],
        iacTypes: ["docker", "terraform"]
    });
    const calls = [];

    fs.mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(workspaceDir, "src/app.js"), "module.exports = {};\n", "utf8");

    const skillResult = await runCybersecuritySkill(projectContext, {
        binaryPreflight: async () => ({ available: ["git"], missing: [] }),
        llmClient: async (options) => {
            calls.push(options);
            const target = options.runtimeConfig.subTarget || `agent-${options.runtimeConfig.agentIndex + 1}`;
            return {
                rawReport: createCanonicalReport(target),
                summary: `Resumen ${target}`
            };
        },
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    const agentFiveCalls = calls.filter((entry) => entry.runtimeConfig.agentIndex === 4);

    assert.equal(agentFiveCalls.length, 2);
    assert.deepEqual(
        agentFiveCalls.map((entry) => entry.runtimeConfig.subTarget),
        ["docker", "terraform"]
    );
    assert.ok(agentFiveCalls.every((entry) => entry.runtimeConfig.fanout === true));
    assert.ok(agentFiveCalls.every((entry) => entry.runtimeConfig.allowedTools.includes("bash")));
    assert.ok(agentFiveCalls.every((entry) => entry.runtimeConfig.allowedTools.includes("sub-agents")));
    assert.ok(agentFiveCalls.every((entry) => entry.runtimeConfig.allowedBinaries.includes("git")));
    assert.ok(agentFiveCalls.every((entry) => entry.userPrompt.includes("Focus exclusively on docker files.") || entry.userPrompt.includes("Focus exclusively on terraform files.")));
    assert.equal(skillResult.metadata.agentReports.length, 8);
    assert.match(skillResult.metadata.agentReports[4].summary, /docker/);
    assert.match(skillResult.metadata.agentReports[4].summary, /terraform/);
    assert.match(skillResult.rawReport, /Agente docker: observación técnica especializada\./);
    assert.match(skillResult.rawReport, /Agente terraform: observación técnica especializada\./);
});

test("runCybersecuritySkill keeps agent 1 as a single agent when fanout threshold is not exceeded", async () => {
    const workspaceDir = createTempDir();
    const projectContext = createProjectContextWithOptions(workspaceDir, {
        detectedLanguages: ["JavaScript/TypeScript", "Python"],
        repoMetrics: {
            totalFiles: 200
        }
    });
    const calls = [];

    fs.mkdirSync(path.join(workspaceDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspaceDir, "package.json"), JSON.stringify({ name: "demo" }), "utf8");
    fs.writeFileSync(path.join(workspaceDir, "src/app.js"), "module.exports = {};\n", "utf8");

    const skillResult = await runCybersecuritySkill(projectContext, {
        binaryPreflight: async () => ({ available: ["git"], missing: [] }),
        llmClient: async (options) => {
            calls.push(options);
            return {
                rawReport: createCanonicalReport(options.runtimeConfig.agentIndex + 1),
                summary: `Resumen agente ${options.runtimeConfig.agentIndex + 1}`
            };
        },
        llmBaseUrl: "http://unused",
        logger: createSilentLogger(),
        model: "test-model",
        provider: "ollama"
    });

    const agentOneCalls = calls.filter((entry) => entry.runtimeConfig.agentIndex === 0);

    assert.equal(agentOneCalls.length, 1);
    assert.equal(agentOneCalls[0].runtimeConfig.subTarget, null);
    assert.equal(agentOneCalls[0].runtimeConfig.fanout, false);
    assert.equal(skillResult.metadata.agentReports.length, 8);
});
