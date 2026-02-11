"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlookClient = void 0;
const axios_1 = __importDefault(require("axios"));
const buildEmailHtml_1 = require("../../email/buildEmailHtml");
class OutlookClient {
    constructor(accessToken) {
        this.baseUrl = 'https://graph.microsoft.com/v1.0';
        this.accessToken = accessToken;
    }
    async getInboxMessages(limit = 5) {
        const response = await axios_1.default.get(`${this.baseUrl}/me/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc`, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
            },
        });
        return response.data;
    }
    async sendMail(data) {
        console.log('[OutlookClient.sendMail] 📧 Iniciando envio de email:', {
            to: data.to,
            subject: data.subject,
            hasText: !!data.text,
            hasHtml: !!data.html,
            hasStyle: !!(data.style || data.visual_style)
        });
        // Se tiver style ou visual_style, gera HTML
        let finalHtml;
        let finalText;
        if (data.style || data.visual_style) {
            finalHtml = (0, buildEmailHtml_1.buildEmailHtml)(data.text || '', data.style || data.visual_style);
            console.log('[OutlookClient.sendMail] HTML gerado com estilo:', data.style || data.visual_style);
        }
        else if (data.html) {
            finalHtml = data.html;
        }
        else if (data.text) {
            finalText = data.text;
        }
        const body = {
            message: {
                subject: data.subject,
                body: {
                    contentType: finalHtml ? 'HTML' : 'Text',
                    content: finalHtml || finalText || ''
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: data.to
                        }
                    }
                ]
            },
            saveToSentItems: true
        };
        console.log('[OutlookClient.sendMail] 📤 Enviando para Microsoft Graph API...');
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/me/sendMail`, body, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('[OutlookClient.sendMail] ✅ Email enviado com sucesso via Graph API!', {
                status: response.status,
                to: data.to,
                subject: data.subject
            });
            return response.data;
        }
        catch (error) {
            console.error('[OutlookClient.sendMail] ❌ Erro ao enviar email:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                message: error.message,
                to: data.to,
                subject: data.subject
            });
            throw error;
        }
    }
}
exports.OutlookClient = OutlookClient;
