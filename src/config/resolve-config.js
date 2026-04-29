"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_MODEL = "deepseek-r1:8b";
const DEFAULT_PROVIDER = "ollama";
const DEFAULT_SCOPE = "full";
const DEFAULT_WORKSPACE_DIR = "./workspace";

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("cybersecurity.json debe contener un objeto JSON");
    }

    return parsed;
}

function resolveConfig(options = {}) {
    const cwd = options.cwd || process.cwd();
    const env = options.env || process.env;
    const flags = options.flags || {};
    const configFilePath = path.join(cwd, "cybersecurity.json");
    const fileConfig = readJsonFile(configFilePath) || {};

    const workspaceSetting = flags.output
        || env.CC_WORKSPACE_DIR
        || fileConfig.workspaceDir
        || DEFAULT_WORKSPACE_DIR;

    return {
        configFilePath,
        force: Boolean(flags.force),
        model: flags.model || env.CC_LLM_MODEL || fileConfig.llmModel || DEFAULT_MODEL,
        provider: flags.provider || env.CC_LLM_PROVIDER || fileConfig.llmProvider || DEFAULT_PROVIDER,
        scope: flags.scope || DEFAULT_SCOPE,
        workspaceDir: path.resolve(cwd, workspaceSetting)
    };
}

module.exports = {
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    DEFAULT_SCOPE,
    DEFAULT_WORKSPACE_DIR,
    resolveConfig
};