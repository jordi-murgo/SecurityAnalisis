"use strict";

const fs = require("fs");

const { createLogger } = require("../log/create-logger");

const { formatUsage, isValidScope, parseArgs } = require("./parse-args");
const { resolveConfig } = require("../config/resolve-config");
const { acquireRepo, isValidOwnerRepo } = require("../repo/acquire-repo");
const { buildContext } = require("../context/build-context");
const { runCybersecuritySkill } = require("../skill/run-cybersecurity-skill");
const { normalizeReport } = require("../report/normalize-report");
const { validateReport, validateSkillResult } = require("../report/validate-report");
const { writeReport } = require("../report/write-report");

function createCliError(exitCode, message) {
    const error = new Error(message);
    error.exitCode = exitCode;
    return error;
}

function writeLine(stream, message) {
    stream.write(`${message}\n`);
}

function ensureWritableDirectory(targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.accessSync(targetDir, fs.constants.W_OK);
}

async function runCli(argv, options = {}) {
    const stdout = options.stdout || process.stdout;
    const stderr = options.stderr || process.stderr;
    const env = options.env || process.env;
    const cwd = options.cwd || process.cwd();
    const services = options.services || {};
    const logger = options.logger || createLogger({
        level: env.CC_LOG_LEVEL || "info",
        scope: "cli",
        stream: stderr
    });

    logger.info("Iniciando ejecución del CLI", { cwd });

    const parsed = parseArgs(argv, logger.child("args"));

    if (parsed.help) {
        writeLine(stdout, formatUsage());
        return { exitCode: 0 };
    }

    if (parsed.error) {
        writeLine(stderr, parsed.error);
        writeLine(stderr, formatUsage());
        return { exitCode: 2 };
    }

    const config = (services.resolveConfig || resolveConfig)({
        cwd,
        env,
        flags: parsed.flags,
        logger: logger.child("config")
    });

    if (!parsed.ownerRepo || !isValidOwnerRepo(parsed.ownerRepo)) {
        writeLine(stderr, "Error: owner/repo inválido");
        return { exitCode: 2 };
    }

    if (!isValidScope(config.scope)) {
        writeLine(stderr, `Error: scope inválido: ${config.scope}`);
        return { exitCode: 2 };
    }

    try {
        ensureWritableDirectory(config.workspaceDir);
    } catch (error) {
        throw createCliError(5, `Error: output no escribible: ${config.workspaceDir}`);
    }

    let repoState;
    try {
        repoState = await (services.acquireRepo || acquireRepo)({
            force: config.force,
            logger: logger.child("repo"),
            outputDir: config.workspaceDir,
            ownerRepo: parsed.ownerRepo
        });
    } catch (error) {
        if (error && Number.isInteger(error.exitCode)) {
            throw error;
        }
        throw createCliError(3, error && error.message ? error.message : "Error al clonar el repositorio");
    }

    const projectContext = await (services.buildContext || buildContext)({
        logger: logger.child("context"),
        repo: parsed.ownerRepo,
        scope: config.scope,
        workspaceDir: repoState.workspaceDir
    });

    let skillResult;
    try {
        skillResult = await (services.runCybersecuritySkill || runCybersecuritySkill)(projectContext, {
            llmBaseUrl: config.llmBaseUrl,
            llmClient: services.llmClient,
            logger: logger.child("skill"),
            model: config.model,
            provider: config.provider
        });
        validateSkillResult(skillResult, logger.child("validate-skill"));
    } catch (error) {
        if (error && Number.isInteger(error.exitCode)) {
            throw error;
        }
        throw createCliError(4, error && error.message ? error.message : "Error: salida inválida del skill");
    }

    const normalizedReport = (services.normalizeReport || normalizeReport)({
        logger: logger.child("report-normalize"),
        projectContext,
        skillResult
    });
    validateReport(normalizedReport.markdown, logger.child("report-validate"));

    const written = await (services.writeReport || writeReport)({
        logger: logger.child("report-write"),
        markdown: normalizedReport.markdown,
        workspaceDir: repoState.workspaceDir
    });

    logger.info("CLI finalizado correctamente", { htmlPath: written.htmlPath, markdownPath: written.markdownPath });

    writeLine(stdout, written.markdownPath);
    writeLine(stdout, written.htmlPath);

    return {
        config,
        exitCode: 0,
        projectContext,
        repoState,
        skillResult,
        written
    };
}

module.exports = {
    createCliError,
    runCli
};