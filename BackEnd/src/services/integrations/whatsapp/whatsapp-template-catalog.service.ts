import axios from 'axios'
import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { type MetaWhatsAppConfig } from './whatsapp.meta'

type StoredIntegrationRow = {
  id: string
  access_token: string | null
  app_key: string | null
  provider: string | null
}

const DEFAULT_META_API_VERSION = 'v23.0'

function normalizeTemplateLanguage(value?: string | null): string {
  const raw = String(value || '').trim()
  if (!raw) return 'pt_BR'
  if (raw.includes('-')) {
    const [lang, region] = raw.split('-', 2)
    if (lang && region) return `${lang.toLowerCase()}_${region.toUpperCase()}`
  }
  if (raw.includes('_')) {
    const [lang, region] = raw.split('_', 2)
    if (lang && region) return `${lang.toLowerCase()}_${region.toUpperCase()}`
  }
  return raw
}

function flattenStringValues(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenStringValues(entry))
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((entry) => flattenStringValues(entry))
  }
  return []
}

function countTemplateVariables(text: string): number {
  return Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).length
}

function buildTextParameters(values: string[]): Array<Record<string, unknown>> {
  return values.map((value) => ({
    type: 'text',
    text: value
  }))
}

function buildHeaderParametersFromCatalogComponent(component: Record<string, unknown>): {
  parameters?: Array<Record<string, unknown>>
  missingRequirement?: string
} {
  const format = String(component.format || '').toUpperCase()
  const example = component.example
  const headerHandle = flattenStringValues(
    example && typeof example === 'object' ? (example as Record<string, unknown>).header_handle : undefined
  )[0]

  if (format === 'IMAGE') {
    if (!headerHandle) {
      return { missingRequirement: 'Template com imagem sem exemplo de header_handle no catálogo.' }
    }
    return {
      parameters: [
        {
          type: 'image',
          image: { link: headerHandle }
        }
      ]
    }
  }

  if (format === 'VIDEO') {
    if (!headerHandle) {
      return { missingRequirement: 'Template com vídeo sem exemplo de header_handle no catálogo.' }
    }
    return {
      parameters: [
        {
          type: 'video',
          video: { link: headerHandle }
        }
      ]
    }
  }

  if (format === 'DOCUMENT') {
    if (!headerHandle) {
      return { missingRequirement: 'Template com documento sem exemplo de header_handle no catálogo.' }
    }
    return {
      parameters: [
        {
          type: 'document',
          document: {
            link: headerHandle,
            filename: 'template-document.pdf'
          }
        }
      ]
    }
  }

  const headerText = String(component.text || '')
  const variableCount = countTemplateVariables(headerText)
  if (variableCount === 0) {
    return {}
  }

  const exampleValues = flattenStringValues(example).slice(0, variableCount)
  if (exampleValues.length < variableCount) {
    return { missingRequirement: 'Template com cabeçalho variável sem exemplos suficientes no catálogo.' }
  }

  return {
    parameters: buildTextParameters(exampleValues)
  }
}

function buildBodyParametersFromCatalogComponent(component: Record<string, unknown>): {
  parameters?: Array<Record<string, unknown>>
  missingRequirement?: string
} {
  const bodyText = String(component.text || '')
  const variableCount = countTemplateVariables(bodyText)
  if (variableCount === 0) {
    return {}
  }

  const exampleValues = flattenStringValues(component.example).slice(0, variableCount)
  if (exampleValues.length < variableCount) {
    return { missingRequirement: 'Template com corpo variável sem exemplos suficientes no catálogo.' }
  }

  return {
    parameters: buildTextParameters(exampleValues)
  }
}

function buildButtonParametersFromCatalogButton(
  button: Record<string, unknown>,
  index: number
): {
  component?: Record<string, unknown>
  missingRequirement?: string
} {
  const type = String(button.type || '').toUpperCase()
  if (type !== 'URL') {
    return {}
  }

  const url = String(button.url || '')
  const variableCount = countTemplateVariables(url)
  if (variableCount === 0) {
    return {}
  }

  const exampleValues = flattenStringValues(button.example).slice(0, variableCount)
  if (exampleValues.length < variableCount) {
    return { missingRequirement: `Botão ${index + 1} com URL dinâmica sem exemplos suficientes no catálogo.` }
  }

  return {
    component: {
      type: 'button',
      sub_type: 'url',
      index: String(index),
      parameters: buildTextParameters(exampleValues)
    }
  }
}

export function extractWabaIdFromPhoneNumberNode(data: any): string | null {
  const direct = data?.whatsapp_business_account
  const directId =
    typeof direct === 'object' && direct?.id ? String(direct.id) : typeof direct === 'string' ? direct : null
  if (directId && directId.trim()) {
    return directId.trim()
  }

  const entities = Array.isArray(data?.health_status?.entities) ? data.health_status.entities : []
  const wabaEntity = entities.find((entity: any) => String(entity?.entity_type || '').toUpperCase() === 'WABA')
  const entityId = wabaEntity?.id ? String(wabaEntity.id) : null
  if (entityId && entityId.trim()) {
    return entityId.trim()
  }

  return null
}

function resolveMetaConfigFromRow(row: StoredIntegrationRow): MetaWhatsAppConfig | null {
  const accessToken = String(row.access_token || '').trim()
  const phoneNumberId = String(row.app_key || '').trim()
  if (!accessToken || !phoneNumberId) {
    return null
  }
  return {
    provider: 'meta',
    apiVersion: DEFAULT_META_API_VERSION,
    accessToken,
    phoneNumberId,
    verifyToken: undefined,
    businessPhoneNumber: ''
  }
}

async function fetchWabaId(config: MetaWhatsAppConfig): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      params: { fields: 'id,display_phone_number,verified_name,health_status' },
      timeout: 20000
    })
    const id = extractWabaIdFromPhoneNumberNode(data)
    return id && id.trim() ? id.trim() : null
  } catch (error: any) {
    logger.warn('[whatsapp-template-catalog] Falha ao resolver WABA id via health_status; tentando campo legado', {
      phoneNumberId: config.phoneNumberId,
      error: error?.response?.data || error?.message
    })
  }

  try {
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}`
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      params: { fields: 'id,display_phone_number,verified_name,whatsapp_business_account' },
      timeout: 20000
    })
    const id = extractWabaIdFromPhoneNumberNode(data)
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

export async function getStoredTemplateByNameAndLanguage(
  integrationId: string,
  templateName: string,
  languageCode?: string | null
): Promise<any | null> {
  const normalizedLanguage = normalizeTemplateLanguage(languageCode)
  const { data, error } = await supabase
    .from('tb_whatsapp_templates')
    .select('id, name, language, category, status, components_json, synced_at')
    .eq('integrations_id', integrationId)
    .eq('name', templateName)
    .eq('language', normalizedLanguage)
    .maybeSingle()

  if (error) {
    if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
      return null
    }
    throw new Error(error.message)
  }

  return data || null
}

export function buildExactTemplateSendComponentsFromCatalog(components: unknown[] | undefined): {
  components: unknown[]
  missingRequirements: string[]
} {
  if (!Array.isArray(components)) {
    return { components: [], missingRequirements: [] }
  }

  const result: Array<Record<string, unknown>> = []
  const missingRequirements: string[] = []

  for (const item of components) {
    if (!item || typeof item !== 'object') continue
    const component = item as Record<string, unknown>
    const type = String(component.type || '').toUpperCase()

    if (type === 'HEADER') {
      const header = buildHeaderParametersFromCatalogComponent(component)
      if (header.missingRequirement) {
        missingRequirements.push(header.missingRequirement)
      }
      if (header.parameters && header.parameters.length > 0) {
        result.push({
          type: 'header',
          parameters: header.parameters
        })
      }
      continue
    }

    if (type === 'BODY') {
      const body = buildBodyParametersFromCatalogComponent(component)
      if (body.missingRequirement) {
        missingRequirements.push(body.missingRequirement)
      }
      if (body.parameters && body.parameters.length > 0) {
        result.push({
          type: 'body',
          parameters: body.parameters
        })
      }
      continue
    }

    if (type === 'BUTTONS') {
      const buttons = Array.isArray(component.buttons) ? (component.buttons as Array<Record<string, unknown>>) : []
      for (const [index, button] of buttons.entries()) {
        const buttonComponent = buildButtonParametersFromCatalogButton(button, index)
        if (buttonComponent.missingRequirement) {
          missingRequirements.push(buttonComponent.missingRequirement)
        }
        if (buttonComponent.component) {
          result.push(buttonComponent.component)
        }
      }
    }
  }

  return { components: result, missingRequirements }
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
