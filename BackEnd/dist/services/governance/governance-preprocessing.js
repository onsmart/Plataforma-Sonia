"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectJailbreak = detectJailbreak;
exports.detectCompetitorMention = detectCompetitorMention;
exports.applyPreProcessing = applyPreProcessing;
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Detecta tentativas de jailbreak/prompt injection
 * @param message Mensagem do usuário
 * @returns true se detectar tentativa de jailbreak
 */
function detectJailbreak(message) {
    if (!message || !message.trim())
        return false;
    const lowerMessage = message.toLowerCase();
    // Padrões comuns de jailbreak
    const jailbreakPatterns = [
        /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
        /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
        /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
        /override\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
        /system\s*:?\s*(prompt|instruction|override)/i,
        /you\s+are\s+now\s+(a|an)\s+/i,
        /pretend\s+you\s+are/i,
        /act\s+as\s+if/i,
        /roleplay\s+as/i,
        /simulate\s+being/i,
        /\[system\]/i,
        /\[instruction\]/i,
        /\[override\]/i,
        /<\|system\|>/i,
        /<\|assistant\|>/i
    ];
    for (const pattern of jailbreakPatterns) {
        if (pattern.test(lowerMessage)) {
            logger_1.default.warn('[detectJailbreak] 🛡️ Tentativa de jailbreak detectada:', {
                pattern: pattern.toString(),
                messagePreview: message.substring(0, 100)
            });
            return true;
        }
    }
    return false;
}
/**
 * Detecta menções a concorrentes
 * @param message Mensagem do usuário
 * @returns true se detectar menção a concorrente
 */
function detectCompetitorMention(message) {
    if (!message || !message.trim())
        return false;
    const lowerMessage = message.toLowerCase();
    // Lista de palavras-chave de concorrentes (pode ser expandida)
    const competitorKeywords = [
        'concorrente',
        'competidor',
        'rival',
        'adversário',
        'competition',
        'competitor',
        'rival',
        'alternative',
        'alternativa'
    ];
    // Padrões que indicam menção a concorrentes
    const competitorPatterns = [
        /(fale|falar|conte|conversar|discutir|mencionar|elogiar|recomendar).*(sobre|de|do|da).*(concorrente|competidor|rival|adversário)/i,
        /(tell|talk|discuss|mention|praise|recommend).*(about|of).*(competitor|rival|alternative)/i,
        /(qual|what|which).*(é|is|are).*(melhor|better|best).*(que|than)/i,
        /(comparar|compare).*(com|with)/i
    ];
    // Verificar palavras-chave
    for (const keyword of competitorKeywords) {
        if (lowerMessage.includes(keyword)) {
            logger_1.default.warn('[detectCompetitorMention] 🛡️ Menção a concorrente detectada:', {
                keyword,
                messagePreview: message.substring(0, 100)
            });
            return true;
        }
    }
    // Verificar padrões
    for (const pattern of competitorPatterns) {
        if (pattern.test(lowerMessage)) {
            logger_1.default.warn('[detectCompetitorMention] 🛡️ Padrão de concorrente detectado:', {
                pattern: pattern.toString(),
                messagePreview: message.substring(0, 100)
            });
            return true;
        }
    }
    return false;
}
/**
 * Aplica pré-processamento de governança na mensagem do usuário
 * @param message Mensagem do usuário
 * @param config Configuração de governança
 * @returns Objeto com resultado: { blocked: boolean, reason?: string, message?: string }
 */
function applyPreProcessing(message, config) {
    // 1. Verificar Jailbreak Protection
    if (config.filters.jailbreakProtection && detectJailbreak(message)) {
        return {
            blocked: true,
            reason: 'jailbreak_detected',
            response: 'Desculpe, não posso processar essa solicitação. Por favor, reformule sua pergunta de forma mais direta.'
        };
    }
    // 2. Verificar Competitor Blocking
    if (config.filters.competitorBlocking && detectCompetitorMention(message)) {
        return {
            blocked: true,
            reason: 'competitor_mention',
            response: 'Desculpe, não posso discutir sobre outras plataformas ou concorrentes. Como posso ajudá-lo com nossos produtos e serviços?'
        };
    }
    // Mensagem aprovada
    return { blocked: false };
}
