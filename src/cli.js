#!/usr/bin/env node
"use strict";

const { runCli } = require("./cli/run-cli");

runCli(process.argv, {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    cwd: process.cwd()
}).then(({ exitCode }) => {
    process.exitCode = exitCode;
}).catch((error) => {
    const exitCode = Number.isInteger(error && error.exitCode) ? error.exitCode : 5;
    const message = error && error.message ? error.message : "Internal error";
    process.stderr.write(`${message}\n`);
    process.exitCode = exitCode;
});
