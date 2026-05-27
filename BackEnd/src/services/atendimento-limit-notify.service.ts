import { supabase } from '../lib/supabase'
import logger from '../lib/logger'
import { getPlanInfo } from '../utils/plan-helper'
import { getBillingMonthStart, getMonthlyAtendimentoCount } from './service-session.service'
import { isPlatformEmailConfigured, sendPlatformEmail } from './platform-email.service'

const LIMIT_REACHED_COPY =
  'Atualize seu plano para poder ter mais acesso a números de atendimentos, ou entre em contato conosco para uma possível recarga.'

type LimitNotificationRow = {
  id: string
  metadata: Record<string, unknown> | null
}

export async function getCompanyAdminEmails(companiesId: string): Promise<string[]> {
  const { data: members, error } = await supabase
    .from('tb_company_users')
    .select('role, tb_users!inner(email)')
    .eq('companies_id', companiesId)
    .in('role', ['owner', 'admin'])

  if (error) {
    logger.warn('[atendimento.limit] Falha ao buscar admins', { companiesId, error: error.message })
    return []
  }

  const emails = new Set<string>()
  for (const row of members || []) {
    const email = String((row as { tb_users?: { email?: string } }).tb_users?.email || '')
      .trim()
      .toLowerCase()
    if (email) emails.add(email)
  }
  return [...emails]
}

async function getLimitNotificationThisMonth(
  companiesId: string,
  billingMonth: string
): Promise<LimitNotificationRow | null> {
  const { data, error } = await supabase
    .from('tb_notifications')
    .select('id, metadata')
    .eq('companies_id', companiesId)
    .eq('type', 'plan_limit_atendimentos')
    .contains('metadata', { billing_month: billingMonth })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    logger.warn('[atendimento.limit] dedupe check erro', { error: error.message })
  }
  return (data as LimitNotificationRow) || null
}

function isLimitEmailMarkedSent(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.email_sent === true
}

async function markLimitEmailSent(notificationId: string): Promise<void> {
  const { data: row } = await supabase
    .from('tb_notifications')
    .select('metadata')
    .eq('id', notificationId)
    .maybeSingle()

  const metadata = {
    ...((row?.metadata as Record<string, unknown>) || {}),
    email_sent: true,
    email_sent_at: new Date().toISOString(),
  }

  await supabase.from('tb_notifications').update({ metadata }).eq('id', notificationId)
}

async function createInAppNotification(
  companiesId: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tb_notifications')
    .insert({
      companies_id: companiesId,
      type: 'plan_limit_atendimentos',
      title,
      body,
      read: false,
      metadata: { ...metadata, email_sent: false },
    })
    .select('id')
    .maybeSingle()

  if (error) {
    logger.warn('[atendimento.limit] Falha ao criar notificação in-app', {
      companiesId,
      error: error.message,
    })
    return null
  }
  return data?.id || null
}

async function sendLimitEmailsToAdmins(
  companiesId: string,
  payload: {
    subject: string
    text: string
    html: string
    planTitle: string
    used: number
    limit: number | null
  }
): Promise<boolean> {
  if (!isPlatformEmailConfigured()) {
    logger.warn(
      '[atendimento.limit.email] Resend não configurado (RESEND_API_KEY / RESEND_FROM_EMAIL no .env do backend)'
    )
    return false
  }

  const adminEmails = await getCompanyAdminEmails(companiesId)
  if (adminEmails.length === 0) {
    logger.warn('[atendimento.limit.email] Nenhum owner/admin com e-mail na empresa', { companiesId })
    return false
  }

  let anySent = false
  for (const adminEmail of adminEmails) {
    try {
      await sendPlatformEmail({
        to: adminEmail,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      })
      anySent = true
      logger.log('[atendimento.limit.email] E-mail enviado (Resend)', { companiesId, adminEmail })
    } catch (err: unknown) {
      logger.warn('[atendimento.limit.email] Falha ao enviar e-mail', {
        companiesId,
        adminEmail,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (!anySent) {
    logger.warn('[atendimento.limit.email] Nenhum e-mail entregue aos admins', {
      companiesId,
      planTitle: payload.planTitle,
      used: payload.used,
      limit: payload.limit,
    })
  }

  return anySent
}

export async function notifyAtendimentoLimitReached(
  companiesId: string,
  options?: { conversationsUsed?: number; conversationsLimit?: number | null }
): Promise<void> {
  const billingMonth = getBillingMonthStart()
  const planInfo = await getPlanInfo(companiesId)
  const used =
    typeof options?.conversationsUsed === 'number'
      ? options.conversationsUsed
      : await getMonthlyAtendimentoCount(companiesId)
  const limit = options?.conversationsLimit ?? planInfo.limits.conversations

  const title = 'Limite de atendimentos atingido'
  const body = `Você atingiu o limite de ${limit ?? '—'} atendimentos/mês do plano ${planInfo.planTitle} (${used}/${limit ?? '∞'}). ${LIMIT_REACHED_COPY}`

  const subject = `Limite de atendimentos atingido — ${planInfo.planTitle}`
  const text = `${body}\n\nPlano: ${planInfo.planTitle}\nUso: ${used}/${limit ?? 'ilimitado'}\n\nAcesse a plataforma Sonia para fazer upgrade ou solicitar recarga.`
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
      <p>${body}</p>
      <p><strong>Plano:</strong> ${planInfo.planTitle}<br/>
      <strong>Uso:</strong> ${used}/${limit ?? 'ilimitado'}</p>
      <p style="margin-top:1.5rem;font-size:14px;color:#64748b">Plataforma Sonia — notificação automática de plano.</p>
    </div>
  `

  const emailPayload = { subject, text, html, planTitle: planInfo.planTitle, used, limit }

  const existing = await getLimitNotificationThisMonth(companiesId, billingMonth)
  if (existing) {
    if (isLimitEmailMarkedSent(existing.metadata)) {
      logger.log('[atendimento.limit] In-app já existe e e-mail já enviado neste mês', {
        companiesId,
        billingMonth,
      })
      return
    }

    logger.log('[atendimento.limit] Reenviando e-mail pendente (notificação in-app já existia)', {
      companiesId,
      billingMonth,
      notificationId: existing.id,
    })
    const sent = await sendLimitEmailsToAdmins(companiesId, emailPayload)
    if (sent) {
      await markLimitEmailSent(existing.id)
    }
    return
  }

  const notificationId = await createInAppNotification(companiesId, title, body, {
    billing_month: billingMonth,
    conversations_used: used,
    conversations_limit: limit,
    plan: planInfo.plan,
  })

  const sent = await sendLimitEmailsToAdmins(companiesId, emailPayload)
  if (sent && notificationId) {
    await markLimitEmailSent(notificationId)
  }
}

export { LIMIT_REACHED_COPY }
