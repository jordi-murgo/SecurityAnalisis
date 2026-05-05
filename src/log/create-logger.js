"use strict";

const LEVELS = {
    silent: 100,
    error: 40,
    warn: 30,
    info: 20,
    debug: 10
};

function normalizeLevel(level) {
    return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : "info";
}

function createLogger(options = {}) {
    const level = normalizeLevel(options.level || "info");
    const stream = options.stream || process.stderr;
    const scope = options.scope || "app";

    function shouldLog(targetLevel) {
        return LEVELS[targetLevel] >= LEVELS[level] && level !== "silent";
    }

    function emit(targetLevel, message, metadata) {
        if (!shouldLog(targetLevel)) {
            return;
        }

        const prefix = `[${targetLevel.toUpperCase()}][${scope}]`;
        const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
        stream.write(`${prefix} ${message}${suffix}\n`);
    }

    return {
        child(childScope) {
            return createLogger({
                level,
                scope: `${scope}:${childScope}`,
                stream
            });
        },
        debug(message, metadata) {
            emit("debug", message, metadata);
        },
        error(message, metadata) {
            emit("error", message, metadata);
        },
        info(message, metadata) {
            emit("info", message, metadata);
        },
        warn(message, metadata) {
            emit("warn", message, metadata);
        }
    };
}

module.exports = {
    createLogger
};