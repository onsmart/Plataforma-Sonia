"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutlookAccessToken = getOutlookAccessToken;
exports.exchangeCodeForToken = exchangeCodeForToken;
const axios_1 = __importDefault(require("axios"));
async function getOutlookAccessToken(refreshToken) {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';
    if (!clientId || !clientSecret) {
        throw new Error('OUTLOOK_CLIENT_ID e OUTLOOK_CLIENT_SECRET devem estar configurados');
    }
    const response = await axios_1.default.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default',
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    return response.data.access_token;
}
async function exchangeCodeForToken(code) {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3333/auth/outlook/callback';
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';
    if (!clientId || !clientSecret) {
        throw new Error('OUTLOOK_CLIENT_ID e OUTLOOK_CLIENT_SECRET devem estar configurados');
    }
    if (!redirectUri) {
        throw new Error('OUTLOOK_REDIRECT_URI deve estar configurado');
    }
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('scope', 'offline_access Mail.Read Mail.Send User.Read');
    const response = await axios_1.default.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return response.data;
}
