"use strict";

const VALID_SCOPES = new Set(["full", "quick", "diff"]);

const USAGE = [
    "Usage:",
    "  cybersecurity owner/repo [--scope full|quick|diff] [--model <model-id>] [--provider <provider-id>] [--force] [--output <dir>]",
    "",
    "Options:",
    "  --scope     full|quick|diff (default: full)",
    "  --model     model identifier (overrides env/config)",
    "  --provider  provider identifier (overrides env/config)",
    "  --force     reclone even if workspace exists",
    "  --output    workspace root directory (default: ./workspace)",
    "  --help, -h  show help"
].join("\n");

function parseArgs(argv) {
    const tokens = Array.isArray(argv) ? argv.slice(2) : [];
    const flags = {};
    let ownerRepo = null;

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];

        if (token === "--help" || token === "-h") {
            return { help: true, flags };
        }

        if (!token.startsWith("--")) {
            if (ownerRepo) {
                return { error: `Unexpected argument: ${token}` };
            }
            ownerRepo = token;
            continue;
        }

        if (token === "--force") {
            flags.force = true;
            continue;
        }

        const nextValue = tokens[index + 1];
        if (typeof nextValue !== "string" || nextValue.startsWith("--")) {
            return { error: `Missing value for ${token}` };
        }

        if (token === "--scope") {
            flags.scope = nextValue;
            index += 1;
            continue;
        }

        if (token === "--model") {
            flags.model = nextValue;
            index += 1;
            continue;
        }

        if (token === "--provider") {
            flags.provider = nextValue;
            index += 1;
            continue;
        }

        if (token === "--output") {
            flags.output = nextValue;
            index += 1;
            continue;
        }

        return { error: `Unknown flag: ${token}` };
    }

    return { ownerRepo, flags, help: false };
}

function formatUsage() {
    return USAGE;
}

function isValidScope(scope) {
    return VALID_SCOPES.has(scope);
}

module.exports = {
    formatUsage,
    isValidScope,
    parseArgs,
    VALID_SCOPES
};