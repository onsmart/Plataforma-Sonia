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
exports.FALLBACK_GOVERNANCE_FOR_PREPROCESS = exports.GOVERNANCE_RECOMMENDED_FILTERS = void 0;
exports.mergeGovernanceSecureDefaults = mergeGovernanceSecureDefaults;
exports.getGovernanceConfig = getGovernanceConfig;
exports.getGovernanceConfigByEmail = getGovernanceConfigByEmail;
exports.clearGovernanceCache = clearGovernanceCache;
exports.clearAllGovernanceCache = clearAllGovernanceCache;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const company_helper_1 = require("../../utils/company-helper");
/**
 * DLP e limiares de moderação de prompt são sempre no máximo; bloqueio de concorrentes removido do produto.
 * Apenas anti-alucinação e jailbreak vêm da configuração guardada.
 */
function mergeGovernanceSecureDefaults(config) {
    return {
        ...config,
        safetyThresholds: {
            hateSpeech: 100,
            sexualContent: 100,
            dangerousContent: 100,
        },
        filters: {
            competitorBlocking: false,
            antiHallucination: config.filters.antiHallucination,
            jailbreakProtection: config.filters.jailbreakProtection,
        },
        dlp: {
            creditCard: true,
            ssn: true,
            email: true,
            phone: true,
        },
        retention: config.retention,
    };
}
/**
 * Pré-definição recomendada do sistema para os dois filtros expostos em AI Guardrails.
 * Usar como default em API, fallback em runtime e na criação de linhas novas.
 */
exports.GOVERNANCE_RECOMMENDED_FILTERS = {
    antiHallucination: true,
    jailbreakProtection: true,
};
/**
 * Config efetiva quando não há linha em tb_governance_configs (ou leitura falhou):
 * mesmos defaults recomendados + DLP/limiares seguros.
 */
exports.FALLBACK_GOVERNANCE_FOR_PREPROCESS = mergeGovernanceSecureDefaults({
    safetyThresholds: { hateSpeech: 100, sexualContent: 100, dangerousContent: 100 },
    filters: {
        competitorBlocking: false,
        antiHallucination: exports.GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
        jailbreakProtection: exports.GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
    },
    dlp: { creditCard: true, ssn: true, email: true, phone: true },
});
/**
 * Cache em memória para configurações de governança
 * Estrutura: { companies_id: { config: GovernanceConfig, expiresAt: number } }
 */
const governanceCache = new Map();
// TTL do cache: 5 minutos (300000ms)
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * Obtém configuração de governança com cache
 * @param companiesId ID da empresa
 * @param forceRefresh Força atualização do cache
 * @returns Configuração de governança ou null
 */
async function getGovernanceConfig(companiesId, forceRefresh = false) {
    try {
        if (!companiesId) {
            logger_1.default.warn('[getGovernanceConfig] companiesId não fornecido');
            return null;
        }
        // Verificar se o plano permite Governance
        try {
            const { canUseGovernance } = await Promise.resolve().then(() => __importStar(require('../../utils/plan-helper')));
            const checkResult = await canUseGovernance(companiesId);
            if (!checkResult.allowed) {
                logger_1.default.warn('[getGovernanceConfig] 🚫 Governance não permitido para este plano:', {
                    companiesId,
                    reason: checkResult.reason
                });
                throw new Error(checkResult.reason || 'A funcionalidade Governance está disponível apenas no plano Enterprise.');
            }
        }
        catch (planError) {
            // Se a mensagem já é sobre Governance, propaga
            if (planError.message?.includes('Governance') || planError.message?.includes('Enterprise')) {
                throw planError;
            }
            // Se for outro erro, loga mas continua (fail-safe)
            logger_1.default.warn('[getGovernanceConfig] Erro ao verificar plano, continuando:', planError);
        }
        // Verificar cache (se não for refresh forçado)
        if (!forceRefresh) {
            const cached = governanceCache.get(companiesId);
            if (cached && cached.expiresAt > Date.now()) {
                logger_1.default.log(`[getGovernanceConfig] ✅ Cache hit para companies_id: ${companiesId}`);
                return cached.config;
            }
        }
        // Buscar do banco
        logger_1.default.log(`[getGovernanceConfig] 🔍 Buscando configuração do banco para companies_id: ${companiesId}`);
        const { data: configData, error: configError } = await supabase_1.supabase
            .from('tb_governance_configs')
            .select('*')
            .eq('companies_id', companiesId)
            .single();
        if (configError) {
            logger_1.default.error('[getGovernanceConfig] Erro ao buscar configuração:', configError);
            return null;
        }
        if (!configData) {
            logger_1.default.warn(`[getGovernanceConfig] Configuração não encontrada para companies_id: ${companiesId}`);
            return null;
        }
        // Mapear campos do banco (snake_case) para interface (camelCase)
        const config = {
            safetyThresholds: {
                hateSpeech: configData.hate_speech_threshold || 80,
                sexualContent: configData.sexual_content_threshold || 95,
                dangerousContent: configData.dangerous_content_threshold || 90
            },
            filters: {
                competitorBlocking: configData.competitor_blocking ?? true,
                antiHallucination: configData.anti_hallucination ?? exports.GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
                jailbreakProtection: configData.jailbreak_protection ?? exports.GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
            },
            dlp: {
                creditCard: configData.mask_credit_cards ?? true,
                ssn: configData.mask_ssn ?? true,
                email: configData.mask_emails ?? true,
                phone: configData.mask_phone ?? false
            },
            retention: {
                chatLogsRetentionDays: configData.chat_logs_retention_days || 30,
                voiceRetentionDays: configData.voice_retention_days || 30
            }
        };
        const effective = mergeGovernanceSecureDefaults(config);
        // Atualizar cache com config já efetiva (DLP sempre on, etc.)
        governanceCache.set(companiesId, {
            config: effective,
            expiresAt: Date.now() + CACHE_TTL_MS
        });
        logger_1.default.log(`[getGovernanceConfig] ✅ Configuração carregada e cache atualizado para companies_id: ${companiesId}`);
        return effective;
    }
    catch (err) {
        logger_1.default.error('[getGovernanceConfig] Erro:', err);
        return null;
    }
}
/**
 * Obtém configuração de governança por email (com cache)
 * @param email Email do usuário
 * @param forceRefresh Força atualização do cache
 * @returns Configuração de governança ou null
 */
async function getGovernanceConfigByEmail(email, forceRefresh = false) {
    try {
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            logger_1.default.warn(`[getGovernanceConfigByEmail] companies_id não encontrado para email: ${email}`);
            return null;
        }
        return await getGovernanceConfig(companiesId, forceRefresh);
    }
    catch (err) {
        logger_1.default.error('[getGovernanceConfigByEmail] Erro:', err);
        return null;
    }
}
/**
 * Limpa o cache de governança para uma empresa específica
 * @param companiesId ID da empresa
 */
function clearGovernanceCache(companiesId) {
    governanceCache.delete(companiesId);
    logger_1.default.log(`[clearGovernanceCache] ✅ Cache limpo para companies_id: ${companiesId}`);
}
/**
 * Limpa todo o cache de governança
 */
function clearAllGovernanceCache() {
    governanceCache.clear();
    logger_1.default.log('[clearAllGovernanceCache] ✅ Todo o cache de governança foi limpo');
}
