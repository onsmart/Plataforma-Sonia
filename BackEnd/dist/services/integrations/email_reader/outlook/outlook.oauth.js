"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOutlookRedirectUri = resolveOutlookRedirectUri;
exports.createSignedOutlookState = createSignedOutlookState;
exports.verifySignedOutlookState = verifySignedOutlookState;
exports.createOutlookAuthorizeUrl = createOutlookAuthorizeUrl;
exports.refreshOutlookAccessToken = refreshOutlookAccessToken;
exports.getOutlookAccessToken = getOutlookAccessToken;
exports.exchangeCodeForToken = exchangeCodeForToken;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_OUTLOOK_SCOPE = 'offline_access Mail.Read Mail.Send User.Read';
const DEFAULT_OUTLOOK_REDIRECT_URI = 'http://localhost:3333/auth/outlook/callback';
const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
function getOutlookClientId() {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    if (!clientId) {
        throw new Error('OUTLOOK_CLIENT_ID deve estar configurado');
    }
    return clientId;
}
function getOutlookClientSecret() {
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    if (!clientSecret) {
        throw new Error('OUTLOOK_CLIENT_SECRET deve estar configurado');
    }
    return clientSecret;
}
function getOutlookStateSecret() {
    return process.env.OUTLOOK_STATE_SECRET || getOutlookClientSecret();
}
function base64UrlEncode(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function base64UrlDecode(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}
function signStatePayload(payload) {
    return base64UrlEncode(crypto_1.default.createHmac('sha256', getOutlookStateSecret()).update(payload).digest());
}
function assertOutlookStateSignature(payload, signature) {
    const expected = signStatePayload(payload);
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(String(signature || ''));
    if (expectedBuffer.length !== receivedBuffer.length ||
        !crypto_1.default.timingSafeEqual(expectedBuffer, receivedBuffer)) {
        throw new Error('State do Outlook invalido ou adulterado.');
    }
}
function resolveOutlookRedirectUri(requestOrigin) {
    const redirectUri = String(process.env.OUTLOOK_REDIRECT_URI || '').trim();
    if (redirectUri) {
        return redirectUri;
    }
    const normalizedOrigin = String(requestOrigin || '').trim().replace(/\/+$/g, '');
    if (normalizedOrigin) {
        return `${normalizedOrigin}/auth/outlook/callback`;
    }
    return DEFAULT_OUTLOOK_REDIRECT_URI;
}
function createSignedOutlookState(input, ttlMs = DEFAULT_STATE_TTL_MS) {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;
    const payload = {
        userId: String(input.userId || '').trim(),
        userEmail: String(input.userEmail || '').trim() || undefined,
        integrationId: String(input.integrationId || '').trim() || undefined,
        issuedAt,
        expiresAt,
    };
    if (!payload.userId) {
        throw new Error('Nao foi possivel gerar o state do Outlook sem userId.');
    }
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signStatePayload(encodedPayload);
    return `${encodedPayload}.${signature}`;
}
function verifySignedOutlookState(state) {
    const [encodedPayload, signature] = String(state || '').split('.');
    if (!encodedPayload || !signature) {
        throw new Error('State do Outlook ausente ou malformado.');
    }
    assertOutlookStateSignature(encodedPayload, signature);
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const userId = String(payload.userId || '').trim();
    const issuedAt = Number(payload.issuedAt || 0);
    const expiresAt = Number(payload.expiresAt || 0);
    if (!userId || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
        throw new Error('State do Outlook invalido.');
    }
    if (Date.now() > expiresAt) {
        throw new Error('State do Outlook expirado. Inicie a autenticacao novamente.');
    }
    return {
        userId,
        userEmail: String(payload.userEmail || '').trim() || undefined,
        integrationId: String(payload.integrationId || '').trim() || undefined,
        issuedAt,
        expiresAt,
    };
}
function createOutlookAuthorizeUrl(input) {
    const clientId = getOutlookClientId();
    const tenantId = String(input.tenantId || process.env.OUTLOOK_TENANT_ID || 'common').trim() || 'common';
    const redirectUri = resolveOutlookRedirectUri(input.requestOrigin);
    const authorizeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(DEFAULT_OUTLOOK_SCOPE)}` +
        `&state=${encodeURIComponent(input.state)}`;
    return {
        authorizeUrl,
        redirectUri,
    };
}
async function refreshOutlookAccessToken(refreshToken) {
    const clientId = getOutlookClientId();
    const clientSecret = getOutlookClientSecret();
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
    return response.data;
}
async function getOutlookAccessToken(refreshToken) {
    const tokenData = await refreshOutlookAccessToken(refreshToken);
    return tokenData.access_token;
}
async function exchangeCodeForToken(code, requestOrigin) {
    const clientId = getOutlookClientId();
    const clientSecret = getOutlookClientSecret();
    const redirectUri = resolveOutlookRedirectUri(requestOrigin);
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
    params.append('scope', DEFAULT_OUTLOOK_SCOPE);
    const response = await axios_1.default.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    return response.data;
}
