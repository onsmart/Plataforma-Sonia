"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const smtp_provider_1 = require("./smtp.provider");
const resend_provider_1 = require("./resend.provider");
const outlook_client_1 = require("../email_reader/outlook/outlook.client");
const supabase_1 = require("../../../lib/supabase");
const logger_1 = __importDefault(require("../../../lib/logger"));
async function sendEmail(integrationsId, data) {
    const { data: creds, error } = await supabase_1.supabase
        .from('tb_integrations')
        .select('id, email, smtp_host, smtp_port, app_key, provider, access_token')
        .eq('id', integrationsId)
        .single();
    if (!creds || error) {
        throw new Error('Credenciais de email não encontradas');
    }
    // 1️⃣ Se for Outlook, usa Microsoft Graph API (OAuth)
    if (creds.provider === 'outlook' && creds.access_token) {
        try {
            console.log('[sendEmail] 📧 Enviando email via Microsoft Graph API (Outlook)', {
                from: creds.email,
                to: data.to,
                subject: data.subject,
                integrationsId: integrationsId
            });
            const outlookClient = new outlook_client_1.OutlookClient(creds.access_token);
            await outlookClient.sendMail({
                to: data.to,
                subject: data.subject,
                text: data.text,
                html: data.html,
                style: data.style || data.visual_style,
            });
            console.log('[sendEmail] ✅ Email enviado com sucesso via Graph API!', {
                from: creds.email,
                to: data.to,
                subject: data.subject
            });
            return { provider: 'outlook_graph' };
        }
        catch (err) {
            console.error('[sendEmail] ❌ Erro ao enviar via Graph API:', {
                error: err.message,
                status: err.response?.status,
                from: creds.email,
                to: data.to,
                subject: data.subject
            });
            // Se o token expirou, tenta atualizar e tentar novamente
            if (err.response?.status === 401) {
                throw new Error('Token do Outlook expirado. Por favor, reconecte sua conta Outlook.');
            }
            throw new Error(`Erro ao enviar email via Outlook: ${err.message || 'Erro desconhecido'}`);
        }
    }
    // 2️⃣ Tenta SMTP do agente (para outros provedores)
    try {
        await (0, smtp_provider_1.sendWithSMTP)({
            email: creds.email,
            smtp_host: creds.smtp_host,
            smtp_port: creds.smtp_port,
            app_key: creds.app_key,
        }, {
            to: data.to,
            subject: data.subject,
            text: data.text,
            html: data.html,
            style: data.style || data.visual_style, // Suporta style ou visual_style
        });
        return { provider: 'smtp' };
    }
    catch (err) {
        logger_1.default.warn('SMTP falhou, tentando Resend como fallback', err);
    }
    // 3️⃣ Fallback Resend
    try {
        await (0, resend_provider_1.sendWithResend)({
            to: data.to,
            subject: data.subject,
            text: data.text,
            html: data.html,
            style: data.style || data.visual_style, // Suporta style ou visual_style
            from: creds.email || 'Sonia AI <no-reply@sonia.ai>',
        });
        return { provider: 'resend' };
    }
    catch (resendError) {
        // Se Resend não estiver configurado ou falhar, lança erro informativo
        if (resendError.message?.includes('RESEND_API_KEY')) {
            throw new Error('Falha ao enviar email: SMTP falhou e Resend não está configurado. Configure RESEND_API_KEY no arquivo .env ou verifique as credenciais SMTP.');
        }
        throw new Error(`Falha ao enviar email: SMTP e Resend falharam. Último erro: ${resendError.message || resendError}`);
    }
}
