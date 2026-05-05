"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function isValidOwnerRepo(value) {
    return typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value);
}

function defaultCommandRunner(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        encoding: "utf8",
        stdio: options.stdio || "pipe"
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        const message = result.stderr || result.stdout || `${command} failed`;
        const error = new Error(message.trim());
        error.status = result.status;
        throw error;
    }

    return result.stdout || "";
}

async function acquireRepo(options = {}) {
    const ownerRepo = options.ownerRepo;
    const outputDir = options.outputDir;
    const force = Boolean(options.force);
    const commandRunner = options.commandRunner || defaultCommandRunner;
    const logger = options.logger;

    if (logger) {
        logger.info("Preparando adquisición de repositorio", { force, outputDir, ownerRepo });
    }

    if (!isValidOwnerRepo(ownerRepo)) {
        const error = new Error("owner/repo inválido");
        error.exitCode = 2;
        throw error;
    }

    const repoName = ownerRepo.split("/")[1];
    const workspaceDir = path.join(outputDir, repoName);

    fs.mkdirSync(outputDir, { recursive: true });

    if (fs.existsSync(workspaceDir)) {
        if (!force) {
            if (logger) {
                logger.info("Reutilizando workspace existente", { workspaceDir });
            }
            return { repoName, reused: true, workspaceDir };
        }

        if (logger) {
            logger.warn("Eliminando workspace existente por --force", { workspaceDir });
        }
        fs.rmSync(workspaceDir, { force: true, recursive: true });
    }

    try {
        if (logger) {
            logger.info("Clonando repositorio con gh", { ownerRepo, workspaceDir });
        }
        commandRunner("gh", ["repo", "clone", ownerRepo, workspaceDir], { cwd: outputDir, stdio: "pipe" });
    } catch (error) {
        if (logger) {
            logger.error("Fallo durante gh repo clone", { message: error.message });
        }
        const cloneError = new Error("Error: gh clone failed. Ensure GitHub CLI is installed and authenticated.");
        cloneError.exitCode = 3;
        cloneError.cause = error;
        throw cloneError;
    }

    if (logger) {
        logger.info("Repositorio clonado correctamente", { workspaceDir });
    }

    return { repoName, reused: false, workspaceDir };
}

module.exports = {
    acquireRepo,
    defaultCommandRunner,
    isValidOwnerRepo
};