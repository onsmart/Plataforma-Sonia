"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.chunkText = chunkText;
require("../../lib/env");
const openai_1 = __importDefault(require("openai"));
/**
 * Gera embedding para um texto usando o modelo text-embedding-3-small
 */
async function generateEmbedding(text) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('❌ [generateEmbedding] OPENAI_API_KEY não encontrada');
        throw new Error('OPENAI_API_KEY não configurada');
    }
    const client = new openai_1.default({ apiKey });
    try {
        console.log(`📡 [generateEmbedding] Gerando embedding. Modelo: text-embedding-3-small. Texto: "${text.substring(0, 50)}..." (${text.length} chars)`);
        const response = await client.embeddings.create({
            model: 'text-embedding-ada-002', // Mudança para modelo mais estável
            input: text,
            encoding_format: 'float'
        });
        console.log('✅ [generateEmbedding] Sucesso. Usage:', response.usage);
        return {
            embedding: response.data[0].embedding,
            usage: {
                prompt_tokens: response.usage.prompt_tokens,
                total_tokens: response.usage.total_tokens
            }
        };
    }
    catch (error) {
        console.error('❌ [generateEmbedding] Erro detalhado OpenAI:', {
            message: error.message,
            status: error.status,
            type: error.type,
            code: error.code,
            headers: error.headers
        });
        throw error;
    }
}
/**
 * Quebra o texto em chunks de tamanho aproximado
 * @param text Texto completo
 * @param chunkSize Tamanho médio do chunk em caracteres (padrão 1000 ~ 200 tokens)
 * @param overlap Sobreposição entre chunks em caracteres (padrão 200)
 */
function chunkText(text, chunkSize = 1000, overlap = 200) {
    if (!text)
        return [];
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;
        // Se não for o último chunk, tenta cortar no final de uma frase ou parágrafo
        if (endIndex < text.length) {
            // Procura o último ponto final ou quebra de linha dentro do limite do chunk
            const lastPeriod = text.lastIndexOf('.', endIndex);
            const lastNewline = text.lastIndexOf('\n', endIndex);
            // Usa o maior índice encontrado (mais próximo do limite)
            const splitIndex = Math.max(lastPeriod, lastNewline);
            // Se encontrou um ponto de corte razoável (não muito no início)
            if (splitIndex > startIndex + (chunkSize / 2)) {
                endIndex = splitIndex + 1; // Inclui o ponto/quebra
            }
            else {
                // Se não achou ponto bom, tenta espaço
                const lastSpace = text.lastIndexOf(' ', endIndex);
                if (lastSpace > startIndex) {
                    endIndex = lastSpace;
                }
            }
        }
        const chunk = text.substring(startIndex, endIndex).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }
        // Avança o início considerando o overlap
        startIndex = endIndex - overlap;
        // Evita loop infinito se overlap >= chunkSize (não deve acontecer mas...)
        if (startIndex >= endIndex) {
            startIndex = endIndex;
        }
    }
    return chunks;
}
