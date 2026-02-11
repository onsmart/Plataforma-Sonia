"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutlookEmailReader = void 0;
const axios_1 = __importDefault(require("axios"));
const outlook_oauth_1 = require("./outlook.oauth");
class OutlookEmailReader {
    constructor(refreshToken) {
        this.refreshToken = refreshToken;
    }
    async client() {
        const accessToken = await (0, outlook_oauth_1.getOutlookAccessToken)(this.refreshToken);
        return axios_1.default.create({
            baseURL: 'https://graph.microsoft.com/v1.0',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }
    async listMessages() {
        const api = await this.client();
        const { data } = await api.get('/me/mailFolders/inbox/messages?$top=10');
        return data.value.map((msg) => ({
            id: msg.id,
            from: msg.from.emailAddress.address,
            subject: msg.subject,
            body: msg.body.content,
            receivedAt: msg.receivedDateTime,
        }));
    }
    async getMessage(id) {
        const api = await this.client();
        const { data } = await api.get(`/me/messages/${id}`);
        return {
            id: data.id,
            from: data.from.emailAddress.address,
            subject: data.subject,
            body: data.body.content,
            receivedAt: data.receivedDateTime,
        };
    }
}
exports.OutlookEmailReader = OutlookEmailReader;
