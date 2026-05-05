"use strict";

function normalizeReport({ projectContext, skillResult, logger }) {
    if (logger) {
        logger.info("Normalizando reporte final", {
            reportLength: String(skillResult.rawReport || "").trim().length,
            repo: projectContext.repo
        });
    }
    return {
        markdown: String(skillResult.rawReport || "").trim()
    };
}

module.exports = {
    normalizeReport
};