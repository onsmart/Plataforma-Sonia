import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

export type ServiceSessionEndReason = 'flow_completed' | 'inactivity' | 'restart' | 'manual'

export type ServiceSessionRow = {
  id: string
  companies_id: string
  integrations_id: string
  whatsapp_contact_id: string
  status: 'open' | 'closed'
  started_at: string
  ended_at: string | null
  last_inbound_at: string
  end_reason: ServiceSessionEndReason | null
  billing_month: string
}

export type ResolveInboundSessionParams = {
  companiesId: string
  integrationId: string
  whatsappContactId: string
  inboundAt?: Date
  inboundMessage?: string
}

export type ResolveInboundSessionResult = {
  blocked: boolean
  continuing: boolean
  sessionId?: string
  reason?: string
  conversationsUsed?: number
  conversationsLimit?: number | null
  newlyOpened?: boolean
}

const FLOW_RESTART_MESSAGE_PATTERNS: RegExp[] = [
  /^\s*(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite)\s*[!?.…]*\s*$/i,
  /^\s*(menu|inicio|recomecar|reiniciar|voltar|comecar de novo|novo atendimento)\s*[!?.…]*\s*$/i,
]

function isRestartInboundMessage(message: unknown): boolean {
  const text = String(message ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!text) return false
  return FLOW_RESTART_MESSAGE_PATTERNS.some((pattern) => pattern.test(text))
}

/** Tempo sem inbound antes de fechar sessão aberta (padrão: 1 minuto). */
function getInactivityMs(): number {
  const minutesRaw = process.env.ATENDIMENTO_INACTIVITY_MINUTES
  if (minutesRaw !== undefined && minutesRaw !== '') {
    const minutes = Number(minutesRaw)
    if (Number.isFinite(minutes) && minutes > 0) {
      return minutes * 60 * 1000
    }
  }
  const hoursRaw = process.env.ATENDIMENTO_INACTIVITY_HOURS
  if (hoursRaw !== undefined && hoursRaw !== '') {
    const hours = Number(hoursRaw)
    if (Number.isFinite(hours) && hours > 0) {
      return hours * 60 * 60 * 1000
    }
  }
  return 60 * 1000
}

export function getBillingMonthStart(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  return start.toISOString().split('T')[0]
}

export async function closeStaleSessions(companiesId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - getInactivityMs()).toISOString()

  let query = supabase
    .from('tb_service_sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
      end_reason: 'inactivity',
    })
    .eq('status', 'open')
    .lt('last_inbound_at', cutoff)
    .select('id')

  if (companiesId) {
    query = query.eq('companies_id', companiesId)
  }

  const { data, error } = await query
  if (error) {
    logger.warn('[service-session] closeStaleSessions erro', { error: error.message, companiesId })
    return 0
  }
  return (data || []).length
}

export async function getOpenSession(
  integrationId: string,
  whatsappContactId: string
): Promise<ServiceSessionRow | null> {
  const { data, error } = await supabase
    .from('tb_service_sessions')
    .select('*')
    .eq('integrations_id', integrationId)
    .eq('whatsapp_contact_id', whatsappContactId)
    .eq('status', 'open')
    .maybeSingle()

  if (error) {
    logger.warn('[service-session] getOpenSession erro', { error: error.message })
    return null
  }
  return (data as ServiceSessionRow) || null
}

export async function closeSession(
  sessionId: string,
  reason: ServiceSessionEndReason
): Promise<void> {
  const { error } = await supabase
    .from('tb_service_sessions')
    .update({
      status: 'closed',
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq('id', sessionId)
    .eq('status', 'open')

  if (error) {
    logger.warn('[service-session] closeSession erro', { sessionId, reason, error: error.message })
  }
}

export async function closeServiceSessionForContact(
  integrationId: string,
  whatsappContactId: string,
  reason: ServiceSessionEndReason
): Promise<void> {
  const open = await getOpenSession(integrationId, whatsappContactId)
  if (open?.id) {
    await closeSession(open.id, reason)
  }
}

async function touchOpenSession(sessionId: string, inboundAt: Date): Promise<void> {
  await supabase
    .from('tb_service_sessions')
    .update({ last_inbound_at: inboundAt.toISOString() })
    .eq('id', sessionId)
    .eq('status', 'open')
}

async function openSession(params: {
  companiesId: string
  integrationId: string
  whatsappContactId: string
  inboundAt: Date
}): Promise<ServiceSessionRow | null> {
  const billingMonth = getBillingMonthStart(params.inboundAt)
  const { data, error } = await supabase
    .from('tb_service_sessions')
    .insert({
      companies_id: params.companiesId,
      integrations_id: params.integrationId,
      whatsapp_contact_id: params.whatsappContactId,
      status: 'open',
      started_at: params.inboundAt.toISOString(),
      last_inbound_at: params.inboundAt.toISOString(),
      billing_month: billingMonth,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      const existing = await getOpenSession(params.integrationId, params.whatsappContactId)
      return existing
    }
    logger.error('[service-session] openSession erro', { error: error.message })
    return null
  }
  return (data as ServiceSessionRow) || null
}

export async function getMonthlyAtendimentoCount(companiesId: string, at?: Date): Promise<number> {
  const billingMonth = getBillingMonthStart(at)
  const { count, error } = await supabase
    .from('tb_service_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('companies_id', companiesId)
    .eq('billing_month', billingMonth)

  if (error) {
    logger.warn('[service-session] getMonthlyAtendimentoCount erro', { error: error.message })
    return 0
  }
  return count || 0
}

export async function resolveInboundSession(
  params: ResolveInboundSessionParams
): Promise<ResolveInboundSessionResult> {
  const inboundAt = params.inboundAt || new Date()
  const contactId = String(params.whatsappContactId || '').trim()
  const integrationId = String(params.integrationId || '').trim()
  const companiesId = String(params.companiesId || '').trim()

  if (!contactId || !integrationId || !companiesId) {
    return { blocked: true, continuing: false, reason: 'Parâmetros de sessão inválidos.' }
  }

  await closeStaleSessions(companiesId)

  let open = await getOpenSession(integrationId, contactId)
  const wantsRestart = isRestartInboundMessage(params.inboundMessage)

  if (open && wantsRestart) {
    await closeSession(open.id, 'restart')
    open = null
  }

  if (open) {
    await touchOpenSession(open.id, inboundAt)
    const used = await getMonthlyAtendimentoCount(companiesId, inboundAt)
    return {
      blocked: false,
      continuing: true,
      sessionId: open.id,
      conversationsUsed: used,
    }
  }

  const { canStartNewAtendimento } = await import('../utils/plan-helper')
  const gate = await canStartNewAtendimento(companiesId)
  if (!gate.allowed) {
    return {
      blocked: true,
      continuing: false,
      reason: gate.reason,
      conversationsUsed: gate.conversationsUsed,
      conversationsLimit: gate.conversationsLimit,
    }
  }

  const created = await openSession({
    companiesId,
    integrationId,
    whatsappContactId: contactId,
    inboundAt,
  })

  if (!created) {
    const retryOpen = await getOpenSession(integrationId, contactId)
    if (retryOpen) {
      await touchOpenSession(retryOpen.id, inboundAt)
      return {
        blocked: false,
        continuing: true,
        sessionId: retryOpen.id,
        conversationsUsed: gate.conversationsUsed,
        conversationsLimit: gate.conversationsLimit,
      }
    }
    return { blocked: true, continuing: false, reason: 'Não foi possível abrir sessão de atendimento.' }
  }

  const used = await getMonthlyAtendimentoCount(companiesId, inboundAt)
  return {
    blocked: false,
    continuing: false,
    newlyOpened: true,
    sessionId: created.id,
    conversationsUsed: used,
    conversationsLimit: gate.conversationsLimit,
  }
}
