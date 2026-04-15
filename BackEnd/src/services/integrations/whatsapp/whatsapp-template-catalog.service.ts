import axios from 'axios'
import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { buildMetaConfigFromEnv, type MetaWhatsAppConfig } from './whatsapp.meta'

type StoredIntegrationRow = {
  id: string
  access_token: string | null
  app_key: string | null
  provider: string | null
}

function resolveMetaConfigFromRow(row: StoredIntegrationRow): MetaWhatsAppConfig | null {
  const envFallback = buildMetaConfigFromEnv()
  const accessToken = String(row.access_token || '').trim()
  const phoneNumberId = String(row.app_key || '').trim()
  if (!accessToken || !phoneNumberId) {
    return null
  }
  return {
    provider: 'meta',
    apiVersion: envFallback?.apiVersion || 'v23.0',
    accessToken,
    phoneNumberId,
    verifyToken: envFallback?.verifyToken,
    businessPhoneNumber: envFallback?.businessPhoneNumber || ''
  }
}

async function fetchWabaId(config: MetaWhatsAppConfig): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      params: { fields: 'id,display_phone_number,verified_name,whatsapp_business_account' },
      timeout: 20000
    })
    const waba = data?.whatsapp_business_account
    const id = typeof waba === 'object' && waba?.id ? String(waba.id) : typeof waba === 'string' ? waba : null
    return id && id.trim() ? id.trim() : null
  } catch (error: any) {
    logger.warn('[whatsapp-template-catalog] Falha ao resolver WABA id', {
      phoneNumberId: config.phoneNumberId,
      error: error?.response?.data || error?.message
    })
    return null
  }
}

function mapTemplateRow(integrationId: string, item: any) {
  const name = String(item?.name || '').trim()
  const language =
    typeof item?.language === 'string'
      ? String(item.language).trim()
      : item?.language && typeof item.language === 'object' && 'code' in item.language
        ? String((item.language as { code?: string }).code || '').trim()
        : 'und'
  const category = item?.category ? String(item.category) : null
  const status = item?.status ? String(item.status) : null
  const components = Array.isArray(item?.components) ? item.components : []
  return {
    integrations_id: integrationId,
    name,
    language,
    category,
    status,
    components_json: components,
    meta_raw: item || null,
    synced_at: new Date().toISOString()
  }
}

export async function syncTemplatesFromMetaForIntegration(integrationId: string): Promise<{
  success: boolean
  synced: number
  error?: string
}> {
  const { data: row, error } = await supabase
    .from('tb_integrations')
    .select('id, access_token, app_key, provider')
    .eq('id', integrationId)
    .maybeSingle()

  if (error || !row) {
    return { success: false, synced: 0, error: 'Integracao nao encontrada' }
  }

  const meta = resolveMetaConfigFromRow(row as StoredIntegrationRow)
  if (!meta) {
    return { success: false, synced: 0, error: 'Integracao sem credenciais Meta (access_token / app_key)' }
  }

  const wabaId = await fetchWabaId(meta)
  if (!wabaId) {
    return {
      success: false,
      synced: 0,
      error: 'Nao foi possivel obter whatsapp_business_account para listar message_templates'
    }
  }

  try {
    const url = `https://graph.facebook.com/${meta.apiVersion}/${wabaId}/message_templates`
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${meta.accessToken}` },
      params: { limit: 200 },
      timeout: 45000
    })

    const items = Array.isArray(data?.data) ? data.data : []
    let synced = 0

    for (const item of items) {
      const mapped = mapTemplateRow(integrationId, item)
      if (!mapped.name) {
        continue
      }

      const { error: upsertError } = await supabase.from('tb_whatsapp_templates').upsert(mapped, {
        onConflict: 'integrations_id,name,language'
      })

      if (upsertError) {
        if (String(upsertError.message || '').includes('does not exist') || upsertError.code === '42P01') {
          return {
            success: false,
            synced: 0,
            error: 'Tabela tb_whatsapp_templates inexistente; aplique a migration MIGRATION_WHATSAPP_TEMPLATES_AND_EVENTS.sql'
          }
        }
        logger.warn('[whatsapp-template-catalog] Erro upsert template', {
          integrationId,
          name: mapped.name,
          error: upsertError.message
        })
        continue
      }
      synced += 1
    }

    return { success: true, synced }
  } catch (err: any) {
    const metaErr =
      err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Erro Graph API'
    return { success: false, synced: 0, error: String(metaErr) }
  }
}

export async function listStoredTemplates(integrationId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('tb_whatsapp_templates')
    .select('id, name, language, category, status, components_json, synced_at')
    .eq('integrations_id', integrationId)
    .order('name', { ascending: true })

  if (error) {
    if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
      return []
    }
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}
