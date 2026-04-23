"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendEmailForUser = sendEmailForUser;
const mail_send_service_1 = require("../mail/mail-send.service");
const logger_1 = __importDefault(require("../../../lib/logger"));
async function sendEmail(integrationsId, data) {
    try {
        const result = await (0, mail_send_service_1.sendMailFromIntegration)(integrationsId, data);
        return { provider: result.provider };
    }
    catch (providerError) {
        logger_1.default.warn('[sendEmail] Provider de email da integracao falhou', {
            integrationsId,
            error: providerError?.message || providerError,
        });
        throw new Error(`Falha ao enviar email com a integracao configurada. Revise as credenciais salvas para esta conta. Ultimo erro: ${providerError?.message || providerError}`);
    }
}
async function sendEmailForUser(userEmail, preferredIntegrationId, data) {
    try {
        const result = await (0, mail_send_service_1.sendMailForUser)(userEmail, data, preferredIntegrationId);
        return { provider: result.provider };
    }
    catch (providerError) {
        logger_1.default.warn('[sendEmailForUser] Resolver/provider de email falhou', {
            userEmail,
            preferredIntegrationId,
            error: providerError?.message || providerError,
        });
        throw new Error(`Falha ao enviar email com a integracao configurada. Revise a integracao padrao de email. Ultimo erro: ${providerError?.message || providerError}`);
    }
}
