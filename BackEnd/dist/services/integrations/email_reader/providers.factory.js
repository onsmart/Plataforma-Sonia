"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailReader = createEmailReader;
const outlook_reader_1 = require("./outlook/outlook.reader");
function normalizeEmailProvider(provider) {
    const normalized = String(provider || '').trim().toLowerCase();
    if (normalized === 'outlook' || normalized === 'office365' || normalized === 'microsoft365') {
        return 'microsoft365';
    }
    return normalized;
}
function createEmailReader(provider, credentials) {
    switch (normalizeEmailProvider(provider)) {
        case 'microsoft365':
            return new outlook_reader_1.OutlookEmailReader(credentials.refresh_token);
        default:
            throw new Error('Provider de email não suportado');
    }
}
