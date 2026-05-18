import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'

interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    lifecyclestage?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

interface HubSpotDeal {
  id: string
  properties: {
    dealname?: string
    amount?: string
    dealstage?: string
    pipeline?: string
    closedate?: string
    [key: string]: any
  }
  createdAt: string
  updatedAt: string
}

interface HubSpotResponse<T> {
  results: T[]
  paging?: {
    next?: {
      after: string
    }
  }
}

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

export function getHubSpotCredential(integration: StoredCRMIntegration): string | null {
  const config =
    integration?.config && typeof integration.config === 'object'
      ? integration.config
      : null

  const candidates = [
    integration.api_key,
    integration.access_token,
    config?.private_app_token,
    config?.access_token,
    config?.api_key,
    config?.token,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim()
    if (normalized) {
      return normalized
    }
  }

  return null
}

/**
 * Busca a integração CRM do agente
 */
export async function getCRMIntegration(crmIntegrationId: string): Promise<StoredCRMIntegration> {
  try {
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

    if (error) throw error
    return data
  } catch (error: any) {
    logger.error('[getCRMIntegration] Erro ao buscar integração CRM:', error)
    throw new Error(`Erro ao buscar integração CRM: ${error.message}`)
  }
}

/**
 * Faz requisição para API do HubSpot
 */
async function hubspotRequest<T>(
  apiKey: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<T> {
  const baseUrl = 'https://api.hubapi.com'
  const url = `${baseUrl}${endpoint}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }

  const options: RequestInit = {
    method,
    headers
  }

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[hubspotRequest] Erro na API HubSpot: ${response.status} - ${errorText}`)
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data as T
  } catch (error: any) {
    logger.error('[hubspotRequest] Erro na requisição:', error)
    throw error
  }
}

/**
 * Busca contatos do HubSpot
 */
export async function getHubSpotContacts(
  crmIntegrationId: string,
  limit: number = 10,
  properties?: string[]
): Promise<any[]> {
  try {
    const integration = await getCRMIntegration(crmIntegrationId)
    
    if (!integration) {
      throw new Error('Integração CRM não encontrada')
    }

    const crm = integration.tb_crms as any
    if (crm?.slug !== 'hubspot') {
      throw new Error('Esta integração não é do HubSpot')
    }

    const apiKey = getHubSpotCredential(integration)
    if (!apiKey) {
      throw new Error('API Key não configurada para esta integração')
    }

    // Propriedades padrão do HubSpot
    const defaultProperties = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage']
    const requestedProperties = properties && properties.length > 0 
      ? properties 
      : defaultProperties

    const propertiesParam = requestedProperties.join(',')

    const response = await hubspotRequest<HubSpotResponse<HubSpotContact>>(
      apiKey,
      `/crm/v3/objects/contacts?limit=${limit}&properties=${propertiesParam}`,
      'GET'
    )

    // Formata os contatos para um formato mais simples
    const formattedContacts = response.results.map((contact) => ({
      id: contact.id,
      firstname: contact.properties.firstname || '',
      lastname: contact.properties.lastname || '',
      email: contact.properties.email || '',
      phone: contact.properties.phone || '',
      company: contact.properties.company || '',
      lifecyclestage: contact.properties.lifecyclestage || '',
      properties: contact.properties,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    }))

    logger.info(`[getHubSpotContacts] ${formattedContacts.length} contatos encontrados`)
    return formattedContacts
  } catch (error: any) {
    logger.error('[getHubSpotContacts] Erro ao buscar contatos:', error)
    throw error
  }
}

/**
 * Busca contatos do HubSpot com filtros usando a API de busca
 * Agora aceita filtros genéricos estruturados para qualquer campo
 */
export async function searchHubSpotContacts(
  crmIntegrationId: string,
  limit: number = 10,
  filters?: {
    firstnameStartsWith?: string
    firstnameEquals?: string
    emailContains?: string
    emailEquals?: string
    // Adicione outros filtros conforme necessário
  },
  properties?: string[],
  structuredFilters?: Array<{
    field: string
    operator: 'equals' | 'starts_with' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
    value: string | number
  }>
): Promise<any[]> {
  try {
    const integration = await getCRMIntegration(crmIntegrationId)
    
    if (!integration) {
      throw new Error('Integração CRM não encontrada')
    }

    const crm = integration.tb_crms as any
    if (crm?.slug !== 'hubspot') {
      throw new Error('Esta integração não é do HubSpot')
    }

    const apiKey = getHubSpotCredential(integration)
    if (!apiKey) {
      throw new Error('API Key não configurada para esta integração')
    }

    // Propriedades padrão do HubSpot
    const defaultProperties = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage']
    const requestedProperties = properties && properties.length > 0 
      ? properties 
      : defaultProperties

    // Monta o body da requisição de busca
    // HubSpot tem limite máximo de 200 por requisição
    const HUBSPOT_MAX_LIMIT = 200
    
    const searchBody: any = {
      limit: Math.min(limit, HUBSPOT_MAX_LIMIT),
      properties: requestedProperties
    }

    // Mapeia operadores do nosso formato para operadores do HubSpot
    // HubSpot suporta: EQ, NEQ, LT, LTE, GT, GTE, BETWEEN, IN, NOT_IN, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN
    const operatorMap: Record<string, string> = {
      'equals': 'EQ',
      'gt': 'GT',
      'gte': 'GTE',
      'lt': 'LT',
      'lte': 'LTE',
      'contains': 'CONTAINS_TOKEN', // CONTAINS_TOKEN busca em qualquer parte do texto
      // 'starts_with' não é suportado diretamente, mas podemos usar CONTAINS_TOKEN e filtrar localmente se necessário
    }

    // Processa filtros estruturados primeiro (prioridade)
    const apiFilters: any[] = []
    
    if (structuredFilters && structuredFilters.length > 0) {
      for (const filter of structuredFilters) {
        const { field, operator, value } = filter
        
        // Mapeia o operador para o formato do HubSpot
        const hubspotOperator = operatorMap[operator]
        
        if (hubspotOperator) {
          // HubSpot aceita filtros em qualquer campo, incluindo customizados
          apiFilters.push({
            propertyName: field,
            operator: hubspotOperator,
            value: String(value)
          })
          logger.info(`[searchHubSpotContacts] Adicionando filtro na API: ${field} ${hubspotOperator} ${value}`)
        } else if (operator === 'starts_with') {
          // starts_with não é suportado diretamente pelo HubSpot
          // Vamos usar CONTAINS_TOKEN e filtrar localmente depois
          logger.info(`[searchHubSpotContacts] Operador "starts_with" não suportado diretamente pelo HubSpot para ${field}, será filtrado localmente`)
        } else {
          logger.warn(`[searchHubSpotContacts] Operador "${operator}" não mapeado para HubSpot, será filtrado localmente`)
        }
      }
    }
    
    // Processa filtros legados (mantido para compatibilidade)
    if (filters?.firstnameEquals) {
      apiFilters.push({
        propertyName: 'firstname',
        operator: 'EQ',
        value: filters.firstnameEquals
      })
    }
    
    if (filters?.emailEquals) {
      apiFilters.push({
        propertyName: 'email',
        operator: 'EQ',
        value: filters.emailEquals
      })
    }
    
    // Adiciona filtros à requisição se houver
    if (apiFilters.length > 0) {
      searchBody.filterGroups = [{ filters: apiFilters }]
      logger.info(`[searchHubSpotContacts] Usando ${apiFilters.length} filtro(s) na API do HubSpot:`, apiFilters)
    }

    // Usa o endpoint de busca (POST) ao invés de listagem (GET)
    const response = await hubspotRequest<HubSpotResponse<HubSpotContact>>(
      apiKey,
      '/crm/v3/objects/contacts/search',
      'POST',
      searchBody
    )

    // Formata os contatos para um formato mais simples
    let formattedContacts = response.results.map((contact) => ({
      id: contact.id,
      firstname: contact.properties.firstname || '',
      lastname: contact.properties.lastname || '',
      email: contact.properties.email || '',
      phone: contact.properties.phone || '',
      company: contact.properties.company || '',
      lifecyclestage: contact.properties.lifecyclestage || '',
      properties: contact.properties,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    }))

    // Aplica filtros locais APENAS para operadores não suportados pela API (ex: starts_with)
    const needsLocalFiltering = structuredFilters?.some(f => f.operator === 'starts_with')
    
    if (needsLocalFiltering) {
      for (const filter of structuredFilters || []) {
        if (filter.operator === 'starts_with') {
          const filterValue = String(filter.value).toUpperCase()
          formattedContacts = formattedContacts.filter(contact => {
            const fieldValue = (contact.properties as any)[filter.field] || (contact as any)[filter.field] || ''
            return String(fieldValue).toUpperCase().startsWith(filterValue)
          })
          logger.info(`[searchHubSpotContacts] Filtrado localmente: ${filter.field} começa com "${filter.value}"`)
        }
      }
    }
    
    // Aplica filtros legados locais (mantido para compatibilidade)
    if (filters?.firstnameStartsWith) {
      const filterValue = filters.firstnameStartsWith.toUpperCase()
      formattedContacts = formattedContacts.filter(contact => {
        const firstname = (contact.firstname || '').trim().toUpperCase()
        return firstname.startsWith(filterValue)
      })
      logger.info(`[searchHubSpotContacts] Filtrado localmente: firstname começa com "${filters.firstnameStartsWith}"`)
    }
    
    if (filters?.emailContains) {
      const filterValue = filters.emailContains.toLowerCase()
      formattedContacts = formattedContacts.filter(contact => {
        const email = (contact.email || '').toLowerCase()
        return email.includes(filterValue)
      })
      logger.info(`[searchHubSpotContacts] Filtrado localmente: email contém "${filters.emailContains}"`)
    }
    
    // Limita aos N primeiros após aplicar todos os filtros
    formattedContacts = formattedContacts.slice(0, limit)
    
    logger.info(`[searchHubSpotContacts] ${formattedContacts.length} contatos encontrados após aplicar filtros`)

    return formattedContacts
  } catch (error: any) {
    logger.error('[searchHubSpotContacts] Erro ao buscar contatos com filtros:', error)
    throw error
  }
}

/**
 * Busca negócios (deals) do HubSpot
 */
export async function getHubSpotDeals(
  crmIntegrationId: string,
  limit: number = 10,
  properties?: string[]
): Promise<any[]> {
  try {
    const integration = await getCRMIntegration(crmIntegrationId)
    
    if (!integration) {
      throw new Error('Integração CRM não encontrada')
    }

    const crm = integration.tb_crms as any
    if (crm?.slug !== 'hubspot') {
      throw new Error('Esta integração não é do HubSpot')
    }

    const apiKey = getHubSpotCredential(integration)
    if (!apiKey) {
      throw new Error('API Key não configurada para esta integração')
    }

    // Propriedades padrão do HubSpot
    const defaultProperties = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate']
    const requestedProperties = properties && properties.length > 0 
      ? properties 
      : defaultProperties

    const propertiesParam = requestedProperties.join(',')

    const response = await hubspotRequest<HubSpotResponse<HubSpotDeal>>(
      apiKey,
      `/crm/v3/objects/deals?limit=${limit}&properties=${propertiesParam}`,
      'GET'
    )

    // Formata os negócios para um formato mais simples
    const formattedDeals = response.results.map((deal) => ({
      id: deal.id,
      dealname: deal.properties.dealname || '',
      amount: deal.properties.amount || '',
      dealstage: deal.properties.dealstage || '',
      pipeline: deal.properties.pipeline || '',
      closedate: deal.properties.closedate || '',
      properties: deal.properties,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt
    }))

    logger.log(`[getHubSpotDeals] ${formattedDeals.length} negócios encontrados`)
    return formattedDeals
  } catch (error: any) {
    logger.error('[getHubSpotDeals] Erro ao buscar negócios:', error)
    throw error
  }
}

/**
 * Cria um contato no HubSpot
 */
export async function createHubSpotContact(
  crmIntegrationId: string,
  contactData: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    [key: string]: any
  }
): Promise<any> {
  try {
    const integration = await getCRMIntegration(crmIntegrationId)
    
    if (!integration) {
      throw new Error('Integração CRM não encontrada')
    }

    const crm = integration.tb_crms as any
    if (crm?.slug !== 'hubspot') {
      throw new Error('Esta integração não é do HubSpot')
    }

    const apiKey = getHubSpotCredential(integration)
    if (!apiKey) {
      throw new Error('API Key não configurada para esta integração')
    }

    const properties: Record<string, string> = {}
    if (contactData.firstname) properties.firstname = contactData.firstname
    if (contactData.lastname) properties.lastname = contactData.lastname
    if (contactData.email) properties.email = contactData.email
    if (contactData.phone) properties.phone = contactData.phone
    if (contactData.company) properties.company = contactData.company

    // Adiciona outras propriedades customizadas
    Object.keys(contactData).forEach(key => {
      if (!['firstname', 'lastname', 'email', 'phone', 'company'].includes(key)) {
        properties[key] = String(contactData[key])
      }
    })

    const response = await hubspotRequest<HubSpotContact>(
      apiKey,
      '/crm/v3/objects/contacts',
      'POST',
      { properties }
    )

    logger.info(`[createHubSpotContact] Contato criado com sucesso: ${response.id}`)
    return {
      id: response.id,
      ...response.properties,
      createdAt: response.createdAt
    }
  } catch (error: any) {
    logger.error('[createHubSpotContact] Erro ao criar contato:', error)
    throw error
  }
}

/**
 * Atualiza um contato no HubSpot
 */
export async function updateHubSpotContact(
  crmIntegrationId: string,
  contactId: string,
  contactData: Record<string, any>
): Promise<any> {
  try {
    const integration = await getCRMIntegration(crmIntegrationId)
    
    if (!integration) {
      throw new Error('Integração CRM não encontrada')
    }

    const crm = integration.tb_crms as any
    if (crm?.slug !== 'hubspot') {
      throw new Error('Esta integração não é do HubSpot')
    }

    const apiKey = getHubSpotCredential(integration)
    if (!apiKey) {
      throw new Error('API Key não configurada para esta integração')
    }

    const response = await hubspotRequest<HubSpotContact>(
      apiKey,
      `/crm/v3/objects/contacts/${contactId}`,
      'PATCH',
      { properties: contactData }
    )

    logger.info(`[updateHubSpotContact] Contato atualizado com sucesso: ${contactId}`)
    return {
      id: response.id,
      ...response.properties,
      updatedAt: response.updatedAt
    }
  } catch (error: any) {
    logger.error('[updateHubSpotContact] Erro ao atualizar contato:', error)
    throw error
  }
}

export type HubSpotConnectionTestStatus =
  | 'connected'
  | 'auth_failed'
  | 'forbidden'
  | 'misconfigured'
  | 'unavailable'

export interface HubSpotConnectionTestResult {
  success: boolean
  provider: 'hubspot'
  status: HubSpotConnectionTestStatus
  message: string
  testedAt: string
  portalId?: number | string
  accountType?: string
  crmSchemaAccessVerified: boolean
  httpStatus?: number
  errorCode?: string
  tokenHint?: string
  lgpdNotice: string
}

export function parseHubSpotApiError(error: unknown): {
  httpStatus?: number
  errorCode?: string
  message: string
} {
  const raw = String((error as Error)?.message || error || '').trim()
  const statusMatch = raw.match(/HubSpot API error:\s*(\d{3})/i)
  const httpStatus = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined

  let errorCode: string | undefined
  try {
    const jsonStart = raw.indexOf('{')
    if (jsonStart >= 0) {
      const payload = JSON.parse(raw.slice(jsonStart)) as { category?: string; message?: string }
      errorCode = String(payload.category || '').trim() || undefined
    }
  } catch {
    // ignore malformed json fragments
  }

  if (httpStatus === 401 || /authentication credentials/i.test(raw)) {
    return {
      httpStatus: httpStatus || 401,
      errorCode: errorCode || 'INVALID_AUTHENTICATION',
      message:
        'Token do HubSpot invalido ou expirado. Gere um novo Private App token e salve novamente na integracao.',
    }
  }

  if (httpStatus === 403) {
    return {
      httpStatus: 403,
      errorCode: errorCode || 'MISSING_SCOPES',
      message:
        'Token autenticado, mas sem permissao para CRM. Revise os escopos do Private App (contatos/leitura e escrita).',
    }
  }

  return {
    httpStatus,
    errorCode,
    message: raw || 'Falha ao comunicar com o HubSpot.',
  }
}

function buildTokenHint(token: string): string {
  const normalized = String(token || '').trim()
  if (!normalized) return ''
  if (normalized.length <= 8) return '********'
  return `${normalized.slice(0, 6)}...`
}

function resolveHubSpotSlug(integration: StoredCRMIntegration): string {
  const crm = integration.tb_crms as { slug?: string } | Array<{ slug?: string }> | null | undefined
  if (Array.isArray(crm)) return String(crm[0]?.slug || '').trim()
  return String(crm?.slug || '').trim()
}

/**
 * Teste de conectividade LGPD-friendly: valida autenticacao e acesso ao schema de contatos,
 * sem listar ou retornar dados pessoais de pacientes/contatos.
 */
export async function testHubSpotConnection(params: {
  token?: string
  crmIntegrationId?: string
}): Promise<HubSpotConnectionTestResult> {
  const testedAt = new Date().toISOString()
  const lgpdNotice =
    'Teste tecnico sem exibicao de dados pessoais de contatos. Apenas validacao de autenticacao e permissao de API.'

  let token = String(params.token || '').trim()
  let tokenHint = buildTokenHint(token)

  if (!token && params.crmIntegrationId) {
    const integration = await getCRMIntegration(params.crmIntegrationId)
    if (resolveHubSpotSlug(integration) !== 'hubspot') {
      return {
        success: false,
        provider: 'hubspot',
        status: 'misconfigured',
        message: 'Esta integracao nao e do HubSpot.',
        testedAt,
        crmSchemaAccessVerified: false,
        lgpdNotice,
      }
    }
    token = String(getHubSpotCredential(integration) || '').trim()
    tokenHint = buildTokenHint(token)
  }

  if (!token) {
    return {
      success: false,
      provider: 'hubspot',
      status: 'misconfigured',
      message: 'Nenhum token do HubSpot foi encontrado. Informe o Private App token e salve a integracao.',
      testedAt,
      crmSchemaAccessVerified: false,
      tokenHint,
      lgpdNotice,
    }
  }

  try {
    const accountDetails = await hubspotRequest<{
      portalId?: number
      accountType?: string
      timeZone?: string
      companyCurrency?: string
    }>(token, '/account-info/v3/details', 'GET')

    let crmSchemaAccessVerified = false
    try {
      await hubspotRequest<{ results?: unknown[] }>(token, '/crm/v3/schemas/contacts', 'GET')
      crmSchemaAccessVerified = true
    } catch (schemaError: any) {
      const parsed = parseHubSpotApiError(schemaError)
      if (parsed.httpStatus === 403) {
        return {
          success: false,
          provider: 'hubspot',
          status: 'forbidden',
          message: parsed.message,
          testedAt,
          portalId: accountDetails.portalId,
          accountType: accountDetails.accountType,
          crmSchemaAccessVerified: false,
          httpStatus: parsed.httpStatus,
          errorCode: parsed.errorCode,
          tokenHint,
          lgpdNotice,
        }
      }
      throw schemaError
    }

    return {
      success: true,
      provider: 'hubspot',
      status: 'connected',
      message: 'Conexao com HubSpot validada com sucesso.',
      testedAt,
      portalId: accountDetails.portalId,
      accountType: accountDetails.accountType,
      crmSchemaAccessVerified,
      tokenHint,
      lgpdNotice,
    }
  } catch (error: any) {
    const parsed = parseHubSpotApiError(error)
    const status: HubSpotConnectionTestStatus =
      parsed.httpStatus === 401
        ? 'auth_failed'
        : parsed.httpStatus === 403
          ? 'forbidden'
          : 'unavailable'

    logger.warn('[testHubSpotConnection] Falha no teste de conexao HubSpot', {
      status,
      httpStatus: parsed.httpStatus,
      errorCode: parsed.errorCode,
    })

    return {
      success: false,
      provider: 'hubspot',
      status,
      message: parsed.message,
      testedAt,
      crmSchemaAccessVerified: false,
      httpStatus: parsed.httpStatus,
      errorCode: parsed.errorCode,
      tokenHint,
      lgpdNotice,
    }
  }
}
