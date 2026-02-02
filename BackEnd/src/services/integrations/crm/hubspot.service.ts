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

/**
 * Busca a integração CRM do agente
 */
async function getCRMIntegration(crmIntegrationId: string) {
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

    const apiKey = integration.api_key || integration.access_token
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

    const apiKey = integration.api_key || integration.access_token
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

    const apiKey = integration.api_key || integration.access_token
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

    const apiKey = integration.api_key || integration.access_token
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
