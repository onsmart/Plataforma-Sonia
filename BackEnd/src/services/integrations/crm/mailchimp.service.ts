import crypto from 'crypto'
import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'

type StoredCRMIntegration = {
  id: string
  api_key?: string | null
  access_token?: string | null
  config?: Record<string, any> | null
  tb_crms?:
    | {
        id?: string
        slug?: string
        name?: string
        type?: string
      }
    | Array<{
        id?: string
        slug?: string
        name?: string
        type?: string
      }>
    | null
}

type MailchimpList = {
  id: string
  name: string
  stats?: {
    member_count?: number
  }
}

type MailchimpMember = {
  id: string
  email_address: string
  full_name?: string
  status?: string
  merge_fields?: Record<string, any>
  tags_count?: number
  timestamp_signup?: string
  last_changed?: string
  list_id?: string
}

type MailchimpListResponse = {
  lists: MailchimpList[]
}

type MailchimpMembersResponse = {
  members: MailchimpMember[]
}

function normalizeCRM(crm: StoredCRMIntegration['tb_crms']) {
  return Array.isArray(crm) ? crm[0] : crm
}

function getMailchimpCredential(integration: StoredCRMIntegration): string | null {
  const config =
    integration?.config && typeof integration.config === 'object'
      ? integration.config
      : null

  const candidates = [
    integration.api_key,
    integration.access_token,
    config?.api_key,
    config?.access_token,
    config?.token,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) return normalized
  }

  return null
}

function getMailchimpDataCenter(apiKey: string, config?: Record<string, any> | null): string | null {
  const configured = String(config?.data_center || config?.dc || '').trim().toLowerCase()
  if (configured) return configured

  const match = apiKey.trim().match(/-([a-z]{2,}\d+)$/i)
  return match?.[1]?.toLowerCase() || null
}

function getDefaultListId(config?: Record<string, any> | null): string | null {
  const candidates = [
    config?.default_list_id,
    config?.list_id,
    config?.audience_id,
    config?.mailchimp_list_id,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) return normalized
  }

  return null
}

function getSubscriberHash(emailOrId: string): string {
  const normalized = String(emailOrId || '').trim().toLowerCase()
  if (!normalized) {
    throw new Error('Email ou ID do contato e obrigatorio para o Mailchimp')
  }

  if (!normalized.includes('@') && /^[a-f0-9]{32}$/i.test(normalized)) {
    return normalized
  }

  return crypto.createHash('md5').update(normalized).digest('hex')
}

function mapMailchimpMember(member: MailchimpMember, list?: MailchimpList) {
  const mergeFields = member.merge_fields || {}
  const firstname = String(mergeFields.FNAME || mergeFields.firstname || '').trim()
  const lastname = String(mergeFields.LNAME || mergeFields.lastname || '').trim()

  return {
    id: member.id,
    email: member.email_address || '',
    email_address: member.email_address || '',
    firstname,
    lastname,
    full_name: member.full_name || [firstname, lastname].filter(Boolean).join(' '),
    phone: String(mergeFields.PHONE || mergeFields.phone || '').trim(),
    company: String(mergeFields.COMPANY || mergeFields.company || '').trim(),
    status: member.status || '',
    list_id: member.list_id || list?.id || '',
    list_name: list?.name || '',
    properties: {
      ...mergeFields,
      status: member.status,
      list_id: member.list_id || list?.id,
      list_name: list?.name,
      tags_count: member.tags_count,
    },
    createdAt: member.timestamp_signup || null,
    updatedAt: member.last_changed || null,
  }
}

function getFieldValue(item: any, fieldName: string): string {
  const direct = item?.[fieldName]
  if (direct !== undefined && direct !== null) return String(direct)

  const property = item?.properties?.[fieldName]
  if (property !== undefined && property !== null) return String(property)

  const normalizedField = fieldName.toLowerCase()
  for (const [key, value] of Object.entries(item?.properties || {})) {
    if (key.toLowerCase() === normalizedField && value !== undefined && value !== null) {
      return String(value)
    }
  }

  return ''
}

function applyStructuredFilters(
  data: any[],
  structuredFilters?: Array<{
    field: string
    operator: 'equals' | 'starts_with' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
    value: string | number
  }>
) {
  if (!structuredFilters?.length) return data

  return data.filter((item) => structuredFilters.every((filter) => {
    const fieldValue = getFieldValue(item, filter.field).toLowerCase()
    const expectedValue = String(filter.value).toLowerCase()

    if (filter.operator === 'equals') return fieldValue === expectedValue
    if (filter.operator === 'starts_with') return fieldValue.startsWith(expectedValue)
    if (filter.operator === 'contains') return fieldValue.includes(expectedValue)

    const numericField = Number(fieldValue)
    const numericExpected = Number(expectedValue)
    if (Number.isNaN(numericField) || Number.isNaN(numericExpected)) return false

    if (filter.operator === 'gt') return numericField > numericExpected
    if (filter.operator === 'gte') return numericField >= numericExpected
    if (filter.operator === 'lt') return numericField < numericExpected
    if (filter.operator === 'lte') return numericField <= numericExpected

    return true
  }))
}

async function getCRMIntegration(crmIntegrationId: string): Promise<StoredCRMIntegration> {
  const { data, error } = await supabase
    .from('tb_crm_integrations')
    .select(`
      id,
      api_key,
      access_token,
      config,
      tb_crms (
        id,
        slug,
        name,
        type
      )
    `)
    .eq('id', crmIntegrationId)
    .eq('is_active', true)
    .single()

  if (error) {
    logger.error('[mailchimp.getCRMIntegration] Erro ao buscar integracao CRM:', error)
    throw new Error(`Erro ao buscar integracao CRM: ${error.message}`)
  }

  const crm = normalizeCRM((data as StoredCRMIntegration).tb_crms)
  if (crm?.slug !== 'mailchimp') {
    throw new Error('Esta integracao nao e do Mailchimp')
  }

  return data as StoredCRMIntegration
}

async function mailchimpRequest<T>(
  integration: StoredCRMIntegration,
  endpoint: string,
  method = 'GET',
  body?: any
): Promise<T> {
  const apiKey = getMailchimpCredential(integration)
  if (!apiKey) {
    throw new Error('API Key nao configurada para esta integracao Mailchimp')
  }

  const dataCenter = getMailchimpDataCenter(apiKey, integration.config)
  if (!dataCenter) {
    throw new Error('Data center do Mailchimp nao identificado. Salve a API Key completa com sufixo, por exemplo xxxx-us21.')
  }

  const url = `https://${dataCenter}.api.mailchimp.com/3.0${endpoint}`
  const authorization = Buffer.from(`sonia:${apiKey}`).toString('base64')

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error(`[mailchimpRequest] Erro na API Mailchimp: ${response.status} - ${errorText}`)
    throw new Error(`Mailchimp API error: ${response.status} - ${errorText}`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return await response.json() as T
}

export async function getMailchimpLists(
  crmIntegrationId: string,
  limit = 100
): Promise<any[]> {
  const integration = await getCRMIntegration(crmIntegrationId)
  const count = Math.min(Math.max(Number(limit) || 10, 1), 1000)
  const response = await mailchimpRequest<MailchimpListResponse>(
    integration,
    `/lists?count=${count}&fields=lists.id,lists.name,lists.stats.member_count`
  )

  return (response.lists || []).map((list) => ({
    id: list.id,
    name: list.name,
    member_count: list.stats?.member_count || 0,
  }))
}

export async function getMailchimpContacts(
  crmIntegrationId: string,
  limit = 10,
  listId?: string
): Promise<any[]> {
  const integration = await getCRMIntegration(crmIntegrationId)
  const defaultListId = String(listId || getDefaultListId(integration.config) || '').trim()
  const count = Math.min(Math.max(Number(limit) || 10, 1), 1000)

  let lists: MailchimpList[] = []
  if (defaultListId) {
    lists = [{ id: defaultListId, name: '' }]
  } else {
    const response = await mailchimpRequest<MailchimpListResponse>(
      integration,
      '/lists?count=100&fields=lists.id,lists.name,lists.stats.member_count'
    )
    lists = response.lists || []
  }

  if (lists.length === 0) {
    return []
  }

  const contacts: any[] = []
  for (const list of lists) {
    const remaining = count - contacts.length
    if (remaining <= 0) break

    const response = await mailchimpRequest<MailchimpMembersResponse>(
      integration,
      `/lists/${encodeURIComponent(list.id)}/members?count=${remaining}&fields=members.id,members.email_address,members.full_name,members.status,members.merge_fields,members.tags_count,members.timestamp_signup,members.last_changed`
    )

    contacts.push(...(response.members || []).map((member) => mapMailchimpMember({ ...member, list_id: list.id }, list)))
  }

  logger.info(`[getMailchimpContacts] ${contacts.length} contatos encontrados`)
  return contacts.slice(0, count)
}

export async function searchMailchimpContacts(
  crmIntegrationId: string,
  limit = 10,
  listId?: string,
  structuredFilters?: Array<{
    field: string
    operator: 'equals' | 'starts_with' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
    value: string | number
  }>
): Promise<any[]> {
  const fetchLimit = structuredFilters?.length ? Math.max(limit * 5, 50) : limit
  const contacts = await getMailchimpContacts(crmIntegrationId, fetchLimit, listId)
  return applyStructuredFilters(contacts, structuredFilters).slice(0, limit)
}

export async function createMailchimpContact(
  crmIntegrationId: string,
  contactData: Record<string, any>,
  listId?: string
): Promise<any> {
  const integration = await getCRMIntegration(crmIntegrationId)
  const targetListId = String(listId || contactData.list_id || getDefaultListId(integration.config) || '').trim()
  if (!targetListId) {
    throw new Error('Informe list_id/audience_id para criar contatos no Mailchimp ou salve default_list_id no config da integracao.')
  }

  const email = String(contactData.email || contactData.email_address || '').trim().toLowerCase()
  if (!email) {
    throw new Error('Email e obrigatorio para criar contato no Mailchimp')
  }

  const mergeFields: Record<string, string> = {}
  if (contactData.firstname || contactData.first_name) mergeFields.FNAME = String(contactData.firstname || contactData.first_name)
  if (contactData.lastname || contactData.last_name) mergeFields.LNAME = String(contactData.lastname || contactData.last_name)
  if (contactData.phone || contactData.phone_number) mergeFields.PHONE = String(contactData.phone || contactData.phone_number)
  if (contactData.company) mergeFields.COMPANY = String(contactData.company)

  const body = {
    email_address: email,
    status_if_new: String(contactData.status || contactData.status_if_new || 'subscribed'),
    ...(Object.keys(mergeFields).length > 0 ? { merge_fields: mergeFields } : {}),
  }

  const member = await mailchimpRequest<MailchimpMember>(
    integration,
    `/lists/${encodeURIComponent(targetListId)}/members/${getSubscriberHash(email)}`,
    'PUT',
    body
  )

  return mapMailchimpMember({ ...member, list_id: targetListId }, { id: targetListId, name: '' })
}

export async function updateMailchimpContact(
  crmIntegrationId: string,
  contactId: string,
  contactData: Record<string, any>,
  listId?: string
): Promise<any> {
  const integration = await getCRMIntegration(crmIntegrationId)
  const targetListId = String(listId || contactData.list_id || getDefaultListId(integration.config) || '').trim()
  if (!targetListId) {
    throw new Error('Informe list_id/audience_id para atualizar contatos no Mailchimp ou salve default_list_id no config da integracao.')
  }

  const mergeFields: Record<string, string> = {}
  if (contactData.firstname || contactData.first_name) mergeFields.FNAME = String(contactData.firstname || contactData.first_name)
  if (contactData.lastname || contactData.last_name) mergeFields.LNAME = String(contactData.lastname || contactData.last_name)
  if (contactData.phone || contactData.phone_number) mergeFields.PHONE = String(contactData.phone || contactData.phone_number)
  if (contactData.company) mergeFields.COMPANY = String(contactData.company)

  const body: Record<string, any> = {}
  if (contactData.email || contactData.email_address) body.email_address = String(contactData.email || contactData.email_address).trim().toLowerCase()
  if (contactData.status) body.status = String(contactData.status)
  if (Object.keys(mergeFields).length > 0) body.merge_fields = mergeFields

  const member = await mailchimpRequest<MailchimpMember>(
    integration,
    `/lists/${encodeURIComponent(targetListId)}/members/${getSubscriberHash(contactId)}`,
    'PATCH',
    body
  )

  return mapMailchimpMember({ ...member, list_id: targetListId }, { id: targetListId, name: '' })
}
