"use strict";

const REQUIRED_HEADERS = [
    "# Resumen ejecutivo",
    "## Stack detectado",
    "## Estructura del proyecto",
    "## Observaciones técnicas",
    "## Riesgos y puntos de atención",
    "## Recomendaciones"
];

function createValidationError(message) {
    const error = new Error(message);
    error.exitCode = 4;
    return error;
}

function validateSkillResult(skillResult) {
    if (!skillResult || typeof skillResult !== "object") {
        throw createValidationError("El skill debe devolver un objeto");
    }

    if (typeof skillResult.rawReport !== "string" || skillResult.rawReport.trim().length === 0) {
        throw createValidationError("El skill no devolvió rawReport válido");
    }

    if (typeof skillResult.summary !== "string" || skillResult.summary.trim().length === 0) {
        throw createValidationError("El skill no devolvió summary válido");
    }

    if (!skillResult.metadata || typeof skillResult.metadata !== "object") {
        throw createValidationError("El skill no devolvió metadata válida");
    }
}

function validateReport(markdown) {
    if (typeof markdown !== "string") {
        throw createValidationError("El reporte final debe ser un string Markdown");
    }

    if (markdown.trim().length <= 200) {
        throw createValidationError("El reporte final debe superar 200 caracteres");
    }

    let lastIndex = -1;
    for (const header of REQUIRED_HEADERS) {
        const index = markdown.indexOf(header);
        if (index === -1) {
            throw createValidationError(`Falta encabezado requerido: ${header}`);
        }
        if (index <= lastIndex) {
            throw createValidationError("Los encabezados del reporte no respetan el orden canónico");
        }
        lastIndex = index;
    }

    for (let index = 0; index < REQUIRED_HEADERS.length; index += 1) {
        const start = markdown.indexOf(REQUIRED_HEADERS[index]);
        const end = index + 1 < REQUIRED_HEADERS.length
            ? markdown.indexOf(REQUIRED_HEADERS[index + 1])
            : markdown.length;
        const content = markdown.slice(start + REQUIRED_HEADERS[index].length, end).trim();
        if (!content) {
            throw createValidationError(`La sección ${REQUIRED_HEADERS[index]} no puede quedar vacía`);
        }
    }

    return true;
}

module.exports = {
    REQUIRED_HEADERS,
    validateReport,
    validateSkillResult
};