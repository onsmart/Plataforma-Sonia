import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/** Mesmo sentido da UI: sem expurgo automático. */
const RETENTION_ETERNAL_DAYS = 9999

/** Defaults alinhados ao GET /governance quando não há linha em tb_governance_configs */
const DEFAULT_CHAT_LOG_DAYS = 90
const DEFAULT_VOICE_DAYS = 30

type GovernanceRow = {
  companies_id: string
  chat_logs_retention_days: number | null
  voice_retention_days: number | null
}

async function loadIntegrationIdsForCompany(companiesId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id')
    .eq('companies_id', companiesId)

  if (error) {
    logger.warn('[governance-retention] Falha ao listar integrações da empresa', {
      companiesId,
      error: error.message,
    })
    return []
  }

  return (data || []).map((r) => r.id).filter(Boolean)
}

function cutoffIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function deleteWhatsAppMessagesChunked(
  integrationIds: string[],
  olderThanIso: string,
  extraEq?: { column: string; value: string }
): Promise<number> {
  if (integrationIds.length === 0) return 0

  const chunkSize = 30
  let removed = 0

  for (let i = 0; i < integrationIds.length; i += chunkSize) {
    const chunk = integrationIds.slice(i, i + chunkSize)
    let q = supabase
      .from('tb_whatsapp_messages')
      .delete({ count: 'exact' })
      .in('integrations_id', chunk)
      .lt('created_at', olderThanIso)

    if (extraEq) {
      q = q.eq(extraEq.column, extraEq.value)
    }

    const { error, count } = await q

    if (error) {
      logger.warn('[governance-retention] Erro ao expurgar tb_whatsapp_messages', {
        error: error.message,
        chunkSize: chunk.length,
      })
    } else {
      removed += count ?? 0
    }
  }

  return removed
}

async function deleteTokenUsageForCompany(companiesId: string, olderThanIso: string): Promise<number> {
  const { error, count } = await supabase
    .from('tb_agent_token_usage')
    .delete({ count: 'exact' })
    .eq('companies_id', companiesId)
    .lt('created_at', olderThanIso)

  if (error) {
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      logger.log('[governance-retention] tb_agent_token_usage sem created_at — ignorando expurgo de tokens')
      return 0
    }
    logger.warn('[governance-retention] Erro ao expurgar tb_agent_token_usage', {
      companiesId,
      error: error.message,
    })
    return 0
  }

  return count ?? 0
}

/**
 * Aplica políticas de retenção para uma empresa (logs de chat + uso de tokens + mensagens de áudio).
 */
export async function purgeRetentionForCompany(
  companiesId: string,
  chatLogDays: number,
  voiceDays: number
): Promise<{ whatsappMessages: number; voiceMessages: number; tokenUsage: number }> {
  const integrationIds = await loadIntegrationIdsForCompany(companiesId)
  let whatsappMessages = 0
  let voiceMessages = 0
  let tokenUsage = 0

  if (voiceDays > 0 && voiceDays < RETENTION_ETERNAL_DAYS && integrationIds.length > 0) {
    const voiceCutoff = cutoffIso(voiceDays)
    voiceMessages += await deleteWhatsAppMessagesChunked(integrationIds, voiceCutoff, {
      column: 'message',
      value: '[Audio]',
    })
  }

  if (chatLogDays > 0 && chatLogDays < RETENTION_ETERNAL_DAYS) {
    const chatCutoff = cutoffIso(chatLogDays)
    if (integrationIds.length > 0) {
      whatsappMessages += await deleteWhatsAppMessagesChunked(integrationIds, chatCutoff)
    }
    tokenUsage += await deleteTokenUsageForCompany(companiesId, chatCutoff)
  }

  return { whatsappMessages, voiceMessages, tokenUsage }
}

/**
 * Carrega mapa companies_id → dias de retenção (ou defaults).
 */
async function loadGovernanceByCompany(): Promise<Map<string, { chat: number; voice: number }>> {
  const map = new Map<string, { chat: number; voice: number }>()

  const { data: govRows, error: govErr } = await supabase
    .from('tb_governance_configs')
    .select('companies_id, chat_logs_retention_days, voice_retention_days')

  if (govErr) {
    logger.warn('[governance-retention] Falha ao ler tb_governance_configs', { error: govErr.message })
  } else {
    for (const row of (govRows || []) as GovernanceRow[]) {
      if (!row.companies_id) continue
      map.set(row.companies_id, {
        chat: Number(row.chat_logs_retention_days ?? DEFAULT_CHAT_LOG_DAYS),
        voice: Number(row.voice_retention_days ?? DEFAULT_VOICE_DAYS),
      })
    }
  }

  const { data: integrations, error: intErr } = await supabase
    .from('tb_integrations')
    .select('companies_id')
    .not('companies_id', 'is', null)

  if (intErr) {
    logger.warn('[governance-retention] Falha ao listar empresas com integrações', {
      error: intErr.message,
    })
    return map
  }

  const companyIds = [...new Set((integrations || []).map((r: { companies_id: string }) => r.companies_id))]

  for (const cid of companyIds) {
    if (!map.has(cid)) {
      map.set(cid, { chat: DEFAULT_CHAT_LOG_DAYS, voice: DEFAULT_VOICE_DAYS })
    }
  }

  return map
}

let purgeRunning = false

/**
 * Executa expurgo para todas as empresas com integrações. Idempotente; seguro chamar em intervalo (ex.: diário).
 */
export async function runGovernanceRetentionPurge(): Promise<void> {
  if (purgeRunning) {
    logger.log('[governance-retention] Execução anterior ainda em curso — ignorando')
    return
  }
  purgeRunning = true
  const started = Date.now()

  try {
    const byCompany = await loadGovernanceByCompany()
    let totalWa = 0
    let totalVoice = 0
    let totalTok = 0

    for (const [companiesId, { chat, voice }] of byCompany) {
      const r = await purgeRetentionForCompany(companiesId, chat, voice)
      totalWa += r.whatsappMessages
      totalVoice += r.voiceMessages
      totalTok += r.tokenUsage
    }

    logger.log('[governance-retention] Purga concluída', {
      companies: byCompany.size,
      durationMs: Date.now() - started,
      tb_whatsapp_messages: totalWa,
      audio_placeholder_rows: totalVoice,
      tb_agent_token_usage: totalTok,
    })
  } catch (e: any) {
    logger.error('[governance-retention] Erro na purga global', { error: e?.message })
  } finally {
    purgeRunning = false
  }
}
