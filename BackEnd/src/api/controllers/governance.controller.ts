import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { canUseGovernance } from '../../utils/plan-helper'
import { clearGovernanceCache } from '../../services/governance'
import { applyPreProcessing } from '../../services/governance/governance-preprocessing'
import { injectGovernanceRules } from '../../services/governance/governance-prompt'
import {
  mergeGovernanceSecureDefaults,
  getGovernanceConfig as loadGovernanceConfigForCompany,
  FALLBACK_GOVERNANCE_FOR_PREPROCESS,
  GOVERNANCE_RECOMMENDED_FILTERS,
  type GovernanceConfig,
} from '../../services/governance/governance.service'
import logger from '../../lib/logger'

const SIMULATION_BASE_AGENT_PROMPT = 'Você é um assistente de atendimento da empresa.'

function mergeGovernanceWithFilterPreview(
  base: GovernanceConfig,
  preview?: { antiHallucination?: boolean; jailbreakProtection?: boolean }
): GovernanceConfig {
  if (
    preview == null ||
    (typeof preview.antiHallucination !== 'boolean' && typeof preview.jailbreakProtection !== 'boolean')
  ) {
    return mergeGovernanceSecureDefaults(base)
  }
  return mergeGovernanceSecureDefaults({
    ...base,
    filters: {
      ...base.filters,
      ...(typeof preview.antiHallucination === 'boolean'
        ? { antiHallucination: preview.antiHallucination }
        : {}),
      ...(typeof preview.jailbreakProtection === 'boolean'
        ? { jailbreakProtection: preview.jailbreakProtection }
        : {}),
    },
  })
}

function extractAntiHallucinationSnippet(fullPrompt: string): string {
  const marker = 'REGRA CRÍTICA — ANTI-ALUCINAÇÃO:'
  const idx = fullPrompt.indexOf(marker)
  if (idx < 0) return ''
  const end = fullPrompt.indexOf('=== FIM DAS REGRAS DE GOVERNANÇA ===', idx)
  const slice = end > idx ? fullPrompt.slice(idx, end) : fullPrompt.slice(idx)
  return slice.trim().slice(0, 2000)
}

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
      blockTechnicalCodeRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockTechnicalCodeRequests,
      blockSuspiciousRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockSuspiciousRequests,
      blockSensitiveOperationalInfo: GOVERNANCE_RECOMMENDED_FILTERS.blockSensitiveOperationalInfo,
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
          blockTechnicalCodeRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockTechnicalCodeRequests,
          blockSuspiciousRequests: GOVERNANCE_RECOMMENDED_FILTERS.blockSuspiciousRequests,
          blockSensitiveOperationalInfo: GOVERNANCE_RECOMMENDED_FILTERS.blockSensitiveOperationalInfo,
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
 * POST /governance/test — simula pré-bloqueios de segurança (jailbreak, code_request, suspicious_request)
 * e anti-alucinação (injectGovernanceRules), com filtros dos interruptores atuais no body.
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
    const filtersPreview = req.body?.filters as
      | { antiHallucination?: boolean; jailbreakProtection?: boolean }
      | undefined

    let effective: GovernanceConfig | null = null
    try {
      effective = await loadGovernanceConfigForCompany(companiesId)
    } catch {
      effective = null
    }
    const stored = effective ?? FALLBACK_GOVERNANCE_FOR_PREPROCESS
    const merged = mergeGovernanceWithFilterPreview(stored, filtersPreview)

    if (rule === 'jailbreak' || rule === 'code_request' || rule === 'suspicious_request') {
      const pre = applyPreProcessing(message, merged)
      const layer =
        pre.reason === 'prompt_injection_critical'
          ? 'critical'
          : pre.blocked
            ? 'extended'
            : undefined

      const matchedRequestedRule =
        rule === 'jailbreak'
          ? pre.reason === 'prompt_injection_critical' || pre.reason === 'jailbreak_detected'
          : rule === 'code_request'
            ? pre.reason === 'technical_code_request' || pre.reason === 'sensitive_info_request'
            : pre.reason === 'suspicious_request'

      return res.json({
        blocked: pre.blocked,
        reason: pre.reason,
        layer,
        simulation: {
          rule,
          matchedRequestedRule,
          messageReachesAgent: !pre.blocked,
          usesSamePreProcessingAsChat: true,
          blockedResponsePreview: pre.blocked
            ? pre.response ||
              'Desculpe, não posso processar essa solicitação. Por favor, reformule sua pergunta de forma mais direta.'
            : undefined,
        },
      })
    }

    if (rule === 'antiHallucination') {
      const antiOn = Boolean(merged.filters.antiHallucination)
      const cfgForInjection = mergeGovernanceSecureDefaults(merged)
      const fullPrompt = injectGovernanceRules(SIMULATION_BASE_AGENT_PROMPT, cfgForInjection)
      const antiSnippet = antiOn ? extractAntiHallucinationSnippet(fullPrompt) : ''

      const userEcho = message.trim()
      let expectedBehavior =
        'A mensagem do utilizador não é bloqueada no pré-processamento (igual ao chat). O efeito da anti-alucinação aparece nas instruções do system prompt enviadas ao modelo.'

      if (!antiOn) {
        expectedBehavior =
          'Interruptor DESLIGADO: o bloco "REGRA CRÍTICA — ANTI-ALUCINAÇÃO" não é acrescentado (mantêm-se regras de tom/segurança). No agente, o modelo pode ser menos explícito em aderir só a RAG, template e skills para factos da empresa.'
      } else {
        expectedBehavior =
          'Interruptor LIGADO: o mesmo fluxo do chat (injectGovernanceRules em chatWithAgent) acrescenta anti-alucinação ao system prompt. Com RAG na conversa, o modelo deve priorizar esses trechos; sem RAG/skills/template para o pedido, deve evitar inventar dados da empresa e dizer que não tem a informação quando aplicável.'
      }

      if (userEcho) {
        const short = userEcho.length > 220 ? `${userEcho.slice(0, 220)}…` : userEcho
        expectedBehavior += ` Com o seu exemplo ${JSON.stringify(short)}, essa frase seguiria para o modelo; a resposta depende do RAG/skills/template, mas as regras acima orientam o comportamento.`
      }

      return res.json({
        blocked: false,
        promptOnly: true,
        simulation: {
          antiHallucinationActive: antiOn,
          messageBlockedAtInput: false,
          usesSameInjectionAsChat: true,
          extraPromptWhenActive: antiOn
            ? antiSnippet || '(bloco anti-alucinação ativo, mas texto não extraído)'
            : '(desligado — sem bloco anti-alucinação no prompt)',
          expectedBehavior,
          fullGovernancePromptLengthChars: fullPrompt.length,
        },
      })
    }

    return res.status(400).json({
      error: 'rule inválida',
      details: 'Use "jailbreak", "code_request", "suspicious_request" ou "antiHallucination".',
    })
  } catch (error: any) {
    logger.error('[postGovernanceTest] Erro:', error)
    return res.status(500).json({ error: 'Erro ao testar', details: error.message })
  }
}
