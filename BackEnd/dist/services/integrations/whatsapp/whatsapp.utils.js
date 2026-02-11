"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPhoneNumberFromText = extractPhoneNumberFromText;
exports.isValidPhoneNumber = isValidPhoneNumber;
/**
 * Extrai número de telefone de um texto
 * Exemplos:
 * - "5511999999999" → "5511999999999"
 * - "meu número é 55119999999" → "55119999999"
 * - "5511999999999@s.whatsapp.net" → "5511999999999"
 * - "Olá, meu número é 11 99999-9999" → "11999999999"
 */
function extractPhoneNumberFromText(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }
    // Remove espaços, hífens, parênteses e outros caracteres não numéricos
    // Mas mantém apenas dígitos
    const cleaned = text.replace(/\D/g, '');
    // Padrões comuns de números brasileiros e internacionais
    // Número brasileiro: 10-11 dígitos (com DDD) ou 13 dígitos (com código do país)
    // Número internacional: 10-15 dígitos
    // Tenta encontrar números com 10-15 dígitos
    const phonePatterns = [
        /(\d{10,15})/g, // 10-15 dígitos
    ];
    const matches = [];
    for (const pattern of phonePatterns) {
        const found = text.match(pattern);
        if (found) {
            matches.push(...found.map(m => m.replace(/\D/g, '')));
        }
    }
    // Se encontrou matches, retorna o maior (mais provável de ser número completo)
    if (matches.length > 0) {
        const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
        // Validação: número deve ter entre 10 e 15 dígitos
        if (longest.length >= 10 && longest.length <= 15) {
            // Remove zeros à esquerda se tiver mais de 11 dígitos (pode ser código do país)
            let normalized = longest;
            // Se começa com 0 e tem mais de 11 dígitos, remove o 0
            if (normalized.startsWith('0') && normalized.length > 11) {
                normalized = normalized.substring(1);
            }
            // Se o número tem 10 ou 11 dígitos e não começa com 55, adiciona código do país Brasil
            // Exemplo: "11999999999" (11 dígitos) → "5511999999999" (13 dígitos)
            if ((normalized.length === 10 || normalized.length === 11) && !normalized.startsWith('55')) {
                normalized = `55${normalized}`;
            }
            return normalized;
        }
    }
    // Se não encontrou padrão, tenta extrair da string limpa
    if (cleaned.length >= 10 && cleaned.length <= 15) {
        let normalized = cleaned;
        // Se o número tem 10 ou 11 dígitos e não começa com 55, adiciona código do país Brasil
        if ((normalized.length === 10 || normalized.length === 11) && !normalized.startsWith('55')) {
            normalized = `55${normalized}`;
        }
        return normalized;
    }
    return null;
}
/**
 * Valida se um número de telefone tem formato válido
 */
function isValidPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
        return false;
    }
    // Remove caracteres não numéricos
    const cleaned = phoneNumber.replace(/\D/g, '');
    // Deve ter entre 10 e 15 dígitos
    if (cleaned.length < 10 || cleaned.length > 15) {
        return false;
    }
    // Não deve começar com 0 (exceto se for número muito curto, mas isso é raro)
    // Não deve começar com 1 (exceto se for código do país)
    if (cleaned.startsWith('0') && cleaned.length > 11) {
        return false;
    }
    return true;
}
