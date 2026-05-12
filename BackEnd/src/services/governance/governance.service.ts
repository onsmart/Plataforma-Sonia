import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { getCompanyIdByEmail } from '../../utils/company-helper'

/**
 * Interface para configuração de governança
 */
export interface GovernanceConfig {
  safetyThresholds: {
    hateSpeech: number
    sexualContent: number
    dangerousContent: number
  }
  filters: {
    competitorBlocking: boolean
    antiHallucination: boolean
    jailbreakProtection: boolean
    blockTechnicalCodeRequests: boolean
    blockSuspiciousRequests: boolean
    blockSensitiveOperationalInfo: boolean
  }
  dlp: {
    creditCard: boolean
    ssn: boolean
    email: boolean
    phone: boolean
  }
  retention?: {
    chatLogsRetentionDays: number
    voiceRetentionDays: number
  }
}

/**
 * DLP e limiares de moderação de prompt são sempre no máximo; bloqueio de concorrentes removido do produto.
 * Apenas anti-alucinação e jailbreak vêm da configuração guardada.
 */
export function mergeGovernanceSecureDefaults(config: GovernanceConfig): GovernanceConfig {
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
      blockTechnicalCodeRequests: true,
      blockSuspiciousRequests: true,
      blockSensitiveOperationalInfo: true,
    },
    dlp: {
      creditCard: true,
      ssn: true,
      email: true,
      phone: true,
    },
    retention: config.retention,
  }
}

/**
 * Pré-definição recomendada do sistema para os dois filtros expostos em AI Guardrails.
 * Usar como default em API, fallback em runtime e na criação de linhas novas.
 */
export const GOVERNANCE_RECOMMENDED_FILTERS = {
  antiHallucination: true,
  jailbreakProtection: true,
  blockTechnicalCodeRequests: true,
  blockSuspiciousRequests: true,
  blockSensitiveOperationalInfo: true,
} as const

/**
 * Config efetiva quando não há linha em tb_governance_configs (ou leitura falhou):
 * mesmos defaults recomendados + DLP/limiares seguros.
 */
export const FALLBACK_GOVERNANCE_FOR_PREPROCESS: GovernanceConfig = mergeGovernanceSecureDefaults({
  safetyThresholds: { hateSpeech: 100, sexualContent: 100, dangerousContent: 100 },
  filters: {
    competitorBlocking: false,
    antiHallucination: GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
    jailbreakProtection: GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
    blockTechnicalCodeRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockTechnicalCodeRequests,
    blockSuspiciousRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockSuspiciousRequests,
    blockSensitiveOperationalInfo: GOVERNANCE_RECOMMENDED_FILTERS.blockSensitiveOperationalInfo,
  },
  dlp: { creditCard: true, ssn: true, email: true, phone: true },
})

/**
 * Cache em memória para configurações de governança
 * Estrutura: { companies_id: { config: GovernanceConfig, expiresAt: number } }
 */
const governanceCache: Map<string, { config: GovernanceConfig; expiresAt: number }> = new Map()

// TTL do cache: 5 minutos (300000ms)
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Obtém configuração de governança com cache
 * @param companiesId ID da empresa
 * @param forceRefresh Força atualização do cache
 * @returns Configuração de governança ou null
 */
export async function getGovernanceConfig(
  companiesId: string,
  forceRefresh: boolean = false
): Promise<GovernanceConfig | null> {
  try {
    if (!companiesId) {
      logger.warn('[getGovernanceConfig] companiesId não fornecido')
      return null
    }

    // Verificar se o plano permite Governance
    try {
      const { canUseGovernance } = await import('../../utils/plan-helper')
      const checkResult = await canUseGovernance(companiesId)
      if (!checkResult.allowed) {
        logger.warn('[getGovernanceConfig] 🚫 Governance não permitido para este plano:', {
          companiesId,
          reason: checkResult.reason
        })
        throw new Error(checkResult.reason || 'A funcionalidade Governance está disponível apenas no plano Enterprise.')
      }
    } catch (planError: any) {
      // Se a mensagem já é sobre Governance, propaga
      if (planError.message?.includes('Governance') || planError.message?.includes('Enterprise')) {
        throw planError
      }
      // Se for outro erro, loga mas continua (fail-safe)
      logger.warn('[getGovernanceConfig] Erro ao verificar plano, continuando:', planError)
    }

    // Verificar cache (se não for refresh forçado)
    if (!forceRefresh) {
      const cached = governanceCache.get(companiesId)
      if (cached && cached.expiresAt > Date.now()) {
        logger.log(`[getGovernanceConfig] ✅ Cache hit para companies_id: ${companiesId}`)
        return cached.config
      }
    }

    // Buscar do banco
    logger.log(`[getGovernanceConfig] 🔍 Buscando configuração do banco para companies_id: ${companiesId}`)
    const { data: configData, error: configError } = await supabase
      .from('tb_governance_configs')
      .select('*')
      .eq('companies_id', companiesId)
      .single()

    if (configError) {
      logger.error('[getGovernanceConfig] Erro ao buscar configuração:', configError)
      return null
    }

    if (!configData) {
      logger.warn(`[getGovernanceConfig] Configuração não encontrada para companies_id: ${companiesId}`)
      return null
    }

    // Mapear campos do banco (snake_case) para interface (camelCase)
    const config: GovernanceConfig = {
      safetyThresholds: {
        hateSpeech: configData.hate_speech_threshold || 80,
        sexualContent: configData.sexual_content_threshold || 95,
        dangerousContent: configData.dangerous_content_threshold || 90
      },
      filters: {
        competitorBlocking: configData.competitor_blocking ?? true,
        antiHallucination: configData.anti_hallucination ?? GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
        jailbreakProtection: configData.jailbreak_protection ?? GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
        blockTechnicalCodeRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockTechnicalCodeRequests,
        blockSuspiciousRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockSuspiciousRequests,
        blockSensitiveOperationalInfo: GOVERNANCE_RECOMMENDED_FILTERS.blockSensitiveOperationalInfo,
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
    }

    const effective = mergeGovernanceSecureDefaults(config)

    // Atualizar cache com config já efetiva (DLP sempre on, etc.)
    governanceCache.set(companiesId, {
      config: effective,
      expiresAt: Date.now() + CACHE_TTL_MS
    })

    logger.log(`[getGovernanceConfig] ✅ Configuração carregada e cache atualizado para companies_id: ${companiesId}`)
    return effective
  } catch (err: any) {
    logger.error('[getGovernanceConfig] Erro:', err)
    return null
  }
}

/**
 * Obtém configuração de governança por email (com cache)
 * @param email Email do usuário
 * @param forceRefresh Força atualização do cache
 * @returns Configuração de governança ou null
 */
export async function getGovernanceConfigByEmail(
  email: string,
  forceRefresh: boolean = false
): Promise<GovernanceConfig | null> {
  try {
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      logger.warn(`[getGovernanceConfigByEmail] companies_id não encontrado para email: ${email}`)
      return null
    }

    return await getGovernanceConfig(companiesId, forceRefresh)
  } catch (err: any) {
    logger.error('[getGovernanceConfigByEmail] Erro:', err)
    return null
  }
}

/**
 * Limpa o cache de governança para uma empresa específica
 * @param companiesId ID da empresa
 */
export function clearGovernanceCache(companiesId: string): void {
  governanceCache.delete(companiesId)
  logger.log(`[clearGovernanceCache] ✅ Cache limpo para companies_id: ${companiesId}`)
}

/**
 * Limpa todo o cache de governança
 */
export function clearAllGovernanceCache(): void {
  governanceCache.clear()
  logger.log('[clearAllGovernanceCache] ✅ Todo o cache de governança foi limpo')
}
