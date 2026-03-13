"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSentiment = analyzeSentiment;
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Analisa sentimento de uma mensagem usando OpenAI
 * Retorna score de -1 (negativo) a 1 (positivo)
 */
async function analyzeSentiment(message) {
    try {
        if (!message || message.trim().length === 0) {
            return 0; // Neutro se mensagem vazia
        }
        // Se não tiver OpenAI configurado, usa análise heurística simples
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            logger_1.default.warn('[analyzeSentiment] OpenAI API key não configurada, usando análise heurística');
            return analyzeSentimentHeuristic(message);
        }
        // Usa OpenAI para análise de sentimento
        const { default: OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
        const openai = new OpenAI({ apiKey: openaiApiKey });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Modelo mais barato para análise de sentimento
            messages: [
                {
                    role: 'system',
                    content: 'Você é um analisador de sentimento. Analise a mensagem e retorne APENAS um número entre -1 e 1, onde -1 é muito negativo, 0 é neutro, e 1 é muito positivo. Retorne apenas o número, sem explicações.'
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            temperature: 0.3,
            max_tokens: 10
        });
        const sentimentText = response.choices[0]?.message?.content?.trim();
        if (!sentimentText) {
            return analyzeSentimentHeuristic(message);
        }
        // Tenta extrair número da resposta
        const sentimentMatch = sentimentText.match(/-?\d+\.?\d*/);
        if (sentimentMatch) {
            const sentiment = parseFloat(sentimentMatch[0]);
            // Garante que está entre -1 e 1
            return Math.max(-1, Math.min(1, sentiment));
        }
        return analyzeSentimentHeuristic(message);
    }
    catch (error) {
        logger_1.default.error('[analyzeSentiment] Erro ao analisar sentimento com OpenAI:', error);
        // Fallback para análise heurística
        return analyzeSentimentHeuristic(message);
    }
}
/**
 * Análise heurística simples de sentimento
 * Usa palavras-chave para determinar sentimento
 */
function analyzeSentimentHeuristic(message) {
    const lowerMessage = message.toLowerCase();
    // Palavras positivas
    const positiveWords = [
        'obrigado', 'obrigada', 'obrigad', 'grato', 'gratidão', 'perfeito', 'excelente',
        'ótimo', 'bom', 'bem', 'legal', 'show', 'top', 'incrível', 'fantástico',
        'maravilhoso', 'adorei', 'amei', 'satisfeito', 'feliz', 'alegre', 'content',
        'resolvido', 'resolvi', 'ajudou', 'ajuda', 'sucesso', 'funcionou', 'ok', 'okay'
    ];
    // Palavras negativas
    const negativeWords = [
        'ruim', 'péssimo', 'horrível', 'terrível', 'não gostei', 'odiei', 'detestei',
        'insatisfeito', 'triste', 'chateado', 'bravo', 'irritado', 'frustrado',
        'problema', 'erro', 'falha', 'não funciona', 'não funcionou', 'não resolveu',
        'desapontado', 'decepcionado', 'pior', 'horror', 'péssimo', 'lixo', 'merda'
    ];
    let positiveCount = 0;
    let negativeCount = 0;
    for (const word of positiveWords) {
        if (lowerMessage.includes(word)) {
            positiveCount++;
        }
    }
    for (const word of negativeWords) {
        if (lowerMessage.includes(word)) {
            negativeCount++;
        }
    }
    // Calcula score: -1 a 1
    if (positiveCount === 0 && negativeCount === 0) {
        return 0; // Neutro
    }
    const total = positiveCount + negativeCount;
    const score = (positiveCount - negativeCount) / Math.max(total, 1);
    // Normaliza para -1 a 1
    return Math.max(-1, Math.min(1, score));
}
