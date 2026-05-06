"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatText = chatText;
require("../../lib/env");
const openai_1 = __importDefault(require("openai"));
async function chatText({ system, user, model, temperature, maxTokens, apiKey, responseFormat, timeoutMs, serviceTier, }) {
    const key = apiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!key) {
        return {
            success: false,
            content: 'Configuração de IA ausente.',
            error: 'API_KEY_MISSING'
        };
    }
    try {
        const client = new openai_1.default({
            apiKey: key,
            timeout: timeoutMs,
            maxRetries: 0,
        });
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature,
            max_tokens: maxTokens,
            response_format: responseFormat,
            stream: false,
            ...(serviceTier && serviceTier !== 'default'
                ? { service_tier: serviceTier }
                : {}),
        });
        return {
            success: true,
            content: response.choices[0].message.content ?? 'Sem resposta da LLM',
            usage: response.usage ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
            } : undefined
        };
    }
    catch (error) {
        console.error('Erro na chamada OpenAI:', error?.message);
        return {
            success: false,
            content: 'Estou temporariamente com instabilidade na IA. Tente novamente.',
            error: 'LLM_UNAVAILABLE'
        };
    }
}
