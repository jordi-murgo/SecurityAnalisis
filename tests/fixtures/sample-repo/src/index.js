"use strict";

const crypto = require("crypto");

function hashValue(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex");
}

console.log(hashValue("fixture"));