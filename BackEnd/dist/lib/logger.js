"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger = {
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    info: (message, ...args) => {
        console.info(`[INFO] ${message}`, ...args);
    },
    log: (message, ...args) => {
        console.log(`[LOG] ${message}`, ...args);
    },
};
exports.default = logger;
