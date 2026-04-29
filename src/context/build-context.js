"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const IGNORED_DIRECTORIES = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo"
]);

const MANIFEST_TO_LANGUAGE = {
    "Cargo.toml": "Rust",
    "composer.json": "PHP",
    "go.mod": "Go",
    "package.json": "JavaScript/TypeScript",
    "pom.xml": "Java",
    "pyproject.toml": "Python",
    "requirements.txt": "Python"
};

const EXTENSION_TO_LANGUAGE = {
    ".c": "C",
    ".cpp": "C++",
    ".cs": "C#",
    ".go": "Go",
    ".java": "Java",
    ".js": "JavaScript/TypeScript",
    ".jsx": "JavaScript/TypeScript",
    ".kt": "Kotlin",
    ".mjs": "JavaScript/TypeScript",
    ".php": "PHP",
    ".py": "Python",
    ".rb": "Ruby",
    ".rs": "Rust",
    ".sh": "Shell",
    ".swift": "Swift",
    ".ts": "JavaScript/TypeScript",
    ".tsx": "JavaScript/TypeScript"
};

function defaultCommandRunner(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        encoding: "utf8",
        stdio: "pipe"
    });

    if (result.error || result.status !== 0) {
        return "";
    }

    return result.stdout.trim();
}

function walkFiles(rootDir) {
    const files = [];
    const queue = [rootDir];

    while (queue.length > 0) {
        const currentDir = queue.shift();
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const absolutePath = path.join(currentDir, entry.name);
            const relativePath = path.relative(rootDir, absolutePath);

            if (entry.isDirectory()) {
                if (IGNORED_DIRECTORIES.has(entry.name)) {
                    continue;
                }
                queue.push(absolutePath);
                continue;
            }

            files.push(relativePath);
        }
    }

    return files.sort();
}

function detectLanguages(files, manifests) {
    const languages = new Set();

    for (const manifest of manifests) {
        if (MANIFEST_TO_LANGUAGE[manifest]) {
            languages.add(MANIFEST_TO_LANGUAGE[manifest]);
        }
    }

    for (const file of files) {
        const extension = path.extname(file);
        if (EXTENSION_TO_LANGUAGE[extension]) {
            languages.add(EXTENSION_TO_LANGUAGE[extension]);
        }
    }

    return Array.from(languages);
}

function prioritizeFiles(files) {
    const ranked = files.map((filePath) => {
        let score = 0;

        if (/^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|Dockerfile)$/i.test(filePath)) {
            score += 100;
        }

        if (/(^|\/)(src|app|server|api|routes|controllers)\//i.test(filePath)) {
            score += 50;
        }

        if (/(index|main|server|app|auth|login|config)\./i.test(filePath)) {
            score += 25;
        }

        if (/^\.github\/workflows\//.test(filePath)) {
            score += 20;
        }

        return { filePath, score };
    });

    return ranked
        .sort((left, right) => right.score - left.score || left.filePath.localeCompare(right.filePath))
        .map((item) => item.filePath)
        .slice(0, 25);
}

function getChangedFiles(workspaceDir, commandRunner) {
    const candidates = [
        ["diff", "--name-only", "HEAD~1..HEAD"],
        ["diff", "--name-only", "--cached"],
        ["diff", "--name-only"]
    ];

    for (const args of candidates) {
        const output = commandRunner("git", args, { cwd: workspaceDir });
        if (output) {
            return output.split(/\r?\n/).filter(Boolean);
        }
    }

    return [];
}

function getGitInfo(workspaceDir, commandRunner) {
    const hasRepo = fs.existsSync(path.join(workspaceDir, ".git"));

    if (!hasRepo) {
        return { defaultBranch: null, hasRepo: false };
    }

    const symbolicRef = commandRunner("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], { cwd: workspaceDir });
    const branchFromRemote = symbolicRef.split("/").pop();
    const currentBranch = commandRunner("git", ["branch", "--show-current"], { cwd: workspaceDir });

    return {
        defaultBranch: branchFromRemote || currentBranch || null,
        hasRepo: true
    };
}

async function buildContext(options = {}) {
    const repo = options.repo;
    const scope = options.scope;
    const workspaceDir = options.workspaceDir;
    const commandRunner = options.commandRunner || defaultCommandRunner;

    const allFiles = walkFiles(workspaceDir);
    const manifests = allFiles.filter((filePath) => Object.prototype.hasOwnProperty.call(MANIFEST_TO_LANGUAGE, path.basename(filePath)));
    const topFiles = prioritizeFiles(allFiles);
    const changedFiles = scope === "diff" ? getChangedFiles(workspaceDir, commandRunner) : [];
    const filesInScope = scope === "diff"
        ? (changedFiles.length > 0 ? changedFiles : topFiles)
        : (scope === "quick" ? topFiles : allFiles);

    return {
        changedFiles,
        detectedLanguages: detectLanguages(allFiles, manifests),
        files: filesInScope,
        git: getGitInfo(workspaceDir, commandRunner),
        manifests,
        repo,
        scope,
        topFiles,
        workspaceDir
    };
}

module.exports = {
    buildContext,
    defaultCommandRunner
};