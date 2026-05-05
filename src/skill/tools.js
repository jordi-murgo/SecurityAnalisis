"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MAX_FILE_BYTES = 32 * 1024;
const MAX_GREP_LINES = 100;
const MAX_GLOB_RESULTS = 100;
const GREP_FILE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json", ".yml", ".yaml", ".env", ".tf", ".tfvars", ""]);

// Resolve a relative path safely within allowed roots. Throws if it escapes.
function resolveSafe(relativePath, allowedRoots) {
    const normalized = path.normalize(relativePath.replace(/^\/+/, ""));
    for (const root of allowedRoots) {
        const base = path.resolve(root);
        const resolved = path.resolve(base, normalized);
        if (resolved === base || resolved.startsWith(base + path.sep)) {
            return resolved;
        }
    }
    throw new Error(`Acceso denegado: '${relativePath}' no pertenece a ninguna raíz permitida.`);
}

function walkFiles(rootDir) {
    const entries = [];
    const queue = [rootDir];

    while (queue.length > 0) {
        const currentDir = queue.shift();
        const children = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const child of children) {
            const absolutePath = path.join(currentDir, child.name);
            if (child.isDirectory()) {
                queue.push(absolutePath);
                continue;
            }

            entries.push(absolutePath);
        }
    }

    return entries;
}

function escapeRegExp(value) {
    return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function globToRegExp(pattern) {
    const normalizedPattern = String(pattern || "**/*").replace(/\\/g, "/");
    let source = "^";

    for (let index = 0; index < normalizedPattern.length; index += 1) {
        const current = normalizedPattern[index];
        const next = normalizedPattern[index + 1];

        if (current === "*" && next === "*") {
            source += ".*";
            index += 1;
            continue;
        }

        if (current === "*") {
            source += "[^/]*";
            continue;
        }

        if (current === "?") {
            source += ".";
            continue;
        }

        source += escapeRegExp(current);
    }

    source += "$";
    return new RegExp(source);
}

function collectFilesWithinPath(searchRoot) {
    const stats = fs.statSync(searchRoot);
    if (!stats.isDirectory()) {
        return [searchRoot];
    }

    return walkFiles(searchRoot);
}

function execReadFile(args, allowedRoots) {
    const filePath = String(args.path || "");
    if (!filePath) return "Error: se requiere el argumento 'path'.";
    let resolved;
    try {
        resolved = resolveSafe(filePath, allowedRoots);
    } catch (err) {
        return `Error: ${err.message}`;
    }
    try {
        const content = fs.readFileSync(resolved, "utf8");
        return content.length > MAX_FILE_BYTES
            ? content.slice(0, MAX_FILE_BYTES) + `\n\n[truncated — ${content.length - MAX_FILE_BYTES} bytes omitted]`
            : content;
    } catch (err) {
        return `Error leyendo archivo: ${err.message}`;
    }
}

function execListFiles(args, allowedRoots) {
    const dirPath = String(args.path || ".");
    let resolved;
    try {
        resolved = resolveSafe(dirPath, allowedRoots);
    } catch (err) {
        return `Error: ${err.message}`;
    }
    try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        if (entries.length === 0) return "(directorio vacío)";
        return entries
            .map((entry) => `${entry.isDirectory() ? "DIR" : "FILE"} ${entry.name}`)
            .join("\n");
    } catch (err) {
        return `Error listando directorio: ${err.message}`;
    }
}

function execGlob(args, allowedRoots) {
    const pattern = String(args.pattern || "**/*");
    const searchPath = String(args.path || ".");
    let resolved;

    try {
        resolved = resolveSafe(searchPath, allowedRoots);
    } catch (err) {
        return `Error: ${err.message}`;
    }

    try {
        const matcher = globToRegExp(pattern);
        const files = collectFilesWithinPath(resolved)
            .map((absolutePath) => path.relative(resolved, absolutePath).replace(/\\/g, "/"))
            .filter((relativePath) => matcher.test(relativePath))
            .sort()
            .slice(0, MAX_GLOB_RESULTS);

        return files.length > 0 ? files.join("\n") : "(sin resultados)";
    } catch (err) {
        return `Error ejecutando glob: ${err.message}`;
    }
}

function execGrep(args, allowedRoots) {
    const pattern = String(args.pattern || "");
    if (!pattern) return "Error: se requiere el argumento 'pattern'.";
    const searchPath = String(args.path || ".");
    let resolved;
    try {
        resolved = resolveSafe(searchPath, allowedRoots);
    } catch (err) {
        return `Error: ${err.message}`;
    }

    try {
        const regex = new RegExp(pattern, "i");
        const matches = [];
        const candidateFiles = collectFilesWithinPath(resolved);

        for (const absolutePath of candidateFiles) {
            const relativeToSearchRoot = path.relative(resolved, absolutePath).replace(/\\/g, "/");
            const extension = path.extname(absolutePath);
            const baseName = path.basename(absolutePath);

            if (!GREP_FILE_EXTENSIONS.has(extension) && !baseName.startsWith(".env")) {
                continue;
            }

            const content = fs.readFileSync(absolutePath, "utf8");
            const lines = content.split(/\r?\n/);

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                if (!regex.test(lines[lineIndex])) {
                    continue;
                }

                matches.push(`${relativeToSearchRoot}:${lineIndex + 1}:${lines[lineIndex]}`);
                if (matches.length >= MAX_GREP_LINES) {
                    return matches.join("\n");
                }
            }
        }

        return matches.length > 0 ? matches.join("\n") : "(sin resultados)";
    } catch (err) {
        return `Error ejecutando grep: ${err.message}`;
    }
}

function getCommandSegments(command) {
    return String(command || "")
        .split(/&&|\|\||;|\|/)
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function getCommandBinary(commandSegment) {
    const match = commandSegment.match(/^([A-Za-z0-9._-]+)/);
    return match ? match[1] : null;
}

function execBash(args, allowedRoots, runtimeConfig = {}) {
    const command = String(args.command || "").trim();
    if (!command) {
        return "Error: se requiere el argumento 'command'.";
    }

    const allowedBinaries = Array.isArray(runtimeConfig.allowedBinaries)
        ? runtimeConfig.allowedBinaries
        : [];
    const segments = getCommandSegments(command);

    if (segments.length === 0) {
        return "Error: comando vacío.";
    }

    for (const segment of segments) {
        const binary = getCommandBinary(segment);
        if (!binary || !allowedBinaries.includes(binary)) {
            return `Error: binario no permitido en bash: ${binary || "desconocido"}.`;
        }
    }

    const cwd = runtimeConfig.cwd || allowedRoots[0] || process.cwd();
    const result = spawnSync("/bin/sh", ["-c", command], {
        cwd,
        encoding: "utf8",
        timeout: 8000,
        stdio: "pipe"
    });

    if (result.error) {
        return `Error ejecutando bash: ${result.error.message}`;
    }

    const stdout = String(result.stdout || "").trim();
    const stderr = String(result.stderr || "").trim();

    if (result.status !== 0) {
        return `Error ejecutando bash: ${stderr || stdout || `exit ${result.status}`}`;
    }

    return stdout || stderr || "(sin salida)";
}

function execDispatchSubAgent(args, allowedRoots, runtimeConfig = {}) {
    const allowedAgentIndexes = new Set([0, 4]);
    const agentIndex = Number.isInteger(runtimeConfig.agentIndex) ? runtimeConfig.agentIndex : -1;

    if (!allowedAgentIndexes.has(agentIndex)) {
        return "Error: dispatch_sub_agent solo está habilitado para los agentes 1 y 5.";
    }

    const fanoutEnabled = Boolean(runtimeConfig.fanout);
    const intent = String(args.intent || "analysis");
    const target = String(args.target || "scope");
    const workspaceRoot = allowedRoots[0] || runtimeConfig.cwd || process.cwd();

    return [
        "Sub-agent dispatch placeholder registered.",
        `agentIndex=${agentIndex}`,
        `intent=${intent}`,
        `target=${target}`,
        `fanout=${fanoutEnabled ? "enabled" : "disabled"}`,
        `workspace=${workspaceRoot}`
    ].join("\n");
}

function executeTool(name, args, allowedRoots, runtimeConfig = {}) {
    switch (name) {
        case "read_file": return execReadFile(args, allowedRoots);
        case "list_files": return execListFiles(args, allowedRoots);
        case "glob": return execGlob(args, allowedRoots);
        case "grep": return execGrep(args, allowedRoots);
        case "bash": return execBash(args, allowedRoots, runtimeConfig);
        case "dispatch_sub_agent": return execDispatchSubAgent(args, allowedRoots, runtimeConfig);
        default: return `Error: herramienta desconocida '${name}'.`;
    }
}

const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Lee el contenido de un archivo del repositorio auditado.",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "Ruta relativa al archivo desde la raíz del workspace."
                    }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "grep",
            description: "Busca un patrón en los archivos del workspace.",
            parameters: {
                type: "object",
                properties: {
                    pattern: {
                        type: "string",
                        description: "Patrón (regex o string) a buscar."
                    },
                    path: {
                        type: "string",
                        description: "Ruta relativa donde buscar. Por defecto: raíz del workspace."
                    }
                },
                required: ["pattern"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "glob",
            description: "Busca archivos del workspace usando un patrón glob.",
            parameters: {
                type: "object",
                properties: {
                    pattern: {
                        type: "string",
                        description: "Patrón glob relativo al path base. Ej: **/*.js"
                    },
                    path: {
                        type: "string",
                        description: "Ruta relativa al directorio base. Por defecto: raíz del workspace."
                    }
                },
                required: ["pattern"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "bash",
            description: "Ejecuta un comando bash con binarios explícitamente permitidos por el runner.",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "Comando shell que debe comenzar con un binario permitido por el runner."
                    }
                },
                required: ["command"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "dispatch_sub_agent",
            description: "Solicita fanout controlado del runner para tareas especializadas cuando la política lo habilita.",
            parameters: {
                type: "object",
                properties: {
                    intent: {
                        type: "string",
                        description: "Objetivo del sub-agente. Ej: per-language scan"
                    },
                    target: {
                        type: "string",
                        description: "Sub-scope o categoría a delegar."
                    }
                },
                required: []
            }
        }
    }
];

function getToolDefinitions(runtimeConfig = {}) {
    const allowedTools = Array.isArray(runtimeConfig.allowedTools) && runtimeConfig.allowedTools.length > 0
        ? runtimeConfig.allowedTools
        : ["read", "grep", "glob", "bash"];
    const allowed = new Set(allowedTools);

    return TOOL_DEFINITIONS.filter((tool) => {
        switch (tool.function.name) {
            case "read_file":
                return allowed.has("read");
            case "grep":
                return allowed.has("grep");
            case "glob":
                return allowed.has("glob");
            case "bash":
                return allowed.has("bash");
            case "dispatch_sub_agent":
                return allowed.has("sub-agents");
            default:
                return false;
        }
    });
}

module.exports = { TOOL_DEFINITIONS, executeTool, getToolDefinitions };
