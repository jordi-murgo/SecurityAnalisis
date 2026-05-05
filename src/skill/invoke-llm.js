"use strict";

const { executeTool, getToolDefinitions } = require("./tools");

const MAX_TOOL_TURNS = 15;

function extractSummaryFromMarkdown(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    let seenExecutiveSummary = false;
    const summaryLines = [];

    for (const line of lines) {
        if (!seenExecutiveSummary) {
            if (line.trim() === "# Resumen ejecutivo") {
                seenExecutiveSummary = true;
            }
            continue;
        }
        if (line.startsWith("## ")) {
            break;
        }
        if (line.trim()) {
            summaryLines.push(line.trim());
        }
    }

    return summaryLines.join(" ").trim() || null;
}

async function ollamaPost(baseUrl, body) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`LLM request failed with status ${response.status}`);
    }
    const payload = await response.json();
    return payload && payload.message ? payload.message : { content: "", tool_calls: [] };
}

function parseToolArgs(raw) {
    if (typeof raw === "object" && raw !== null) return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function buildRuntimeUserPrompt(userPrompt, runtimeConfig = {}) {
    const binaryAvailability = runtimeConfig.binaryAvailability || { available: [], missing: [] };
    const lines = [String(userPrompt || "")];

    if (runtimeConfig.policyBlock) {
        lines.push("", runtimeConfig.policyBlock);
    }

    lines.push(
        "",
        "RUNTIME BINARY AVAILABILITY:",
        `Available binaries: ${(binaryAvailability.available || []).join(", ") || "none"}`,
        `Missing binaries: ${(binaryAvailability.missing || []).join(", ") || "none"}`
    );

    return lines.join("\n");
}

async function invokeLlm(options = {}) {
    const { provider, baseUrl, model, systemPrompt, userPrompt, workspaceDir, logger, runtimeConfig = {} } = options;

    if (provider !== "ollama") {
        throw new Error(`Provider no soportado en MVP: ${provider}`);
    }

    // Sandboxed roots: only the audited workspace is accessible via tools
    const allowedRoots = [workspaceDir].filter(Boolean);
    const toolDefinitions = getToolDefinitions(runtimeConfig);
    const effectiveSystemPrompt = runtimeConfig.policyBlock
        ? [String(systemPrompt || ""), "", runtimeConfig.policyBlock].join("\n")
        : systemPrompt;
    const effectiveUserPrompt = buildRuntimeUserPrompt(userPrompt, runtimeConfig);

    const messages = [
        { role: "system", content: effectiveSystemPrompt },
        { role: "user", content: effectiveUserPrompt }
    ];

    if (logger) {
        logger.info("Invocando Ollama con tool-calling", { baseUrl, model, tools: toolDefinitions.map((t) => t.function.name) });
    }

    let turns = 0;
    while (turns < MAX_TOOL_TURNS) {
        const message = await ollamaPost(baseUrl, {
            model,
            stream: false,
            messages,
            tools: toolDefinitions,
            options: { temperature: 0.1 }
        });

        const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

        if (toolCalls.length === 0) {
            // No more tool calls — this is the final report
            const rawReport = String(message.content || "").trim();
            if (logger) {
                logger.debug("Respuesta final recibida", { length: rawReport.length, turns });
            }
            return {
                rawReport,
                summary: extractSummaryFromMarkdown(rawReport)
            };
        }

        // Append assistant message with tool calls
        messages.push({ role: "assistant", content: message.content || "", tool_calls: toolCalls });

        // Execute each tool call and append results
        for (const call of toolCalls) {
            const name = call.function && call.function.name ? call.function.name : "";
            const args = parseToolArgs(call.function && call.function.arguments ? call.function.arguments : {});
            if (logger) {
                logger.info("Tool call", { tool: name, args });
            }
            const result = executeTool(name, args, allowedRoots, {
                ...runtimeConfig,
                cwd: workspaceDir
            });
            if (logger) {
                const preview = String(result).slice(0, 120).replace(/\n/g, "↵");
                logger.info("Tool result", { tool: name, preview });
            }
            messages.push({ role: "tool", content: String(result) });
        }

        turns++;
    }

    throw new Error(`LLM excedió el máximo de turns de herramientas (${MAX_TOOL_TURNS}).`);
}

module.exports = { invokeLlm };
