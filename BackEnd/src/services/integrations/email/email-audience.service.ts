import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import { AudienceContact } from '../../flows/flow.types'
import { sendEmail } from './email.service'

const EMAIL_AUDIENCE_TABLE = 'tb_email_audience_jobs'

function renderTemplate(value: string, contact: AudienceContact): string {
  const properties = (contact.properties || {}) as Record<string, unknown>
  const replacements: Record<string, string> = {
    firstname: String(contact.firstname || properties.firstname || '').trim(),
    lastname: String(contact.lastname || properties.lastname || '').trim(),
    name:
      String(contact.name || '').trim() ||
      [String(contact.firstname || '').trim(), String(contact.lastname || '').trim()].filter(Boolean).join(' '),
    email: String(contact.email || properties.email || '').trim(),
    phone: String(contact.phone || properties.phone || '').trim(),
    company: String(properties.company || '').trim()
  }

  return String(value || '').replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (replacements[key] !== undefined) {
      return replacements[key]
    }
    const dynamic = properties[key]
    if (dynamic === undefined || dynamic === null) return ''
    return typeof dynamic === 'string' ? dynamic : String(dynamic)
  })
}

export async function enqueueEmailAudienceJobs(params: {
  emailIntegrationId: string
  audienceContacts: AudienceContact[]
  subjectTemplate: string
  textTemplate: string
  flowId?: string
  executionId?: string
  companiesId?: string | null
  scheduledAtIso?: string
}): Promise<{
  inserted: number
  skippedWithoutEmail: number
}> {
  const scheduledAt = String(params.scheduledAtIso || '').trim() || new Date().toISOString()
  const rows: Array<Record<string, unknown>> = []
  let skippedWithoutEmail = 0

  for (const contact of params.audienceContacts || []) {
    const recipientEmail = String(contact.email || '').trim()
    if (!recipientEmail) {
      skippedWithoutEmail++
      continue
    }

    rows.push({
      companies_id: params.companiesId || null,
      integrations_id: params.emailIntegrationId,
      flow_id: params.flowId || null,
      execution_id: params.executionId || null,
      external_contact_id: contact.external_id,
      recipient_email: recipientEmail,
      recipient_name: String(contact.name || '').trim() || null,
      subject: renderTemplate(params.subjectTemplate, contact),
      text: renderTemplate(params.textTemplate, contact),
      status: 'pending',
      scheduled_at: scheduledAt
    })
  }

  if (rows.length === 0) {
    return {
      inserted: 0,
      skippedWithoutEmail
    }
  }

  const { data, error } = await supabase
    .from(EMAIL_AUDIENCE_TABLE)
    .insert(rows)
    .select('id')

  if (error) {
    logger.error('[email-audience] Falha ao enfileirar jobs de email', { error: error.message })
    throw new Error(error.message)
  }

  return {
    inserted: Array.isArray(data) ? data.length : rows.length,
    skippedWithoutEmail
  }
}

export async function processEmailAudienceJobsOnce(maxJobs: number): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  const { data, error } = await supabase
    .from(EMAIL_AUDIENCE_TABLE)
    .select('id, integrations_id, recipient_email, subject, text')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(maxJobs)

  if (error || !Array.isArray(data) || data.length === 0) {
    return { processed: 0, errors: 0 }
  }

  for (const job of data as Array<Record<string, unknown>>) {
    const jobId = String(job.id || '').trim()
    if (!jobId) continue

    try {
      await sendEmail(String(job.integrations_id || '').trim(), {
        to: String(job.recipient_email || '').trim(),
        subject: String(job.subject || ''),
        text: String(job.text || '')
      })

      await supabase
        .from(EMAIL_AUDIENCE_TABLE)
        .update({ status: 'sent', processed_at: new Date().toISOString(), last_error: null })
        .eq('id', jobId)
      processed++
    } catch (jobError: any) {
      await supabase
        .from(EMAIL_AUDIENCE_TABLE)
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          last_error: jobError?.message || 'Erro ao enviar email'
        })
        .eq('id', jobId)
      errors++
    }
  }

  return { processed, errors }
}
