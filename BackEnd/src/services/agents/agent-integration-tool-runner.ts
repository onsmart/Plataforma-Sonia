import { getRedisClient } from '../../lib/redis'
import {
  type AgentExtraFeaturesV2,
  type AgentToolEntry,
  getEnabledTools,
  parseAgentExtraFeatures,
  parseToolKey,
} from './agent-extra-features'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import type { IntegrationToolExecutionResult } from '../integrations/toolkit/toolkit.types'

const LOOKUP_CACHE_TTL_SEC = 30 * 24 * 60 * 60

function lookupCacheKey(agentId: string, contactId: string): string {
  return `agent:calendly_lookup:${agentId}:${contactId}`
}

async function saveLastCalendlyLookup(
  agentId: string,
  contactId: string,
  record: { appointmentId: string; integrationId: string; patientEmail?: string; startsAt?: string }
): Promise<void> {
  if (!agentId || !contactId || !record.appointmentId) return
  try {
    const client = await getRedisClient()
    await client.setEx(lookupCacheKey(agentId, contactId), LOOKUP_CACHE_TTL_SEC, JSON.stringify(record))
  } catch {
    // noop
  }
}

async function loadLastCalendlyLookup(
  agentId: string,
  contactId: string
): Promise<{ appointmentId: string; integrationId: string; patientEmail?: string; startsAt?: string } | null> {
  if (!agentId || !contactId) return null
  try {
    const client = await getRedisClient()
    const raw = await client.get(lookupCacheKey(agentId, contactId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { appointmentId?: string; integrationId?: string }
    return parsed?.appointmentId ? (parsed as { appointmentId: string; integrationId: string }) : null
  } catch {
    return null
  }
}

async function clearLastCalendlyLookup(agentId: string, contactId: string): Promise<void> {
  if (!agentId || !contactId) return
  try {
    const client = await getRedisClient()
    await client.del(lookupCacheKey(agentId, contactId))
  } catch {
    // noop
  }
}

/** Remove frases-meta que o LLM coloca em message ao chamar integration_tool (nao deve ir ao WhatsApp). */
export function stripSchedulingMetaPreamble(text: string): string {
  let t = String(text || '').trim()
  if (!t) return ''

  const globalPatterns = [
    /por favor,?\s*aguarde[^.!?\n]*(?:verific|consult|hor[aá]rio)[^.!?\n]*[.!?]?\s*/gi,
    /(?:vou|irei)\s+(?:verificar|consultar)[^.!?\n]*(?:hor[aá]rio|disponib|agenda|livres?)[^.!?\n]*[.!?]?\s*/gi,
    /aguarde[^.!?\n]*(?:verific|consult)[^.!?\n]*(?:hor[aá]rio|livres?)?[^.!?\n]*[.!?]?\s*/gi,
    /(?:um\s+)?momento[^.!?\n]*(?:verific|consult)[^.!?\n]*[.!?]?\s*/gi,
    /consultando[^.!?\n]*(?:hor[aá]rio|disponib|agenda|livres?)?[^.!?\n]*[.!?]?\s*/gi,
    /verificar\s+quais\s+s[aã]o\s+os\s+hor[aá]rios\s+livres[^.!?\n]*[.!?]?\s*/gi,
  ]
  for (const p of globalPatterns) {
    t = t.replace(p, ' ').trim()
  }

  const lineStartPatterns = [
    /^vou verificar[^.!?\n]*[.!?]?\s*/i,
    /^deixa eu (verificar|consultar)[^.!?\n]*[.!?]?\s*/i,
    /^aguarde[^.!?\n]*[.!?]?\s*/i,
    /^um momento[^.!?\n]*[.!?]?\s*/i,
    /^consultando[^.!?\n]*[.!?]?\s*/i,
  ]
  for (const p of lineStartPatterns) {
    t = t.replace(p, '').trim()
  }

  return t.replace(/\s{2,}/g, ' ').trim()
}

const BLOCKED_SCHEDULING_SENTENCE =
  /vou verificar|verificar a disponibilidade|verificar.*disponib|deixa eu consultar|aguarde|um momento|consultando|nossos hor[aá]rios|segunda a sexta|das 9h|9h.{0,6}18h/i

export const SCHEDULING_ASK_DATETIME_REPLY =
  'Qual *dia e horário* é melhor para você para a reunião?'

function stripSchedulingMetaSentences(text: string): string {
  const parts = String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const kept = parts.filter((p) => !BLOCKED_SCHEDULING_SENTENCE.test(p))
  return kept.join(' ').trim()
}

/** Limpa respostas reply do LLM quando o agente usa Calendly (evita "vou verificar…"). */
export function sanitizeSchedulingOutboundReply(text: string): string {
  const original = String(text || '').trim()
  if (!original) return ''

  let t = stripSchedulingMetaPreamble(original)
  t = stripSchedulingMetaSentences(t)
  t = t.replace(/\s{2,}/g, ' ').trim()

  const hadBlocked = BLOCKED_SCHEDULING_SENTENCE.test(original)
  const asksDateTime = /\b(dia|hor[aá]rio|horario)\b/i.test(t)

  if (!t && hadBlocked) {
    return SCHEDULING_ASK_DATETIME_REPLY
  }

  if (hadBlocked && !asksDateTime) {
    return t ? `${t}\n\n${SCHEDULING_ASK_DATETIME_REPLY}` : SCHEDULING_ASK_DATETIME_REPLY
  }

  return t || original
}

function shouldDropLlmPreambleForTool(toolKey: string): boolean {
  return String(toolKey || '').toLowerCase().startsWith('calendly.')
}

function formatSlotWhen(startsAt: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(startsAt))
  } catch {
    return startsAt
  }
}

function findEnabledTool(extra: AgentExtraFeaturesV2 | null, toolKey: string): AgentToolEntry | null {
  const normalized = String(toolKey || '').trim().toLowerCase()
  return getEnabledTools(extra).find((t) => (t.toolKey || '').toLowerCase() === normalized) || null
}

function parseToolPayload(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  const text = String(raw).trim()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return {}
  }
}

function enrichPayload(
  toolEntry: AgentToolEntry,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...payload }
  if (toolEntry.provider === 'calendly' && toolEntry.integrationId && !merged.integrationId) {
    merged.integrationId = toolEntry.integrationId
  }
  if (toolEntry.provider === 'hubspot' && toolEntry.crmIntegrationId && !merged.crmIntegrationId) {
    merged.crmIntegrationId = toolEntry.crmIntegrationId
  }
  if (toolEntry.config?.specialty && !merged.specialty) {
    merged.specialty = toolEntry.config.specialty
  }
  return merged
}

function formatToolResultForUser(
  toolKey: string,
  result: IntegrationToolExecutionResult,
  preamble: string
): string {
  const parts: string[] = []
  if (!shouldDropLlmPreambleForTool(toolKey)) {
    const cleanedPreamble = stripSchedulingMetaPreamble(preamble)
    if (cleanedPreamble) parts.push(cleanedPreamble)
  }

  if (!result.success) {
    parts.push(result.userSafeMessage || 'Não foi possível concluir a operação no momento.')
    return parts.join('\n\n')
  }

  const data = result.data || {}

  if (toolKey === 'calendly.check_availability') {
    const slots = (data.slots || []) as Array<{ slotId?: string; startsAt?: string }>
    if (slots.length === 0) {
      parts.push('Não encontrei horários livres para essa data. Pode sugerir outro dia ou horário?')
      return parts.join('\n\n')
    }
    const lines = slots.slice(0, 8).map((slot, i) => {
      const when = slot.startsAt ? formatSlotWhen(slot.startsAt) : 'horário'
      return `${i + 1}. ${when}`
    })
    parts.push('Horários disponíveis:\n\n' + lines.join('\n'))
    parts.push('Peça ao contato para escolher o *número* da opção ou informar outro horário.')
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.list_upcoming_appointments') {
    const appointments = (data.appointments || []) as Array<{
      appointmentId?: string
      slot?: { startsAt?: string }
    }>
    const first = appointments[0]
    if (!first?.slot?.startsAt) {
      parts.push('Não encontrei reunião ativa no Calendly com os dados informados.')
      return parts.join('\n\n')
    }
    parts.push(`Próxima reunião: *${formatSlotWhen(first.slot.startsAt)}*.`)
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.cancel_appointment') {
    parts.push(result.userSafeMessage || 'Reunião cancelada no Calendly.')
    return parts.join('\n\n')
  }

  if (toolKey === 'calendly.book_appointment') {
    const appointment = data.appointment as { slot?: { startsAt?: string } } | undefined
    const when = appointment?.slot?.startsAt
      ? formatSlotWhen(appointment.slot.startsAt)
      : 'horário confirmado'
    parts.push(`Reunião *confirmada* no Calendly para ${when}.`)
    return parts.join('\n\n')
  }

  parts.push(result.userSafeMessage || 'Operação concluída.')
  return parts.join('\n\n')
}

export async function runAgentIntegrationToolFromLlm(input: {
  agentExtraFeatures: unknown
  toolKey: string
  toolPayload: unknown
  userMessage?: string
  agentId?: string
  contactId?: string
}): Promise<{ ok: boolean; reply: string }> {
  const extra = parseAgentExtraFeatures(input.agentExtraFeatures)
  const toolKey = String(input.toolKey || '').trim().toLowerCase()
  const parsed = parseToolKey(toolKey)

  if (!parsed) {
    return { ok: false, reply: 'Ferramenta inválida. Use o tool_key listado nas ferramentas ativas.' }
  }

  const toolEntry = findEnabledTool(extra, toolKey)
  if (!toolEntry) {
    return {
      ok: false,
      reply: `A ferramenta *${toolKey}* não está ativa neste agente. Ative-a nas configurações do agente.`,
    }
  }

  const payload = enrichPayload(toolEntry, parseToolPayload(input.toolPayload))
  const agentId = String(input.agentId || '').trim()
  const contactId = String(input.contactId || '').trim()

  if (toolKey === 'calendly.check_availability') {
    const preferredDate = String(payload.preferredDate || '').trim()
    if (!preferredDate) {
      return {
        ok: false,
        reply:
          'Qual *dia e horário* você prefere para a reunião? (ex.: 25/05/2026 às 15:00)',
      }
    }
  }

  if (
    toolKey === 'calendly.cancel_appointment' &&
    !payload.appointmentId &&
    agentId &&
    contactId
  ) {
    const cached = await loadLastCalendlyLookup(agentId, contactId)
    if (cached?.appointmentId) {
      payload.appointmentId = cached.appointmentId
      if (!payload.integrationId && cached.integrationId) {
        payload.integrationId = cached.integrationId
      }
    }
  }

  try {
    const result = await executeIntegrationTool({
      provider: parsed.provider,
      toolName: parsed.toolName,
      payload,
    })

    if (
      toolKey === 'calendly.list_upcoming_appointments' &&
      result.success &&
      agentId &&
      contactId
    ) {
      const appointments = (result.data?.appointments || []) as Array<{
        appointmentId?: string
        slot?: { startsAt?: string }
      }>
      const first = appointments[0]
      if (first?.appointmentId && toolEntry.integrationId) {
        await saveLastCalendlyLookup(agentId, contactId, {
          appointmentId: first.appointmentId,
          integrationId: toolEntry.integrationId,
          patientEmail:
            typeof payload.patientEmail === 'string' ? payload.patientEmail : undefined,
          startsAt: first.slot?.startsAt,
        })
      }
    }

    if (toolKey === 'calendly.cancel_appointment' && result.success && agentId && contactId) {
      await clearLastCalendlyLookup(agentId, contactId)
    }

    const reply = formatToolResultForUser(toolKey, result, String(input.userMessage || ''))
    return { ok: result.success, reply }
  } catch (error: any) {
    return {
      ok: false,
      reply: `Erro ao executar ${toolKey}: ${String(error?.message || error).slice(0, 200)}`,
    }
  }
}
