"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatText = chatText;
const openai_1 = __importDefault(require("openai"));
async function chatText({ system, user, model, temperature, maxTokens, apiKey, }) {
    // Usa a API key do agente se fornecida, senão usa a do ambiente
    const key = apiKey?.trim() || process.env.OPENAI_API_KEY;
    if (!key) {
        throw new Error('API key não encontrada. Configure a API key do agente ou a variável OPENAI_API_KEY');
    }
    // Cria cliente com a API key correta
    const client = new openai_1.default({
        apiKey: key,
    });
    const response = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
    });
    // Retorna conteúdo e dados de uso
    return {
        content: response.choices[0].message.content ?? 'Sem resposta da LLM',
        usage: response.usage ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
        } : undefined
    };
}
