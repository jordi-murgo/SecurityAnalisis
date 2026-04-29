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
            return { repoName, reused: true, workspaceDir };
        }

        fs.rmSync(workspaceDir, { force: true, recursive: true });
    }

    try {
        commandRunner("gh", ["repo", "clone", ownerRepo, workspaceDir], { cwd: outputDir, stdio: "pipe" });
    } catch (error) {
        const cloneError = new Error("Error: gh clone failed. Ensure GitHub CLI is installed and authenticated.");
        cloneError.exitCode = 3;
        cloneError.cause = error;
        throw cloneError;
    }

    return { repoName, reused: false, workspaceDir };
}

module.exports = {
    acquireRepo,
    defaultCommandRunner,
    isValidOwnerRepo
};