"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailReader = createEmailReader;
const outlook_reader_1 = require("./outlook/outlook.reader");
function createEmailReader(provider, credentials) {
    switch (provider) {
        case 'outlook':
            return new outlook_reader_1.OutlookEmailReader(credentials.refresh_token);
        default:
            throw new Error('Provider de email não suportado');
    }
}
