"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWithResend = sendWithResend;
const resend_1 = require("resend");
const buildEmailHtml_1 = require("./buildEmailHtml");
// Lazy initialization: só cria o cliente quando for usado
let resendClient = null;
function getResendClient() {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            throw new Error('RESEND_API_KEY não configurada no arquivo .env. Configure a variável RESEND_API_KEY para usar o serviço de email Resend.');
        }
        resendClient = new resend_1.Resend(apiKey);
    }
    return resendClient;
}
async function sendWithResend(data) {
    // Prepara o payload do Resend
    const emailPayload = {
        from: data.from || 'Sonia AI <no-reply@sonia.ai>',
        to: data.to,
        subject: data.subject,
    };
    // Prioridade: html > style (com buildEmailHtml) > text
    if (data.html) {
        // Se já tem HTML, usa diretamente
        emailPayload.html = data.html;
    }
    else if (data.style && data.text) {
        // Se tem style, gera HTML usando buildEmailHtml
        emailPayload.html = (0, buildEmailHtml_1.buildEmailHtml)(data.text, data.style);
    }
    else if (data.text) {
        // Fallback para texto simples
        emailPayload.text = data.text;
    }
    else {
        // Fallback para texto vazio se nada for fornecido
        emailPayload.text = '';
    }
    const resend = getResendClient();
    await resend.emails.send(emailPayload);
}
