import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { canUseGovernance } from '../../utils/plan-helper'
import { clearGovernanceCache } from '../../services/governance'
import { applyPreProcessing } from '../../services/governance/governance-preprocessing'
import {
  mergeGovernanceSecureDefaults,
  getGovernanceConfig as loadGovernanceConfigForCompany,
  FALLBACK_GOVERNANCE_FOR_PREPROCESS,
  GOVERNANCE_RECOMMENDED_FILTERS,
  type GovernanceConfig,
} from '../../services/governance/governance.service'
import logger from '../../lib/logger'

function mapRowToGovernanceConfig(configData: Record<string, unknown>): GovernanceConfig {
  return {
    safetyThresholds: {
      hateSpeech:
        configData.hate_speech_threshold != null ? Number(configData.hate_speech_threshold) : 100,
      sexualContent:
        configData.sexual_content_threshold != null ? Number(configData.sexual_content_threshold) : 100,
      dangerousContent:
        configData.dangerous_content_threshold != null ? Number(configData.dangerous_content_threshold) : 100,
    },
    filters: {
      competitorBlocking: false,
      antiHallucination:
        configData.anti_hallucination != null
          ? Boolean(configData.anti_hallucination)
          : GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
      jailbreakProtection:
        configData.jailbreak_protection != null
          ? Boolean(configData.jailbreak_protection)
          : GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
    },
    dlp: {
      creditCard: configData.mask_credit_cards != null ? Boolean(configData.mask_credit_cards) : true,
      ssn: configData.mask_ssn != null ? Boolean(configData.mask_ssn) : true,
      email: configData.mask_emails != null ? Boolean(configData.mask_emails) : true,
      phone: configData.mask_phone != null ? Boolean(configData.mask_phone) : true,
    },
    retention: {
      chatLogsRetentionDays:
        configData.chat_logs_retention_days != null ? Number(configData.chat_logs_retention_days) : 90,
      voiceRetentionDays:
        configData.voice_retention_days != null ? Number(configData.voice_retention_days) : 30,
    },
  }
}

function toApiJson(config: GovernanceConfig, lastUpdated?: string) {
  const merged = mergeGovernanceSecureDefaults(config)
  return {
    safetyThresholds: merged.safetyThresholds,
    filters: merged.filters,
    dlp: merged.dlp,
    retention: merged.retention,
    ...(lastUpdated ? { lastUpdated } : {}),
  }
}

/**
 * Busca configuração de governança
 * GET /governance
 */
export async function getGovernanceConfig(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.query.email as string

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    // Buscar companies_id
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa'
      })
    }

    // Buscar configuração
    const { data: configData, error: configError } = await supabase
      .from('tb_governance_configs')
      .select('*')
      .eq('companies_id', companiesId)
      .maybeSingle()

    if (configError) {
      logger.error('[getGovernanceConfig] Erro ao buscar configuração:', configError)
      return res.status(500).json({
        error: 'Erro ao buscar configuração',
        details: configError.message
      })
    }

    // Log para debug
    logger.log(`[getGovernanceConfig] Dados do banco para companies_id ${companiesId}:`, JSON.stringify(configData, null, 2))

    // Se não existe, retorna configuração padrão (segura)
    if (!configData) {
      const defaultConfig: GovernanceConfig = {
        safetyThresholds: { hateSpeech: 100, sexualContent: 100, dangerousContent: 100 },
        filters: {
          competitorBlocking: false,
          antiHallucination: GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination,
          jailbreakProtection: GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection,
        },
        dlp: { creditCard: true, ssn: true, email: true, phone: true },
        retention: { chatLogsRetentionDays: 90, voiceRetentionDays: 30 },
      }
      return res.json(toApiJson(defaultConfig))
    }

    const config = mapRowToGovernanceConfig(configData as Record<string, unknown>)
    const payload = toApiJson(config, configData.updated_at as string | undefined)

    logger.log(`[getGovernanceConfig] Configuração convertida:`, JSON.stringify(payload, null, 2))
    return res.json(payload)
  } catch (error: any) {
    logger.error('[getGovernanceConfig] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao buscar configuração',
      details: error.message
    })
  }
}

/**
 * Atualiza configuração de governança
 * PUT /governance
 */
export async function updateGovernanceConfig(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email || req.headers['x-user-email'] as string

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    // Buscar companies_id
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa'
      })
    }

    // Verificar se o plano permite Governance
    const checkResult = await canUseGovernance(companiesId)
    if (!checkResult.allowed) {
      logger.warn('[updateGovernanceConfig] 🚫 Governance não permitido:', {
        companiesId,
        reason: checkResult.reason
      })
      return res.status(403).json({
        error: checkResult.reason || 'A funcionalidade Governance está disponível apenas no plano Enterprise.',
        upgradePlan: 'enterprise'
      })
    }

    const { filters, retention } = req.body

    // Preparar payload para atualização
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      // Moderação base e DLP sempre no máximo no armazenamento (UI não expõe mais toggles fracos)
      hate_speech_threshold: 100,
      sexual_content_threshold: 100,
      dangerous_content_threshold: 100,
      competitor_blocking: false,
      mask_credit_cards: true,
      mask_ssn: true,
      mask_emails: true,
      mask_phone: true,
    }

    if (filters) {
      updatePayload.anti_hallucination = Boolean(filters.antiHallucination)
      updatePayload.jailbreak_protection = Boolean(filters.jailbreakProtection)
    } else {
      updatePayload.anti_hallucination = GOVERNANCE_RECOMMENDED_FILTERS.antiHallucination
      updatePayload.jailbreak_protection = GOVERNANCE_RECOMMENDED_FILTERS.jailbreakProtection
    }

    if (retention) {
      updatePayload.chat_logs_retention_days = retention.chatLogsRetentionDays
      updatePayload.voice_retention_days = retention.voiceRetentionDays
    }

    // Verificar se já existe configuração
    const { data: existingConfig } = await supabase
      .from('tb_governance_configs')
      .select('id')
      .eq('companies_id', companiesId)
      .maybeSingle()

    let result
    if (existingConfig) {
      // Atualizar existente
      const { data, error: updateError } = await supabase
        .from('tb_governance_configs')
        .update(updatePayload)
        .eq('id', existingConfig.id)
        .eq('companies_id', companiesId)
        .select()
        .single()

      if (updateError) {
        logger.error('[updateGovernanceConfig] Erro ao atualizar:', updateError)
        return res.status(500).json({
          error: 'Erro ao atualizar configuração',
          details: updateError.message
        })
      }

      result = data
    } else {
      // Criar nova
      const { data, error: insertError } = await supabase
        .from('tb_governance_configs')
        .insert({
          companies_id: companiesId,
          ...updatePayload
        })
        .select()
        .single()

      if (insertError) {
        logger.error('[updateGovernanceConfig] Erro ao criar:', insertError)
        return res.status(500).json({
          error: 'Erro ao criar configuração',
          details: insertError.message
        })
      }

      result = data
    }

    // Limpar cache
    clearGovernanceCache(companiesId)

    const config = mapRowToGovernanceConfig(result as Record<string, unknown>)
    const payload = toApiJson(config, result.updated_at as string | undefined)

    logger.log(`[updateGovernanceConfig] ✅ Configuração atualizada com sucesso para companies_id: ${companiesId}`)
    return res.json(payload)
  } catch (error: any) {
    logger.error('[updateGovernanceConfig] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao atualizar configuração',
      details: error.message
    })
  }
}

/**
 * POST /governance/test — simula jailbreak (bloqueio real) ou explica anti-alucinação (só prompt).
 */
export async function postGovernanceTest(req: Request, res: Response) {
  try {
    const email = req.user?.email || (req.headers['x-user-email'] as string)
    if (!email) {
      return res.status(401).json({ error: 'Email é obrigatório' })
    }
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({ error: 'Empresa não encontrada' })
    }
    const planCheck = await canUseGovernance(companiesId)
    if (!planCheck.allowed) {
      return res.status(403).json({
        error: planCheck.reason || 'Governance disponível apenas no plano Enterprise.',
      })
    }

    const rule = String(req.body?.rule || '')
    const message = String(req.body?.message || '')

    if (rule === 'jailbreak') {
      let effective: GovernanceConfig | null = null
      try {
        effective = await loadGovernanceConfigForCompany(companiesId)
      } catch {
        effective = null
      }
      const cfg = effective ?? FALLBACK_GOVERNANCE_FOR_PREPROCESS
      const pre = applyPreProcessing(message, cfg)
      return res.json({
        blocked: pre.blocked,
        reason: pre.reason,
        layer: pre.reason === 'prompt_injection_critical' ? 'critical' : pre.blocked ? 'extended' : undefined,
      })
    }

    if (rule === 'antiHallucination') {
      return res.json({
        blocked: false,
        promptOnly: true,
        description:
          'A anti-alucinação não bloqueia mensagens do utilizador. Quando está ativa, o agente recebe instruções extra para privilegiar documentos (RAG) e o template de papel, e para não inventar dados da empresa.',
      })
    }

    return res.status(400).json({
      error: 'rule inválida',
      details: 'Use "jailbreak" ou "antiHallucination".',
    })
  } catch (error: any) {
    logger.error('[postGovernanceTest] Erro:', error)
    return res.status(500).json({ error: 'Erro ao testar', details: error.message })
  }
}
