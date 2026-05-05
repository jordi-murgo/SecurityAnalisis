"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_MODEL = "deepseek-v4-flash:cloud";
const DEFAULT_PROVIDER = "ollama";
const DEFAULT_SCOPE = "full";
const DEFAULT_WORKSPACE_DIR = "./workspace";
const DEFAULT_LLM_BASE_URL = "http://127.0.0.1:11434";

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
    const logger = options.logger;
    const configFilePath = path.join(cwd, "cybersecurity.json");
    const fileConfig = readJsonFile(configFilePath) || {};

    if (logger) {
        logger.debug("Resolviendo configuración", { configFilePath, cwd, flags });
    }

    const workspaceSetting = flags.output
        || env.CC_WORKSPACE_DIR
        || fileConfig.workspaceDir
        || DEFAULT_WORKSPACE_DIR;

    const resolvedConfig = {
        configFilePath,
        force: Boolean(flags.force),
        llmBaseUrl: env.CC_LLM_BASE_URL || fileConfig.llmBaseUrl || DEFAULT_LLM_BASE_URL,
        model: flags.model || env.CC_LLM_MODEL || fileConfig.llmModel || DEFAULT_MODEL,
        provider: flags.provider || env.CC_LLM_PROVIDER || fileConfig.llmProvider || DEFAULT_PROVIDER,
        scope: flags.scope || DEFAULT_SCOPE,
        workspaceDir: path.resolve(cwd, workspaceSetting)
    };

    if (logger) {
        logger.info("Configuración resuelta", {
            configFilePath,
            llmBaseUrl: resolvedConfig.llmBaseUrl,
            model: resolvedConfig.model,
            provider: resolvedConfig.provider,
            scope: resolvedConfig.scope,
            workspaceDir: resolvedConfig.workspaceDir
        });
    }

    return resolvedConfig;
}

module.exports = {
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    DEFAULT_SCOPE,
    DEFAULT_LLM_BASE_URL,
    DEFAULT_WORKSPACE_DIR,
    resolveConfig
};