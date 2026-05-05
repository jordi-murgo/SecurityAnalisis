"use strict";

const { spawnSync } = require("child_process");

const FANOUT_THRESHOLD = 200;

const BINARY_WHITELIST = [
    "gh",
    "git",
    "find",
    "grep",
    "ls",
    "npm",
    "pip",
    "cargo",
    "yarn",
    "pnpm",
    "strings",
    "file",
    "wc",
    "cat",
    "head",
    "tail",
    "sort",
    "uniq"
];

const AGENT_TOOLSETS = [
    { read: true, grep: true, glob: true, bash: true, subAgents: true },
    { read: true, grep: true, glob: true, bash: true, subAgents: false },
    { read: true, grep: true, glob: true, bash: true, subAgents: false },
    { read: true, grep: true, glob: true, bash: true, subAgents: false },
    { read: true, grep: true, glob: true, bash: true, subAgents: true },
    { read: true, grep: true, glob: true, bash: true, subAgents: false },
    { read: true, grep: true, glob: true, bash: false, subAgents: false },
    { read: true, grep: true, glob: true, bash: false, subAgents: false }
];

function getAgentToolset(agentIndex) {
    const toolset = AGENT_TOOLSETS[agentIndex];

    if (!toolset) {
        throw new Error(`Invalid agent index: ${agentIndex}`);
    }

    return toolset;
}

function shouldFanout(repoMetrics = {}) {
    return Number(repoMetrics.totalFiles || 0) > FANOUT_THRESHOLD;
}

function resolveToolset(agentIndex, repoMetrics = {}) {
    const toolset = getAgentToolset(agentIndex);

    return {
        ...toolset,
        binaries: toolset.bash ? BINARY_WHITELIST.slice() : [],
        fanout: shouldFanout(repoMetrics)
    };
}

function buildPolicyPrompt(agentIndex, repoMetrics = {}) {
    const toolset = resolveToolset(agentIndex, repoMetrics);
    const allowedTools = ["read", "grep", "glob"];

    if (toolset.bash) {
        allowedTools.push("bash");
    }

    if (toolset.subAgents) {
        allowedTools.push("sub-agents");
    }

    return [
        "## Runtime Tool Policy (overrides TOOL RESTRICTION)",
        `Allowed tools: ${allowedTools.join(", ")}`,
        `Allowed binaries: ${toolset.binaries.length > 0 ? toolset.binaries.join(", ") : "none — read-only agent"}`,
        `Fanout: ${toolset.fanout ? "enabled" : "disabled"}`
    ].join("\n");
}

function defaultWhichRunner(binary) {
    return spawnSync("which", [binary], {
        encoding: "utf8",
        stdio: "pipe"
    });
}

async function binaryPreflight(whichRunner = defaultWhichRunner) {
    const available = [];
    const missing = [];

    for (const binary of BINARY_WHITELIST) {
        const result = whichRunner(binary);

        if (result.status === 0) {
            available.push(binary);
            continue;
        }

        missing.push(binary);
    }

    return { available, missing };
}

module.exports = {
    AGENT_TOOLSETS,
    BINARY_WHITELIST,
    FANOUT_THRESHOLD,
    binaryPreflight,
    buildPolicyPrompt,
    resolveToolset,
    shouldFanout
};
