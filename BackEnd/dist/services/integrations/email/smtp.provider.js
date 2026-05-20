"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWithSMTP = sendWithSMTP;
const nodemailer_1 = __importDefault(require("nodemailer"));
const buildEmailHtml_1 = require("./buildEmailHtml");
function assertValidSmtpHost(host) {
    const normalized = String(host || '').trim().toLowerCase();
    if (!normalized || normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
        throw new Error('SMTP host invalido (localhost). Configure smtp.gmail.com, smtp.office365.com ou o host do seu provedor na integracao de e-mail.');
    }
}
async function sendWithSMTP(creds, data) {
    assertValidSmtpHost(creds.smtp_host);
    const transporter = nodemailer_1.default.createTransport({
        host: creds.smtp_host,
        port: creds.smtp_port,
        secure: creds.smtp_port === 465,
        auth: {
            user: creds.email,
            pass: creds.app_key,
        },
    });
    // Prioridade: html > style (com buildEmailHtml) > text
    let htmlContent;
    if (data.html) {
        // Se já tem HTML, usa diretamente
        htmlContent = data.html;
    }
    else if (data.style && data.text) {
        // Se tem style, gera HTML usando buildEmailHtml
        htmlContent = (0, buildEmailHtml_1.buildEmailHtml)(data.text, data.style);
    }
    await transporter.sendMail({
        from: creds.email,
        to: data.to,
        subject: data.subject,
        text: htmlContent ? undefined : (data.text || ''), // Envia text apenas se não houver HTML
        html: htmlContent, // Envia HTML se gerado ou fornecido
    });
}
