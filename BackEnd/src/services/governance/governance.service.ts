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
        antiHallucination: configData.anti_hallucination ?? true,
        jailbreakProtection: configData.jailbreak_protection ?? true
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

    // Atualizar cache
    governanceCache.set(companiesId, {
      config,
      expiresAt: Date.now() + CACHE_TTL_MS
    })

    logger.log(`[getGovernanceConfig] ✅ Configuração carregada e cache atualizado para companies_id: ${companiesId}`)
    return config
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
