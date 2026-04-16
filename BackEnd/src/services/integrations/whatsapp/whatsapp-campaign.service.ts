import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import { sendWhatsAppTemplate } from './whatsapp.dispatcher'
import { isCampaignsEnabledForIntegration } from './whatsapp-feature-flags'

export type CampaignRow = {
  id: string
  integrations_id: string
  companies_id: string | null
  name: string
  template_name: string
  template_language: string
  components_json: unknown
  status: string
  rate_limit_per_minute: number
}

export async function createCampaignRecord(params: {
  integrationId: string
  companiesId: string | null
  name: string
  templateName: string
  templateLanguage: string
  components?: unknown[]
}): Promise<{ id: string } | { error: string }> {
  const ok = await isCampaignsEnabledForIntegration(params.integrationId)
  if (!ok) {
    return { error: 'Campanhas desabilitadas para esta integracao (env WHATSAPP_CAMPAIGNS_ENABLED ou campaigns_enabled na tabela de flags).' }
  }

  const { data, error } = await supabase
    .from('tb_whatsapp_campaigns')
    .insert({
      integrations_id: params.integrationId,
      companies_id: params.companiesId,
      name: params.name.trim(),
      template_name: params.templateName.trim(),
      template_language: params.templateLanguage.trim(),
      components_json: Array.isArray(params.components) ? params.components : [],
      status: 'active',
      rate_limit_per_minute: 30
    })
    .select('id')
    .single()

  if (error || !data) {
    if (String(error?.message || '').includes('does not exist') || error?.code === '42P01') {
      return { error: 'Tabelas de campanha nao encontradas. Aplique a migration MIGRATION_WHATSAPP_CAMPAIGNS.sql.' }
    }
    logger.warn('[whatsapp-campaign] Erro ao criar campanha', { error: error?.message })
    return { error: error?.message || 'Erro ao criar campanha' }
  }

  return { id: data.id as string }
}

export async function enqueueCampaignContacts(params: {
  campaignId: string
  integrationId: string
  contactIds: string[]
  rateLimitPerMinute: number
}): Promise<{ inserted: number; error?: string }> {
  const ok = await isCampaignsEnabledForIntegration(params.integrationId)
  if (!ok) {
    return { inserted: 0, error: 'Campanhas desabilitadas para esta integracao.' }
  }

  const rate = Math.max(1, Math.min(120, Math.floor(params.rateLimitPerMinute || 30)))
  const staggerMs = Math.max(500, Math.floor(60000 / rate))

  if (params.contactIds.length === 0) {
    return { inserted: 0 }
  }

  let inserted = 0
  for (let i = 0; i < params.contactIds.length; i++) {
    const cid = String(params.contactIds[i] || '').trim()
    if (!cid) continue
    const row = {
      campaign_id: params.campaignId,
      whatsapp_contact_id: cid,
      dedupe_key: `${params.campaignId}:${cid}`,
      status: 'pending',
      scheduled_at: new Date(Date.now() + i * staggerMs).toISOString()
    }
    const { error } = await supabase.from('tb_whatsapp_campaign_jobs').insert(row)
    if (!error) {
      inserted++
      continue
    }
    if (error.code === '23505') {
      continue
    }
    logger.warn('[whatsapp-campaign] enqueue erro', { error: error.message })
    return { inserted, error: error.message }
  }

  return { inserted }
}

export async function processCampaignJobsOnce(maxJobs: number): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  const { data: jobs, error } = await supabase
    .from('tb_whatsapp_campaign_jobs')
    .select('id, campaign_id, whatsapp_contact_id, status, scheduled_at')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(maxJobs)

  if (error || !jobs?.length) {
    return { processed: 0, errors: 0 }
  }

  for (const job of jobs) {
    const jobId = job.id as string
    const campaignId = job.campaign_id as string
    const contactId = job.whatsapp_contact_id as string | null

    const { data: campaign, error: cErr } = await supabase
      .from('tb_whatsapp_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle()

    if (cErr || !campaign || !contactId) {
      await supabase
        .from('tb_whatsapp_campaign_jobs')
        .update({ status: 'failed', processed_at: new Date().toISOString(), last_error: 'Campanha ou contato invalido' })
        .eq('id', jobId)
      errors++
      continue
    }

    const intId = String((campaign as CampaignRow).integrations_id)
    const enabled = await isCampaignsEnabledForIntegration(intId)
    if (!enabled) {
      await supabase
        .from('tb_whatsapp_campaign_jobs')
        .update({ status: 'skipped', processed_at: new Date().toISOString(), last_error: 'Campanhas desabilitadas' })
        .eq('id', jobId)
      continue
    }

    const templateName = String((campaign as any).template_name || '').trim()
    const languageCode = String((campaign as any).template_language || '').trim()
    const components = Array.isArray((campaign as any).components_json) ? (campaign as any).components_json : undefined

    const sendRes = await sendWhatsAppTemplate(intId, {
      to: contactId,
      templateName,
      languageCode,
      components,
      context: { automation_source: 'campaign', campaign_id: campaignId }
    })

    if (sendRes.success) {
      await supabase
        .from('tb_whatsapp_campaign_jobs')
        .update({ status: 'sent', processed_at: new Date().toISOString(), last_error: null })
        .eq('id', jobId)
      processed++
    } else {
      await supabase
        .from('tb_whatsapp_campaign_jobs')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          last_error: sendRes.error || 'Erro ao enviar'
        })
        .eq('id', jobId)
      errors++
    }
  }

  return { processed, errors }
}
