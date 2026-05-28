import { Request, Response } from 'express'
import { checkConnectionStatus } from '../../services/integrations/whatsapp'
import {
  clearHistory,
  getHistoryFromRedis,
  getUnreadConversations,
  saveMessageToHistory
} from '../../services/integrations/whatsapp/whatsapp.redis'
import { createOrUpdateContact } from '../../services/integrations/whatsapp/whatsapp.contacts'
import {
  extractMetaWebhookCalls,
  extractMetaWebhookMessages,
  extractMetaWebhookStatuses,
  isMetaWebhookPayload,
  normalizeDigits,
  validateMetaWebhookVerification
} from '../../services/integrations/whatsapp/whatsapp.meta'
import {
  getWhatsAppHistory,
  saveWhatsAppMessage,
  updateWhatsAppMessageStatus
} from '../../services/integrations/whatsapp/whatsapp.service'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { routeWhatsAppAutomation } from '../../services/automation/automation-router'
import { recordWhatsappMessageEvent } from '../../services/integrations/whatsapp/whatsapp-message-events.service'
import { getCustomerCareWindowState } from '../../services/integrations/whatsapp/whatsapp-session-window.service'
import {
  listStoredTemplates,
  syncTemplatesFromMetaForIntegration
} from '../../services/integrations/whatsapp/whatsapp-template-catalog.service'
import {
  acceptWhatsAppCall,
  preAcceptWhatsAppCall,
  rejectWhatsAppCall,
  sendWhatsAppTemplate
} from '../../services/integrations/whatsapp/whatsapp.dispatcher'
import {
  createCampaignRecord,
  enqueueCampaignContacts,
  processCampaignJobsOnce
} from '../../services/integrations/whatsapp/whatsapp-campaign.service'
import { getStoredAgentVoiceProfile } from '../../modules/voice/services/voiceProfile.service'
import { getRealtimeVoiceAgentService } from '../../modules/voice/services/voiceRuntime.service'
import { upsertVoiceCallSession } from '../../modules/voice/services/voiceCallSession.service'
import { applyDLP } from '../../services/governance/governance-postprocessing'
import {
  FALLBACK_GOVERNANCE_FOR_PREPROCESS,
  getGovernanceConfigForRuntime,
  type GovernanceConfig,
} from '../../services/governance/governance.service'

type StoredWhatsAppIntegration = {
  id: string
  user_id: string | null
  companies_id?: string | null
  phone_number: string | null
  app_key: string | null
  access_token?: string | null
  auth_token?: string | null
  provider: string | null
  automation_mode?: string | null
  linked_flow_id?: string | null
  created_at?: string | null
}

type LinkedAgent = {
  id: string
  nome: string | null
  status_id: number | string | null
  updated_at?: string | null
  created_at?: string | null
}

type WhatsAppContactRow = {
  id: string
  phone_number: string | null
  lid?: string | null
  status?: string | null
}

type LinkedFlow = {
  id: string
  name: string | null
}

type CurrentWhatsAppConversation = {
  whatsapp_contact_id: string
  phone_number: string | null
  lid: string | null
  contact_label: string
  last_message_id: string
  last_message: string
  last_message_direction: 'inbound' | 'outbound'
  last_message_status: string | null
  last_message_at: string
  unread_count: number
  agent_id: string | null
  agent_name: string | null
  agent_status_id: number | string | null
}

function normalizePhoneNumberForDatabase(phoneNumberOrId: string): string {
  if (phoneNumberOrId.endsWith('@s.whatsapp.net')) {
    return phoneNumberOrId.replace('@s.whatsapp.net', '')
  }

  return phoneNumberOrId
}

function getEnvMetaPhoneNumberId(): string {
  return String(process.env.WHATSAPP_META_PHONE_NUMBER_ID || '').trim()
}

function getEnvMetaBusinessNumber(): string {
  return normalizeDigits(process.env.WHATSAPP_META_BUSINESS_NUMBER || '')
}

function shouldUseEnvMetaConfig(): boolean {
  const source = String(process.env.WHATSAPP_META_CONFIG_SOURCE || '').trim().toLowerCase()
  const legacyFlag = String(process.env.WHATSAPP_META_USE_ENV_CONFIG || '').trim().toLowerCase()

  return source === 'env' || legacyFlag === 'true'
}

function shouldAllowEnvMetaFallback(): boolean {
  return String(process.env.WHATSAPP_META_ALLOW_ENV_FALLBACK || '').trim().toLowerCase() === 'true'
}

function canResolveIntegrationWithEnvMetaFallback(): boolean {
  return shouldUseEnvMetaConfig() || shouldAllowEnvMetaFallback()
}

function normalizeLinkedAgentId(value: unknown): string | null {
  const normalized = String(value || '').trim()

  if (!normalized || normalized === 'none' || normalized === 'loading') {
    return null
  }

  return normalized
}

function normalizeLinkedFlowId(value: unknown): string | null {
  const normalized = String(value || '').trim()

  if (!normalized || normalized === 'none' || normalized === 'loading') {
    return null
  }

  return normalized
}

function normalizeAutomationMode(value: unknown, linkedFlowId?: string | null): 'agent' | 'flow' | 'hybrid' {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized === 'flow' || normalized === 'hybrid') {
    return normalized
  }

  if (normalized === 'agent') {
    return 'agent'
  }

  return linkedFlowId ? 'flow' : 'agent'
}

function hasAutomationColumnError(error: any): boolean {
  const message = String(error?.message || error?.details || '').toLowerCase()
  return message.includes('column') && (message.includes('automation_mode') || message.includes('linked_flow_id'))
}

function getIntegrationUserEmail(integrationWithUser: any): string {
  const integrationUserRaw = integrationWithUser?.tb_users

  if (Array.isArray(integrationUserRaw)) {
    return String(integrationUserRaw[0]?.email || '').trim()
  }

  return String(integrationUserRaw?.email || '').trim()
}

function getWebhookQueryValue(query: Record<string, unknown>, dottedKey: string): string {
  const directValue = query[dottedKey]
  if (directValue !== undefined && directValue !== null) {
    return Array.isArray(directValue) ? String(directValue[0] || '') : String(directValue)
  }

  const [parentKey, childKey] = dottedKey.split('.', 2)
  const parentValue = query[parentKey]
  if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
    const nestedValue = (parentValue as Record<string, unknown>)[childKey]
    return Array.isArray(nestedValue) ? String(nestedValue[0] || '') : String(nestedValue || '')
  }

  return ''
}

function maskTokenForLog(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return 'empty'
  }

  if (normalized.length <= 8) {
    return `${normalized.length}:****`
  }

  return `${normalized.length}:${normalized.slice(0, 4)}...${normalized.slice(-4)}`
}

function isAgentActive(statusId: unknown): boolean {
  if (statusId === null || statusId === undefined) {
    return false
  }

  const numericStatus =
    typeof statusId === 'string'
      ? parseInt(statusId, 10)
      : Number(statusId)

  return numericStatus === 1
}

function pickPreferredAgent(agents: LinkedAgent[]): LinkedAgent | null {
  if (!Array.isArray(agents) || agents.length === 0) {
    return null
  }

  const activeAgent = agents.find((agent) => isAgentActive(agent.status_id))
  if (activeAgent) {
    return activeAgent
  }

  return agents[0] || null
}

function getContactLabel(contact: WhatsAppContactRow | null | undefined, fallbackId?: string): string {
  const normalizedPhone = String(contact?.phone_number || '').trim()
  if (normalizedPhone) {
    return normalizedPhone
  }

  const normalizedLid = String(contact?.lid || '').trim()
  if (normalizedLid) {
    return normalizedLid
  }

  return String(fallbackId || '').trim() || 'Contato sem identificador'
}

function getStoredWhatsAppStatus(direction: unknown, metadata: unknown, isRead?: boolean | null): string | null {
  if (direction === 'inbound') {
    return isRead === false ? 'received_unread' : 'received'
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return direction === 'outbound' ? 'accepted' : null
  }

  const metadataRecord = metadata as Record<string, any>
  const normalizedStatus = String(
    metadataRecord.whatsapp_status || metadataRecord.delivery_status || ''
  )
    .trim()
    .toLowerCase()

  if (normalizedStatus) {
    return normalizedStatus
  }

  return direction === 'outbound' ? 'accepted' : null
}

function buildWhatsAppIntegrationResponse(
  integration: StoredWhatsAppIntegration | null,
  linkedAgent: LinkedAgent | null,
  linkedFlow?: LinkedFlow | null,
  options?: { includeSecrets?: boolean }
) {
  if (!integration) {
    return null
  }

  const includeSecrets = options?.includeSecrets ?? true

  return {
    id: integration.id,
    phone_number: integration.phone_number,
    app_key: integration.app_key,
    access_token: includeSecrets ? integration.access_token : null,
    auth_token: includeSecrets ? integration.auth_token : null,
    has_access_token: !!String(integration.access_token || '').trim(),
    has_auth_token: !!String(integration.auth_token || '').trim(),
    provider: integration.provider,
    automation_mode: normalizeAutomationMode(integration.automation_mode, integration.linked_flow_id),
    linked_flow_id: integration.linked_flow_id || null,
    linked_flow_name: linkedFlow?.name || null,
    created_at: integration.created_at,
    linked_agent_id: linkedAgent?.id || null,
    linked_agent_name: linkedAgent?.nome || null,
    linked_agent_status_id: linkedAgent?.status_id ?? null
  }
}

async function resolveStoredMetaVerifyToken(receivedToken?: string): Promise<string | undefined> {
  const normalizedToken = String(receivedToken || '').trim()

  if (!normalizedToken) {
    return undefined
  }

  const envVerifyToken = String(process.env.WHATSAPP_META_VERIFY_TOKEN || '').trim()
  if (envVerifyToken && normalizedToken === envVerifyToken) {
    return envVerifyToken
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, auth_token')
    .eq('provider', 'whatsapp')
    .eq('auth_token', normalizedToken)
    .maybeSingle()

  if (error) {
    logger.error('[verifyWhatsAppWebhook] Erro ao buscar verify token salvo na integracao', {
      error: error.message
    })
    return undefined
  }

  return String((data as any)?.auth_token || '').trim() || undefined
}

function normalizeMetaCallStartedAt(timestamp?: string): string {
  const normalized = String(timestamp || '').trim()
  if (!normalized) {
    return new Date().toISOString()
  }

  const numeric = Number(normalized)
  if (Number.isFinite(numeric)) {
    return new Date(numeric > 100000000000 ? numeric : numeric * 1000).toISOString()
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

async function findMetaIntegrationForMessage(instance: string, phoneNumberId?: string): Promise<StoredWhatsAppIntegration | null> {
  const normalizedInstance = normalizeDigits(instance)
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim()
  const envFallbackEnabled = canResolveIntegrationWithEnvMetaFallback()
  const envPhoneNumberId = envFallbackEnabled ? getEnvMetaPhoneNumberId() : ''
  const envBusinessNumber = envFallbackEnabled ? getEnvMetaBusinessNumber() : ''

  if (normalizedPhoneNumberId) {
    const { data, error } = await supabase
      .from('tb_integrations')
      .select('id, user_id, companies_id, phone_number, app_key, provider, created_at')
      .eq('provider', 'whatsapp')
      .eq('app_key', normalizedPhoneNumberId)
      .maybeSingle()

    if (!error && data) {
      return data as StoredWhatsAppIntegration
    }
  }

  if (!normalizedInstance) {
    return null
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, user_id, companies_id, phone_number, app_key, provider, created_at')
    .eq('provider', 'whatsapp')
    .eq('phone_number', normalizedInstance)
    .maybeSingle()

  if (!error && data) {
    return data as StoredWhatsAppIntegration
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('tb_integrations')
    .select('id, user_id, companies_id, phone_number, app_key, provider, created_at')
    .eq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (fallbackError) {
    logger.error('[receiveWhatsAppWebhook] Erro ao buscar integracao por fallback', {
      error: fallbackError.message,
      instance: normalizedInstance,
      phoneNumberId: normalizedPhoneNumberId
    })
    return null
  }

  const fallbackMatch = (fallbackRows || []).find((row: any) => {
    const storedPhoneNumber = normalizeDigits(row?.phone_number)
    const storedPhoneNumberId = String(row?.app_key || '').trim()

    return (
      (!!normalizedPhoneNumberId && storedPhoneNumberId === normalizedPhoneNumberId) ||
      (!!normalizedInstance && storedPhoneNumber === normalizedInstance)
    )
  })

  if (fallbackMatch) {
    return fallbackMatch as StoredWhatsAppIntegration
  }

  const webhookMatchesEnv =
    (!!normalizedPhoneNumberId && !!envPhoneNumberId && normalizedPhoneNumberId === envPhoneNumberId) ||
    (!!normalizedInstance && !!envBusinessNumber && normalizedInstance === envBusinessNumber)

  if (envFallbackEnabled && webhookMatchesEnv) {
    const envMatch = (fallbackRows || []).find((row: any) => {
      const storedPhoneNumber = normalizeDigits(row?.phone_number)
      const storedPhoneNumberId = String(row?.app_key || '').trim()

      return (
        (!!envPhoneNumberId && storedPhoneNumberId === envPhoneNumberId) ||
        (!!envBusinessNumber && storedPhoneNumber === envBusinessNumber)
      )
    })

    if (envMatch) {
      logger.warn('[receiveWhatsAppWebhook] Integracao resolvida por fallback de env Meta', {
        integrationId: envMatch.id,
        instance: normalizedInstance,
        phoneNumberId: normalizedPhoneNumberId
      })
      return envMatch as StoredWhatsAppIntegration
    }

    if ((fallbackRows || []).length === 1) {
      const onlyIntegration = (fallbackRows || [])[0]
      logger.warn('[receiveWhatsAppWebhook] Integracao unica usada por fallback de env Meta', {
        integrationId: onlyIntegration?.id,
        instance: normalizedInstance,
        phoneNumberId: normalizedPhoneNumberId
      })
      return onlyIntegration as StoredWhatsAppIntegration
    }

    logger.warn('[receiveWhatsAppWebhook] Webhook bate com env Meta, mas ha mais de uma integracao WhatsApp candidata', {
      instance: normalizedInstance,
      phoneNumberId: normalizedPhoneNumberId,
      candidateCount: (fallbackRows || []).length
    })
  }

  return null
}

async function getAuthenticatedPlatformUser(email: string): Promise<{ id: string; companies_id: string | null }> {
  const { data: userData, error: userError } = await supabase
    .from('tb_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (userError || !userData?.id) {
    throw new Error('Usuario autenticado nao encontrado na tabela tb_users')
  }

  const { data: companyUser, error: companyUserError } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', userData.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyUserError) {
    throw new Error(companyUserError.message)
  }

  return {
    id: userData.id,
    companies_id: companyUser?.companies_id || null
  }
}

function isOwnedWhatsAppIntegration(
  integration: StoredWhatsAppIntegration,
  userId: string,
  companiesId: string | null
): boolean {
  return (
    integration.user_id === userId ||
    (!!companiesId && integration.companies_id === companiesId)
  )
}

function getRequestAuthEmail(req: Request): string | null {
  return String(req.user?.email || '').trim() || null
}

function respondWhatsAppOwnershipError(res: Response, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  if (message.includes('Acesso negado')) {
    res.status(403).json({ error: 'Acesso negado a esta integracao', details: message })
    return true
  }
  if (message.includes('nao encontrada') || message.includes('não encontrada')) {
    res.status(404).json({ error: 'Integracao WhatsApp nao encontrada', details: message })
    return true
  }
  if (message.includes('Usuario autenticado nao encontrado')) {
    res.status(401).json({ error: 'Usuario nao autenticado', details: message })
    return true
  }
  return false
}

async function loadOwnedWhatsAppIntegration(
  email: string,
  integrationId: string
): Promise<StoredWhatsAppIntegration> {
  const platformUser = await getAuthenticatedPlatformUser(email)
  let response = await supabase
    .from('tb_integrations')
    .select(
      'id, user_id, companies_id, phone_number, app_key, access_token, auth_token, provider, automation_mode, linked_flow_id, created_at'
    )
    .eq('id', integrationId)
    .eq('provider', 'whatsapp')
    .maybeSingle()

  if (response.error && hasAutomationColumnError(response.error)) {
    response = await supabase
      .from('tb_integrations')
      .select('id, user_id, companies_id, phone_number, app_key, access_token, auth_token, provider, created_at')
      .eq('id', integrationId)
      .eq('provider', 'whatsapp')
      .maybeSingle()
  }

  if (response.error || !response.data) {
    throw new Error('Integracao WhatsApp nao encontrada')
  }

  const row = response.data as StoredWhatsAppIntegration
  if (!isOwnedWhatsAppIntegration(row, platformUser.id, platformUser.companies_id)) {
    throw new Error('Acesso negado a esta integracao')
  }

  return row
}

function normalizeWhatsappPayload(body: any) {
  const phoneNumber = normalizeDigits(String(body?.phone_number || body?.phoneNumber || ''))
  const appKey = String(body?.app_key || body?.phoneNumberId || '').trim()
  const accessToken = String(body?.access_token || body?.accessToken || '').trim()
  const authToken = String(body?.auth_token || body?.verifyToken || '').trim()

  return {
    phone_number: phoneNumber || null,
    app_key: appKey || null,
    access_token: accessToken || null,
    auth_token: authToken || null
  }
}

function hasAnyWhatsAppConfig(payload: ReturnType<typeof normalizeWhatsappPayload>): boolean {
  return !!(payload.phone_number || payload.app_key || payload.access_token || payload.auth_token)
}

async function loadCandidateWhatsAppIntegrations(): Promise<StoredWhatsAppIntegration[]> {
  let response: any = await supabase
    .from('tb_integrations')
    .select('id, user_id, companies_id, phone_number, app_key, access_token, auth_token, provider, automation_mode, linked_flow_id, created_at')
    .eq('provider', 'whatsapp')
    .order('created_at', { ascending: false })

  if (response.error && hasAutomationColumnError(response.error)) {
    response = await supabase
      .from('tb_integrations')
      .select('id, user_id, companies_id, phone_number, app_key, access_token, auth_token, provider, created_at')
      .eq('provider', 'whatsapp')
      .order('created_at', { ascending: false })
  }

  if (response.error) {
    throw new Error(response.error.message)
  }

  return Array.isArray(response.data) ? (response.data as StoredWhatsAppIntegration[]) : []
}

async function loadLinkedAgentsForIntegration(
  integrationId: string,
  companiesId: string | null
): Promise<LinkedAgent[]> {
  let query = supabase
    .from('tb_agents')
    .select('id, nome, status_id, updated_at, created_at')
    .eq('integrations_id', integrationId)
    .order('updated_at', { ascending: false })

  if (companiesId) {
    query = query.eq('companies_id', companiesId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data as LinkedAgent[]) : []
}

async function getCurrentOwnedWhatsAppContext(email: string): Promise<{
  platformUser: { id: string; companies_id: string | null }
  integration: StoredWhatsAppIntegration | null
}> {
  const platformUser = await getAuthenticatedPlatformUser(email)
  const rows = await loadCandidateWhatsAppIntegrations()
  const integration = pickPrimaryOwnedIntegration(rows, platformUser.id, platformUser.companies_id)

  return {
    platformUser,
    integration
  }
}

async function processInboundWhatsAppCall(metaCall: {
  callId: string
  from: string
  event: string
  status?: string
  direction?: string
  timestamp?: string
  sdpOffer?: string
  instance: string
  phoneNumberId?: string
}): Promise<{
  call_id: string
  action: 'accepted' | 'rejected' | 'ignored'
  integration_id?: string
  agent_id?: string
  reason?: string
  reject_error?: string
}> {
  const integration = await findMetaIntegrationForMessage(metaCall.instance, metaCall.phoneNumberId)

  if (!integration) {
    logger.warn('[receiveWhatsAppWebhook] Integracao Meta nao encontrada para chamada recebida', {
      callId: metaCall.callId,
      instance: metaCall.instance,
      phoneNumberId: metaCall.phoneNumberId,
      from: metaCall.from
    })
    return {
      call_id: metaCall.callId,
      action: 'ignored',
      reason: 'integration_not_found'
    }
  }

  logger.info('[receiveWhatsAppWebhook] Chamada Meta recebida para processamento', {
    integrationId: integration.id,
    callId: metaCall.callId,
    event: metaCall.event,
    status: metaCall.status || null,
    direction: metaCall.direction || null,
    phoneNumberId: metaCall.phoneNumberId || null,
    from: metaCall.from,
    hasSdpOffer: !!metaCall.sdpOffer
  })

  const normalizedEvent = String(metaCall.event || '').toLowerCase()
  if (['terminate', 'terminated', 'call_terminate', 'ended', 'failed'].includes(normalizedEvent)) {
    try {
      const realtimeService = getRealtimeVoiceAgentService()
      await realtimeService.closeSession?.(metaCall.callId)
    } catch (closeError: any) {
      logger.warn('[receiveWhatsAppWebhook] Falha ao fechar sessao realtime da chamada', {
        callId: metaCall.callId,
        error: closeError?.message || String(closeError),
      })
    }

    await upsertVoiceCallSession({
      callId: metaCall.callId,
      integrationId: integration.id,
      companiesId: integration.companies_id || null,
      caller: metaCall.from,
      phoneNumberId: metaCall.phoneNumberId || null,
      status: normalizedEvent === 'failed' ? 'failed' : 'terminated',
      reason: normalizedEvent,
      metadata: {
        event: metaCall.event,
        status: metaCall.status || null
      }
    })

    return {
      call_id: metaCall.callId,
      action: 'ignored',
      integration_id: integration.id,
      reason: normalizedEvent
    }
  }

  let linkedAgents: LinkedAgent[] = []
  try {
    linkedAgents = await loadLinkedAgentsForIntegration(integration.id, integration.companies_id || null)
  } catch (agentLoadError: any) {
    logger.error('[receiveWhatsAppWebhook] Erro ao buscar agente vinculado para chamada WhatsApp', {
      integrationId: integration.id,
      callId: metaCall.callId,
      error: agentLoadError?.message
    })
  }

  const agent = pickPreferredAgent(linkedAgents)
  const rejectCall = async (reason: string) => {
    logger.warn('[receiveWhatsAppWebhook] Chamada WhatsApp sera recusada', {
      integrationId: integration.id,
      agentId: agent?.id || null,
      callId: metaCall.callId,
      reason,
      phoneNumberId: metaCall.phoneNumberId || null,
      hasSdpOffer: !!metaCall.sdpOffer
    })

    const rejectResult = await rejectWhatsAppCall(integration.id, metaCall.callId, metaCall.phoneNumberId)
    await upsertVoiceCallSession({
      callId: metaCall.callId,
      integrationId: integration.id,
      agentId: agent?.id || null,
      companiesId: integration.companies_id || null,
      caller: metaCall.from,
      phoneNumberId: metaCall.phoneNumberId || null,
      status: 'rejected',
      reason,
      sdpOffer: metaCall.sdpOffer || null,
      metadata: {
        event: metaCall.event,
        status: metaCall.status || null,
        reject_success: rejectResult.success,
        reject_error: rejectResult.error || null
      }
    })
    return {
      call_id: metaCall.callId,
      action: 'rejected' as const,
      integration_id: integration.id,
      agent_id: agent?.id,
      reason,
      reject_error: rejectResult.success ? undefined : rejectResult.error
    }
  }

  if (!agent) {
    return rejectCall('agent_not_found')
  }

  if (!isAgentActive(agent.status_id)) {
    return rejectCall('agent_inactive')
  }

  let voiceProfile
  try {
    voiceProfile = await getStoredAgentVoiceProfile(agent.id)
  } catch (error: any) {
    logger.error('[receiveWhatsAppWebhook] Erro ao buscar perfil de voz para chamada WhatsApp', {
      integrationId: integration.id,
      agentId: agent.id,
      callId: metaCall.callId,
      error: error?.message
    })
    return rejectCall('voice_profile_lookup_failed')
  }

  if (!voiceProfile?.enabled || !voiceProfile.voiceId) {
    logger.warn('[receiveWhatsAppWebhook] Perfil de voz do agente indisponivel para chamada', {
      integrationId: integration.id,
      agentId: agent.id,
      callId: metaCall.callId,
      hasProfile: !!voiceProfile,
      enabled: voiceProfile?.enabled ?? null,
      hasVoiceId: !!voiceProfile?.voiceId
    })
    return rejectCall('voice_not_configured')
  }

  if (!voiceProfile.callsEnabled) {
    return rejectCall('agent_calls_disabled')
  }

  if (!metaCall.sdpOffer) {
    return rejectCall('missing_sdp_offer')
  }

  await upsertVoiceCallSession({
    callId: metaCall.callId,
    integrationId: integration.id,
    agentId: agent.id,
    companiesId: integration.companies_id || null,
    caller: metaCall.from,
    phoneNumberId: metaCall.phoneNumberId || null,
    status: 'received',
    reason: 'calls_enabled',
    sdpOffer: metaCall.sdpOffer,
    metadata: {
      event: metaCall.event,
      status: metaCall.status || null
    }
  })

  const realtimeService = getRealtimeVoiceAgentService()
  const supportsRealtime = await realtimeService.supportsRealtimeCalls()

  if (!supportsRealtime || !realtimeService.prepareInboundWhatsAppCall) {
    logger.warn('[receiveWhatsAppWebhook] Chamada habilitada, mas runtime realtime ainda nao esta registrado', {
      integrationId: integration.id,
      agentId: agent.id,
      callId: metaCall.callId
    })
    return rejectCall('realtime_runtime_unavailable')
  }

  const { data: integrationWithUserForCall, error: integrationUserForCallError } = await supabase
    .from('tb_integrations')
    .select(`
      user_id,
      tb_users!inner(email)
    `)
    .eq('id', integration.id)
    .maybeSingle()

  if (integrationUserForCallError) {
    logger.warn('[receiveWhatsAppWebhook] Falha ao buscar email do dono para chamada WhatsApp', {
      integrationId: integration.id,
      callId: metaCall.callId,
      error: integrationUserForCallError.message
    })
  }

  const userEmailForCall = getIntegrationUserEmail(integrationWithUserForCall)

  const voiceSession = {
    sessionId: metaCall.callId,
    callId: metaCall.callId,
    agentId: agent.id,
    integrationId: integration.id,
    provider: 'whatsapp_calling' as const,
    startedAt: normalizeMetaCallStartedAt(metaCall.timestamp),
    caller: metaCall.from,
    phoneNumberId: metaCall.phoneNumberId || null,
    userEmail: userEmailForCall || null,
    sdpOffer: metaCall.sdpOffer,
    metadata: {
      voiceId: voiceProfile.voiceId,
      voiceName: voiceProfile.voiceName,
      modelId: voiceProfile.modelId
    }
  }

  let prepared
  try {
    prepared = await realtimeService.prepareInboundWhatsAppCall(voiceSession)
  } catch (prepareError: any) {
    await upsertVoiceCallSession({
      callId: metaCall.callId,
      integrationId: integration.id,
      agentId: agent.id,
      companiesId: integration.companies_id || null,
      caller: metaCall.from,
      phoneNumberId: metaCall.phoneNumberId || null,
      status: 'failed',
      reason: 'prepare_failed',
      sdpOffer: metaCall.sdpOffer,
      metadata: {
        error: prepareError?.message || String(prepareError)
      }
    })
    return rejectCall('prepare_failed')
  }

  const normalizedSdpAnswer = String(prepared?.sdpAnswer || '').trim()

  if (!normalizedSdpAnswer) {
    return rejectCall('empty_sdp_answer')
  }

  logger.info('[receiveWhatsAppWebhook] SDP answer preparado para chamada WhatsApp', {
    integrationId: integration.id,
    agentId: agent.id,
    callId: metaCall.callId,
    phoneNumberId: metaCall.phoneNumberId || null,
    sdpAnswerLength: normalizedSdpAnswer.length
  })

  await upsertVoiceCallSession({
    callId: metaCall.callId,
    integrationId: integration.id,
    agentId: agent.id,
    companiesId: integration.companies_id || null,
    caller: metaCall.from,
    phoneNumberId: metaCall.phoneNumberId || null,
    status: 'received',
    reason: 'sdp_answer_prepared',
    sdpOffer: metaCall.sdpOffer,
    sdpAnswer: normalizedSdpAnswer,
    metadata: prepared.metadata || null
  })

  const preAcceptResult = await preAcceptWhatsAppCall(
    integration.id,
    metaCall.callId,
    normalizedSdpAnswer,
    metaCall.phoneNumberId
  )
  if (!preAcceptResult.success) {
    logger.warn('[receiveWhatsAppWebhook] Falha no pre_accept da chamada WhatsApp', {
      integrationId: integration.id,
      agentId: agent.id,
      callId: metaCall.callId,
      phoneNumberId: metaCall.phoneNumberId || null,
      error: preAcceptResult.error || null
    })
    await upsertVoiceCallSession({
      callId: metaCall.callId,
      integrationId: integration.id,
      agentId: agent.id,
      companiesId: integration.companies_id || null,
      caller: metaCall.from,
      phoneNumberId: metaCall.phoneNumberId || null,
      status: 'failed',
      reason: 'pre_accept_failed',
      sdpOffer: metaCall.sdpOffer,
      sdpAnswer: normalizedSdpAnswer,
      metadata: { error: preAcceptResult.error || null }
    })
    return rejectCall('pre_accept_failed')
  }

  await upsertVoiceCallSession({
    callId: metaCall.callId,
    integrationId: integration.id,
    agentId: agent.id,
    companiesId: integration.companies_id || null,
    caller: metaCall.from,
    phoneNumberId: metaCall.phoneNumberId || null,
    status: 'pre_accepted',
    reason: 'pre_accept_success',
    sdpOffer: metaCall.sdpOffer,
    sdpAnswer: normalizedSdpAnswer,
    metadata: prepared.metadata || null
  })

  const acceptResult = await acceptWhatsAppCall(
    integration.id,
    metaCall.callId,
    normalizedSdpAnswer,
    metaCall.phoneNumberId
  )
  if (!acceptResult.success) {
    logger.warn('[receiveWhatsAppWebhook] Falha no accept da chamada WhatsApp', {
      integrationId: integration.id,
      agentId: agent.id,
      callId: metaCall.callId,
      phoneNumberId: metaCall.phoneNumberId || null,
      error: acceptResult.error || null
    })
    await upsertVoiceCallSession({
      callId: metaCall.callId,
      integrationId: integration.id,
      agentId: agent.id,
      companiesId: integration.companies_id || null,
      caller: metaCall.from,
      phoneNumberId: metaCall.phoneNumberId || null,
      status: 'failed',
      reason: 'accept_failed',
      sdpOffer: metaCall.sdpOffer,
      sdpAnswer: normalizedSdpAnswer,
      metadata: { error: acceptResult.error || null }
    })
    return {
      call_id: metaCall.callId,
      action: 'ignored',
      integration_id: integration.id,
      agent_id: agent.id,
      reason: 'accept_failed'
    }
  }

  await realtimeService.attachAgentVoice({
    ...voiceSession,
    sdpAnswer: normalizedSdpAnswer
  })

  await upsertVoiceCallSession({
    callId: metaCall.callId,
    integrationId: integration.id,
    agentId: agent.id,
    companiesId: integration.companies_id || null,
    caller: metaCall.from,
    phoneNumberId: metaCall.phoneNumberId || null,
    status: 'accepted',
    reason: 'calls_enabled',
    sdpOffer: metaCall.sdpOffer,
    sdpAnswer: normalizedSdpAnswer,
    metadata: prepared.metadata || null
  })

  return {
    call_id: metaCall.callId,
    action: 'accepted',
    integration_id: integration.id,
    agent_id: agent.id,
    reason: 'calls_enabled'
  }
}

async function validateAssignableAgent(
  linkedAgentId: string,
  companiesId: string | null
): Promise<LinkedAgent> {
  if (!companiesId) {
    throw new Error('Nao foi possivel identificar a empresa para vincular o agente ao WhatsApp.')
  }

  const { data, error } = await supabase
    .from('tb_agents')
    .select('id, nome, status_id, updated_at, created_at')
    .eq('id', linkedAgentId)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error || !data) {
    throw new Error('O agente selecionado nao pertence a sua empresa ou nao foi encontrado.')
  }

  return data as LinkedAgent
}

async function loadLinkedFlow(
  linkedFlowId: string | null | undefined,
  companiesId: string | null
): Promise<LinkedFlow | null> {
  const normalizedFlowId = String(linkedFlowId || '').trim()
  if (!normalizedFlowId) {
    return null
  }

  let query = supabase
    .from('tb_flows')
    .select('id, name, companies_id')
    .eq('id', normalizedFlowId)

  if (companiesId) {
    query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
  } else {
    query = query.is('companies_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return {
    id: String((data as any).id),
    name: String((data as any).name || '').trim() || null
  }
}

async function validateAssignableFlow(
  linkedFlowId: string,
  companiesId: string | null
): Promise<LinkedFlow> {
  const flow = await loadLinkedFlow(linkedFlowId, companiesId)

  if (!flow) {
    throw new Error('O flow selecionado nao pertence a sua empresa ou nao foi encontrado.')
  }

  return flow
}

async function clearAgentAssignmentsForIntegrations(
  companiesId: string | null,
  integrationIds: string[]
): Promise<void> {
  const uniqueIntegrationIds = Array.from(new Set(integrationIds.filter(Boolean)))

  if (!companiesId || uniqueIntegrationIds.length === 0) {
    return
  }

  const { error } = await supabase
    .from('tb_agents')
    .update({ integrations_id: null })
    .eq('companies_id', companiesId)
    .in('integrations_id', uniqueIntegrationIds)

  if (error) {
    throw new Error(error.message)
  }
}

async function syncCurrentIntegrationAgentAssignment(
  companiesId: string | null,
  integrationId: string,
  linkedAgentId: string | null
): Promise<void> {
  if (!companiesId) {
    if (linkedAgentId) {
      throw new Error('Nao foi possivel identificar a empresa para vincular o agente ao WhatsApp.')
    }
    return
  }

  const { data: companyAgents, error: companyAgentsError } = await supabase
    .from('tb_agents')
    .select('id, integrations_id')
    .eq('companies_id', companiesId)

  if (companyAgentsError) {
    throw new Error(companyAgentsError.message)
  }

  const agentsUsingThisIntegration = (companyAgents || [])
    .filter((agent: any) => String(agent?.integrations_id || '').trim() === integrationId)
    .map((agent: any) => String(agent.id))

  if (!linkedAgentId) {
    if (agentsUsingThisIntegration.length > 0) {
      const { error } = await supabase
        .from('tb_agents')
        .update({ integrations_id: null })
        .eq('companies_id', companiesId)
        .in('id', agentsUsingThisIntegration)

      if (error) {
        throw new Error(error.message)
      }
    }

    return
  }

  const idsToClear = agentsUsingThisIntegration.filter((agentId) => agentId !== linkedAgentId)
  if (idsToClear.length > 0) {
    const { error } = await supabase
      .from('tb_agents')
      .update({ integrations_id: null })
      .eq('companies_id', companiesId)
      .in('id', idsToClear)

    if (error) {
      throw new Error(error.message)
    }
  }

  const { error: assignError } = await supabase
    .from('tb_agents')
    .update({ integrations_id: integrationId })
    .eq('id', linkedAgentId)
    .eq('companies_id', companiesId)

  if (assignError) {
    throw new Error(assignError.message)
  }
}

async function saveWhatsAppTrafficLog(params: {
  direction: 'inbound' | 'outbound'
  integration: StoredWhatsAppIntegration
  userEmail?: string
  phoneNumber?: string | null
  contactId?: string | null
  agent?: LinkedAgent | null
  message: string
  messageId?: string
}): Promise<void> {
  try {
    const { saveSystemLog } = await import('../../services/system-logs')

    const normalizedPhone = String(params.phoneNumber || '').trim() || null
    const messageLength = params.message.trim().length

    await saveSystemLog({
      user_id: params.integration.user_id || undefined,
      companies_id: params.integration.companies_id || undefined,
      user_email: params.userEmail,
      agent_id: params.agent?.id || undefined,
      log_type: params.direction === 'inbound' ? 'whatsapp_inbound' : 'whatsapp_outbound',
      level: 'info',
      message:
        params.direction === 'inbound'
          ? `WhatsApp recebido de ${normalizedPhone || 'contato desconhecido'}`
          : `WhatsApp enviado para ${normalizedPhone || 'contato desconhecido'}`,
      metadata: {
        integration_id: params.integration.id,
        integration_phone_number: params.integration.phone_number,
        contact_id: params.contactId || null,
        phone_number: normalizedPhone,
        message_id: params.messageId || null,
        message_length: messageLength,
        direction: params.direction,
        agent_name: params.agent?.nome || null
      },
      impact_level: 'low'
    })
  } catch (logError: any) {
    logger.warn('[saveWhatsAppTrafficLog] Falha ao salvar log operacional do WhatsApp', {
      direction: params.direction,
      integrationId: params.integration.id,
      error: logError?.message
    })
  }
}

function pickPrimaryOwnedIntegration(
  rows: StoredWhatsAppIntegration[],
  userId: string,
  companiesId: string | null
): StoredWhatsAppIntegration | null {
  const ownedRows = rows.filter((row) => isOwnedWhatsAppIntegration(row, userId, companiesId))

  const userOwned = ownedRows.find((row) => row.user_id === userId)
  if (userOwned) return userOwned

  return ownedRows[0] || null
}

export async function getCurrentWhatsAppIntegration(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { platformUser, integration } = await getCurrentOwnedWhatsAppContext(req.user.email)
    const linkedAgents = integration
      ? await loadLinkedAgentsForIntegration(integration.id, platformUser.companies_id)
      : []
    const linkedAgent = pickPreferredAgent(linkedAgents)
    const linkedFlow = integration
      ? await loadLinkedFlow(integration.linked_flow_id, platformUser.companies_id)
      : null

    return res.json({
      success: true,
      integration: buildWhatsAppIntegrationResponse(integration, linkedAgent, linkedFlow, { includeSecrets: false })
    })
  } catch (error: any) {
    logger.error('[getCurrentWhatsAppIntegration] Erro ao carregar integracao atual', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao carregar integracao WhatsApp',
      details: error.message
    })
  }
}

export async function upsertCurrentWhatsAppIntegration(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const platformUser = await getAuthenticatedPlatformUser(req.user.email)
    const normalizedPayload = normalizeWhatsappPayload(req.body)
    const linkedAgentId = normalizeLinkedAgentId(req.body?.linked_agent_id ?? req.body?.linkedAgentId)
    const linkedFlowId = normalizeLinkedFlowId(req.body?.linked_flow_id ?? req.body?.linkedFlowId)
    const automationMode = normalizeAutomationMode(req.body?.automation_mode ?? req.body?.automationMode, linkedFlowId)
    const hasConfig = hasAnyWhatsAppConfig(normalizedPayload)
    const rows = await loadCandidateWhatsAppIntegrations()

    const ownedRows = rows.filter((row) => isOwnedWhatsAppIntegration(row, platformUser.id, platformUser.companies_id))
    const primaryOwned = pickPrimaryOwnedIntegration(rows, platformUser.id, platformUser.companies_id)

    const conflictingRow = rows.find((row) => {
      const samePhone = !!normalizedPayload.phone_number && row.phone_number === normalizedPayload.phone_number
      const sameAppKey = !!normalizedPayload.app_key && row.app_key === normalizedPayload.app_key

      return (samePhone || sameAppKey) && !isOwnedWhatsAppIntegration(row, platformUser.id, platformUser.companies_id)
    })

    if (conflictingRow) {
      return res.status(409).json({
        error: 'Este numero oficial ou Phone Number ID ja esta vinculado a outra conta.',
        code: 'WHATSAPP_INTEGRATION_CONFLICT'
      })
    }

    if (linkedAgentId) {
      await validateAssignableAgent(linkedAgentId, platformUser.companies_id)
    }

    if (linkedFlowId) {
      await validateAssignableFlow(linkedFlowId, platformUser.companies_id)
    }

    if (!hasConfig) {
      await clearAgentAssignmentsForIntegrations(
        platformUser.companies_id,
        ownedRows.map((row) => row.id)
      )

      if (ownedRows.length > 0) {
        const { error: deleteError } = await supabase
          .from('tb_integrations')
          .delete()
          .in('id', ownedRows.map((row) => row.id))

        if (deleteError) {
          throw deleteError
        }
      }

      return res.json({
        success: true,
        deleted: true,
        integration: null
      })
    }

    const integrationPayload = {
      user_id: platformUser.id,
      companies_id: platformUser.companies_id,
      provider: 'whatsapp',
      phone_number: normalizedPayload.phone_number,
      app_key: normalizedPayload.app_key,
      access_token: normalizedPayload.access_token || primaryOwned?.access_token || null,
      auth_token: normalizedPayload.auth_token || primaryOwned?.auth_token || null
    }

    const integrationPayloadWithAutomation = {
      ...integrationPayload,
      automation_mode: automationMode,
      linked_flow_id: linkedFlowId
    }

    let integrationId: string | null = null

    if (primaryOwned?.id) {
      let updateResult = await supabase
        .from('tb_integrations')
        .update(integrationPayloadWithAutomation)
        .eq('id', primaryOwned.id)

      if (updateResult.error && hasAutomationColumnError(updateResult.error)) {
        updateResult = await supabase
          .from('tb_integrations')
          .update(integrationPayload)
          .eq('id', primaryOwned.id)
      }

      if (updateResult.error) {
        throw updateResult.error
      }

      integrationId = primaryOwned.id

      const duplicateOwnedIds = ownedRows
        .map((row) => row.id)
        .filter((id) => id !== primaryOwned.id)

      if (duplicateOwnedIds.length > 0) {
        const { error: deleteDuplicatesError } = await supabase
          .from('tb_integrations')
          .delete()
          .in('id', duplicateOwnedIds)

        if (deleteDuplicatesError) {
          throw deleteDuplicatesError
        }
      }
    } else {
      let insertResult = await supabase
        .from('tb_integrations')
        .insert(integrationPayloadWithAutomation)
        .select('id')
        .single()

      if (insertResult.error && hasAutomationColumnError(insertResult.error)) {
        insertResult = await supabase
          .from('tb_integrations')
          .insert(integrationPayload)
          .select('id')
          .single()
      }

      if (insertResult.error) {
        throw insertResult.error
      }

      integrationId = insertResult.data?.id || null
    }

    if (integrationId) {
      await syncCurrentIntegrationAgentAssignment(
        platformUser.companies_id,
        integrationId,
        linkedAgentId
      )
    }

    const linkedAgents = integrationId
      ? await loadLinkedAgentsForIntegration(integrationId, platformUser.companies_id)
      : []
    const linkedAgent = pickPreferredAgent(linkedAgents)
    const linkedFlow = linkedFlowId
      ? await loadLinkedFlow(linkedFlowId, platformUser.companies_id)
      : null

    return res.json({
      success: true,
      integration: buildWhatsAppIntegrationResponse(
        {
          id: integrationId || '',
          ...integrationPayloadWithAutomation
        },
        linkedAgent,
        linkedFlow,
        { includeSecrets: false }
      )
    })
  } catch (error: any) {
    logger.error('[upsertCurrentWhatsAppIntegration] Erro ao salvar integracao atual', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao salvar integracao WhatsApp',
      details: error.message
    })
  }
}

export async function verifyWhatsAppWebhook(req: Request, res: Response) {
  const query = req.query as Record<string, unknown>
  const hubMode = getWebhookQueryValue(query, 'hub.mode')
  const receivedVerifyToken = getWebhookQueryValue(query, 'hub.verify_token')
  const hubChallenge = getWebhookQueryValue(query, 'hub.challenge')

  // Probe simples (curl, monitor) sem query da Meta — endpoint no ar, nao e erro de servidor.
  if (!hubMode && !receivedVerifyToken && !hubChallenge) {
    return res.status(200).json({
      ok: true,
      service: 'whatsapp_webhook',
      hint: 'Verificacao Meta: GET com hub.mode, hub.verify_token e hub.challenge',
    })
  }

  const normalizedVerificationQuery = {
    ...query,
    'hub.mode': hubMode,
    'hub.verify_token': receivedVerifyToken,
    'hub.challenge': hubChallenge,
  }
  const verifyToken = await resolveStoredMetaVerifyToken(receivedVerifyToken)
  const verification = validateMetaWebhookVerification(normalizedVerificationQuery, verifyToken)

  if (verification.ok && verification.challenge) {
    logger.log('[verifyWhatsAppWebhook] Webhook da Meta verificado com sucesso')
    return res.status(200).send(verification.challenge)
  }

  if (!verifyToken) {
    logger.error('[verifyWhatsAppWebhook] Verify token da Meta nao encontrado em nenhuma integracao', {
      receivedToken: maskTokenForLog(receivedVerifyToken),
      envToken: maskTokenForLog(String(process.env.WHATSAPP_META_VERIFY_TOKEN || '')),
      queryKeys: Object.keys(query)
    })
    return res.status(500).json({
      error: 'Verify token da Meta nao encontrado em nenhuma integracao WhatsApp'
    })
  }

  logger.warn('[verifyWhatsAppWebhook] Falha na verificacao do webhook da Meta', {
    query: req.query
  })

  return res.sendStatus(403)
}

export async function getWhatsAppStatus(req: Request, res: Response) {
  try {
    const email = getRequestAuthEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({ error: 'integration_id e obrigatorio' })
    }

    await loadOwnedWhatsAppIntegration(email, String(integration_id))
    const status = await checkConnectionStatus(integration_id as string)

    return res.json({
      success: true,
      status,
      message:
        status === 'connected'
          ? 'WhatsApp esta conectado'
          : status === 'connecting'
            ? 'WhatsApp esta conectando...'
            : 'WhatsApp esta desconectado. Verifique Phone Number ID, Access Token, Verify Token e o webhook da Meta.'
    })
  } catch (error: any) {
    if (respondWhatsAppOwnershipError(res, error)) return
    logger.error('[getWhatsAppStatus] Erro ao verificar status', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao verificar status',
      details: error.message
    })
  }
}

export async function listWhatsAppIntegrations(req: Request, res: Response) {
  try {
    const email = getRequestAuthEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const platformUser = await getAuthenticatedPlatformUser(email)

    let query = supabase
      .from('tb_integrations')
      .select('id, phone_number, provider, created_at')
      .eq('provider', 'whatsapp')

    if (platformUser.companies_id) {
      query = query.eq('companies_id', platformUser.companies_id)
    } else {
      query = query.eq('user_id', platformUser.id)
    }

    const { data: integrations, error } = await query

    if (error) {
      throw error
    }

    return res.json({
      success: true,
      integrations: integrations || []
    })
  } catch (error: any) {
    if (respondWhatsAppOwnershipError(res, error)) return
    logger.error('[listWhatsAppIntegrations] Erro ao listar integracoes', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao listar integracoes',
      details: error.message
    })
  }
}

export async function receiveWhatsAppWebhook(req: Request, res: Response) {
  try {
    const webhookData = req.body

    logger.log('[receiveWhatsAppWebhook] Evento recebido da Meta', {
      object: webhookData?.object,
      entryCount: Array.isArray(webhookData?.entry) ? webhookData.entry.length : 0,
      changeCount: Array.isArray(webhookData?.entry)
        ? webhookData.entry.reduce((total: number, entry: any) => total + (Array.isArray(entry?.changes) ? entry.changes.length : 0), 0)
        : 0
    })

    if (!isMetaWebhookPayload(webhookData)) {
      logger.warn('[receiveWhatsAppWebhook] Payload rejeitado: somente a Meta e aceita neste endpoint', {
        bodyKeys: Object.keys(webhookData || {})
      })
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: 'unsupported_payload'
      })
    }

    const extractedCalls = extractMetaWebhookCalls(webhookData)
    const extractedMessages = extractMetaWebhookMessages(webhookData)
    const extractedStatuses = extractMetaWebhookStatuses(webhookData)

    if (extractedCalls.length === 0 && extractedMessages.length === 0 && extractedStatuses.length === 0) {
      logger.log('[receiveWhatsAppWebhook] Evento oficial da Meta recebido sem chamadas, mensagens ou status processaveis')
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: 'no_calls_messages_or_statuses'
      })
    }

    const processedCalls: any[] = []
    const processedMessages: any[] = []
    const processedStatuses: any[] = []

    for (const metaCall of extractedCalls) {
      try {
        const callResult = await processInboundWhatsAppCall(metaCall)
        processedCalls.push(callResult)
      } catch (callError: any) {
        logger.error('[receiveWhatsAppWebhook] Erro ao processar chamada recebida da Meta', {
          callId: metaCall.callId,
          phoneNumberId: metaCall.phoneNumberId,
          error: callError?.message
        })
        processedCalls.push({
          call_id: metaCall.callId,
          action: 'ignored',
          reason: 'call_processing_failed'
        })
      }
    }

    for (const metaMessage of extractedMessages) {
      const integration = await findMetaIntegrationForMessage(metaMessage.instance, metaMessage.phoneNumberId)

      if (!integration) {
        logger.warn('[receiveWhatsAppWebhook] Integracao Meta nao encontrada para mensagem recebida', {
          instance: metaMessage.instance,
          phoneNumberId: metaMessage.phoneNumberId,
          remoteJid: metaMessage.remoteJid
        })
        continue
      }

      const normalizedPhone = normalizePhoneNumberForDatabase(metaMessage.remoteJid)
      const contactResult = await createOrUpdateContact({
        lid: normalizedPhone,
        phone_number: normalizedPhone,
        status: 'active'
      })

      if (!contactResult.success || !contactResult.contact) {
        logger.error('[receiveWhatsAppWebhook] Erro ao criar/atualizar contato Meta', {
          integrationId: integration.id,
          phoneNumber: normalizedPhone,
          error: contactResult.error
        })
        continue
      }

      let linkedAgents: LinkedAgent[] = []
      try {
        linkedAgents = await loadLinkedAgentsForIntegration(integration.id, integration.companies_id || null)
      } catch (agentLoadError: any) {
        logger.error('[receiveWhatsAppWebhook] Erro ao buscar agentes vinculados a integracao WhatsApp', {
          integrationId: integration.id,
          error: agentLoadError?.message
        })
      }

      const agent = pickPreferredAgent(linkedAgents)
      await saveMessageToHistory(integration.id, normalizedPhone, 'user', metaMessage.messageText)

      const contactId = contactResult.contact.id

      if (integration.companies_id) {
        const { resolveInboundSession } = await import('../../services/service-session.service')
        const { notifyAtendimentoLimitReached } = await import(
          '../../services/atendimento-limit-notify.service'
        )
        const sessionResult = await resolveInboundSession({
          companiesId: integration.companies_id,
          integrationId: integration.id,
          whatsappContactId: contactId,
          inboundMessage: metaMessage.messageText,
        })
        if (sessionResult.blocked) {
          logger.warn('[receiveWhatsAppWebhook] Limite mensal de atendimentos atingido', {
            companiesId: integration.companies_id,
            contactId,
            reason: sessionResult.reason,
            conversationsUsed: sessionResult.conversationsUsed,
            conversationsLimit: sessionResult.conversationsLimit,
          })

          const { LIMIT_REACHED_COPY } = await import(
            '../../services/atendimento-limit-notify.service'
          )
          await saveWhatsAppMessage({
            whatsapp_contact_id: contactId,
            message: metaMessage.messageText,
            message_id: metaMessage.messageId,
            direction: 'inbound',
            integrations_id: integration.id,
            agent_id: agent?.id || undefined,
            metadata: {
              processing_status: 'blocked',
              block_reason: 'plan_limit_atendimentos',
              block_message: sessionResult.reason || LIMIT_REACHED_COPY,
              conversations_used: sessionResult.conversationsUsed ?? null,
              conversations_limit: sessionResult.conversationsLimit ?? null,
            },
          })

          try {
            await notifyAtendimentoLimitReached(integration.companies_id, {
              conversationsUsed: sessionResult.conversationsUsed,
              conversationsLimit: sessionResult.conversationsLimit,
            })
          } catch (notifyErr: unknown) {
            logger.error('[receiveWhatsAppWebhook] Falha ao notificar limite de atendimentos', {
              companiesId: integration.companies_id,
              error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
            })
          }
          continue
        }
      }

      let messageDbId: string | undefined
      const dbResult = await saveWhatsAppMessage({
        whatsapp_contact_id: contactId,
        message: metaMessage.messageText,
        message_id: metaMessage.messageId,
        direction: 'inbound',
        integrations_id: integration.id,
        agent_id: agent?.id || undefined
      })

      if (dbResult.success && dbResult.id) {
        messageDbId = dbResult.id
      } else {
        logger.warn('[receiveWhatsAppWebhook] Falha ao salvar mensagem inbound no banco', {
          integrationId: integration.id,
          phoneNumber: normalizedPhone,
          error: dbResult.error
        })
      }

      const { data: integrationWithUser, error: integrationUserError } = await supabase
        .from('tb_integrations')
        .select(`
          user_id,
          phone_number,
          tb_users!inner(email)
        `)
        .eq('id', integration.id)
        .maybeSingle()

      if (integrationUserError) {
        logger.error('[receiveWhatsAppWebhook] Erro ao buscar email do dono da integracao', {
          integrationId: integration.id,
          error: integrationUserError.message
        })
      }

      const integrationUserEmail = getIntegrationUserEmail(integrationWithUser)

      await saveWhatsAppTrafficLog({
        direction: 'inbound',
        integration,
        userEmail: integrationUserEmail || undefined,
        phoneNumber: normalizedPhone,
        contactId,
        agent,
        message: metaMessage.messageText,
        messageId: metaMessage.messageId
      })

      const nativeType = String((metaMessage as any).nativeMessageType || '').toLowerCase()
      const messageKind = nativeType === 'template' ? 'template' : 'session_text'
      void recordWhatsappMessageEvent({
        integrations_id: integration.id,
        companies_id: integration.companies_id || null,
        whatsapp_contact_id: contactId,
        wamid: metaMessage.messageId || null,
        event_type: 'received',
        message_kind: messageKind,
        payload: {
          message_length: String(metaMessage.messageText || '').length,
          native_message_type: nativeType || null
        }
      })

      if (linkedAgents.length > 1) {
        logger.warn('[receiveWhatsAppWebhook] Mais de um agente vinculado a mesma integracao WhatsApp; usando o primeiro agente ativo encontrado', {
          integrationId: integration.id,
          agentIds: linkedAgents.map((linkedAgent) => linkedAgent.id)
        })
      }

      if (integrationUserEmail) {
        const requestStartedAt = new Date().toISOString()

        void (async () => {
          try {
            const automationResult = await routeWhatsAppAutomation({
              integrationId: integration.id,
              companiesId: integration.companies_id || null,
              userEmail: integrationUserEmail,
              messageText: metaMessage.messageText,
              phoneNumber: normalizedPhone,
              from: metaMessage.remoteJid,
              to: String((integrationWithUser as any)?.phone_number || metaMessage.instance || '').trim(),
              contactId,
              messageDbId,
              externalMessageId: metaMessage.messageId || null,
              requestStartedAt
            })

            if (!automationResult.handled) {
              logger.warn('[receiveWhatsAppWebhook] Nenhuma automacao executada para a integracao WhatsApp', {
                integrationId: integration.id,
                mode: automationResult.mode,
                flowId: automationResult.flowId || null,
                agentId: automationResult.agentId || null,
                reason: automationResult.reason || null
              })
            }
          } catch (automationError: any) {
            logger.error('[receiveWhatsAppWebhook] Erro ao processar automacao do WhatsApp', {
              integrationId: integration.id,
              agentId: agent?.id || null,
              error: automationError?.message
            })
          }
        })()
      } else {
        logger.warn('[receiveWhatsAppWebhook] Email do dono da integracao nao encontrado', {
          integrationId: integration.id
        })
      }

      processedMessages.push({
        integration_id: integration.id,
        whatsapp_contact_id: contactResult.contact.id,
        message_id: metaMessage.messageId,
        phone_number: normalizedPhone
      })
    }

    for (const metaStatus of extractedStatuses) {
      const statusIntegration = await findMetaIntegrationForMessage('', metaStatus.phoneNumberId)

      const statusResult = await updateWhatsAppMessageStatus({
        messageId: metaStatus.messageId,
        status: metaStatus.status,
        timestamp: metaStatus.timestamp,
        recipientId: metaStatus.recipientId,
        phoneNumberId: metaStatus.phoneNumberId,
        conversationId: metaStatus.conversationId,
        pricingCategory: metaStatus.pricingCategory,
        errorCode: metaStatus.errorCode,
        errorTitle: metaStatus.errorTitle,
        errorMessage: metaStatus.errorMessage
      })

      if (!statusResult.success) {
        logger.warn('[receiveWhatsAppWebhook] Falha ao atualizar status da mensagem da Meta', {
          messageId: metaStatus.messageId,
          status: metaStatus.status,
          error: statusResult.error
        })
        continue
      }

      if (!statusResult.updatedCount) {
        logger.warn('[receiveWhatsAppWebhook] Status da Meta recebido sem mensagem correspondente no banco', {
          messageId: metaStatus.messageId,
          status: metaStatus.status
        })
        continue
      }

      if (statusIntegration) {
        const st = String(metaStatus.status || '').toLowerCase()
        const eventType =
          st === 'delivered' ? 'delivered' : st === 'failed' ? 'failed' : 'status_update'
        void recordWhatsappMessageEvent({
          integrations_id: statusIntegration.id,
          companies_id: statusIntegration.companies_id || null,
          wamid: metaStatus.messageId,
          event_type: eventType,
          message_kind: 'unknown',
          meta_status: metaStatus.status,
          template_category: metaStatus.pricingCategory || null,
          error_code: metaStatus.errorCode ?? null,
          error_message: metaStatus.errorMessage || null,
          payload: {
            recipient_id: metaStatus.recipientId || null,
            updated_rows: statusResult.updatedCount
          }
        })
      }

      processedStatuses.push({
        message_id: metaStatus.messageId,
        status: metaStatus.status,
        updated_rows: statusResult.updatedCount
      })
    }

    return res.status(200).json({
      received: true,
      call_events: processedCalls.length,
      processed: processedMessages.length,
      status_updates: processedStatuses.length,
      calls: processedCalls,
      messages: processedMessages,
      statuses: processedStatuses
    })
  } catch (error: any) {
    logger.error('[receiveWhatsAppWebhook] Erro ao processar webhook oficial da Meta', {
      error: error.message,
      stack: error.stack
    })
    return res.status(500).json({
      error: 'Erro ao processar webhook',
      details: error.message
    })
  }
}

export async function getWhatsAppHistoryEndpoint(req: Request, res: Response) {
  try {
    const email = getRequestAuthEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { integration_id, phone_number, limit } = req.query

    if (!integration_id || !phone_number) {
      return res.status(400).json({
        error: 'integration_id e phone_number sao obrigatorios'
      })
    }

    await loadOwnedWhatsAppIntegration(email, String(integration_id))

    const history = await getHistoryFromRedis(
      integration_id as string,
      phone_number as string,
      limit ? parseInt(limit as string, 10) : 20
    )

    return res.json({
      success: true,
      count: history.length,
      messages: history
    })
  } catch (error: any) {
    if (respondWhatsAppOwnershipError(res, error)) return
    logger.error('[getWhatsAppHistoryEndpoint] Erro ao buscar historico', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao buscar historico',
      details: error.message
    })
  }
}

export async function listStuckWhatsAppConversations(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { listStuckWhatsAppConversations: listStuck } = await import(
      '../../services/inbox-stuck-conversations.service'
    )
    const conversations = await listStuck(req.user.email)

    return res.json({
      success: true,
      conversations,
    })
  } catch (error: any) {
    logger.error('[listStuckWhatsAppConversations] Erro', { error: error.message })
    return res.status(500).json({
      error: 'Erro ao listar mensagens travadas',
      details: error.message,
    })
  }
}

export async function listCurrentWhatsAppConversations(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { platformUser, integration } = await getCurrentOwnedWhatsAppContext(req.user.email)
    const linkedAgents = integration
      ? await loadLinkedAgentsForIntegration(integration.id, platformUser.companies_id)
      : []
    const linkedAgent = pickPreferredAgent(linkedAgents)

    if (!integration) {
      return res.json({
        success: true,
        integration: null,
        conversations: []
      })
    }

    const { data: recentMessages, error: messagesError } = await supabase
      .from('tb_whatsapp_messages')
      .select('id, whatsapp_contact_id, message, direction, is_read, created_at, agent_id, metadata')
      .eq('integrations_id', integration.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (messagesError) {
      throw new Error(messagesError.message)
    }

    const messages = Array.isArray(recentMessages) ? recentMessages : []
    if (messages.length === 0) {
      return res.json({
        success: true,
        integration: buildWhatsAppIntegrationResponse(integration, linkedAgent, null, { includeSecrets: false }),
        conversations: []
      })
    }

    const contactIds = Array.from(
      new Set(messages.map((message: any) => String(message.whatsapp_contact_id || '').trim()).filter(Boolean))
    )
    const agentIds = Array.from(
      new Set(
        messages
          .map((message: any) => String(message.agent_id || '').trim())
          .filter(Boolean)
      )
    )

    const { data: contactsData, error: contactsError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('id, phone_number, lid, status')
      .in('id', contactIds)

    if (contactsError) {
      throw new Error(contactsError.message)
    }

    const contactsMap = new Map<string, WhatsAppContactRow>()
    for (const contact of contactsData || []) {
      contactsMap.set(String(contact.id), contact as WhatsAppContactRow)
    }

    const agentsMap = new Map<string, LinkedAgent>()
    if (agentIds.length > 0) {
      const { data: agentRows, error: agentRowsError } = await supabase
        .from('tb_agents')
        .select('id, nome, status_id, updated_at, created_at')
        .in('id', agentIds)

      if (agentRowsError) {
        throw new Error(agentRowsError.message)
      }

      for (const agentRow of agentRows || []) {
        agentsMap.set(String(agentRow.id), agentRow as LinkedAgent)
      }
    }

    const conversationsMap = new Map<string, CurrentWhatsAppConversation>()

    for (const message of messages) {
      const contactId = String(message.whatsapp_contact_id || '').trim()
      if (!contactId) {
        continue
      }

      const resolvedAgentId = String(message.agent_id || linkedAgent?.id || '').trim() || null
      const resolvedAgent = resolvedAgentId ? agentsMap.get(resolvedAgentId) || linkedAgent : linkedAgent
      const contact = contactsMap.get(contactId) || null

      if (!conversationsMap.has(contactId)) {
        conversationsMap.set(contactId, {
          whatsapp_contact_id: contactId,
          phone_number: contact?.phone_number || null,
          lid: contact?.lid || null,
          contact_label: getContactLabel(contact, contactId),
          last_message_id: String(message.id),
          last_message: String(message.message || ''),
          last_message_direction: message.direction as 'inbound' | 'outbound',
          last_message_status: getStoredWhatsAppStatus(message.direction, message.metadata, message.is_read),
          last_message_at: String(message.created_at || new Date().toISOString()),
          unread_count: 0,
          agent_id: resolvedAgentId,
          agent_name: resolvedAgent?.nome || null,
          agent_status_id: resolvedAgent?.status_id ?? null
        })
      }

      const conversation = conversationsMap.get(contactId)
      if (conversation && message.direction === 'inbound' && message.is_read === false) {
        conversation.unread_count += 1
      }
    }

    return res.json({
      success: true,
      integration: buildWhatsAppIntegrationResponse(integration, linkedAgent, null, { includeSecrets: false }),
      conversations: Array.from(conversationsMap.values())
    })
  } catch (error: any) {
    logger.error('[listCurrentWhatsAppConversations] Erro ao listar conversas da integracao atual', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao listar conversas do WhatsApp',
      details: error.message
    })
  }
}

export async function getCurrentWhatsAppConversationMessages(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const contactId = String(req.params.contactId || '').trim()
    if (!contactId) {
      return res.status(400).json({ error: 'contactId e obrigatorio' })
    }

    const requestedLimit = parseInt(String(req.query.limit || '100'), 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100

    const { platformUser, integration } = await getCurrentOwnedWhatsAppContext(req.user.email)
    if (!integration) {
      return res.status(404).json({ error: 'Integracao WhatsApp nao encontrada para o usuario autenticado' })
    }

    const linkedAgents = await loadLinkedAgentsForIntegration(integration.id, platformUser.companies_id)
    const linkedAgent = pickPreferredAgent(linkedAgents)

    const { data: contactData, error: contactError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('id, phone_number, lid, status')
      .eq('id', contactId)
      .maybeSingle()

    if (contactError) {
      throw new Error(contactError.message)
    }

    const history = await getWhatsAppHistory(contactId, integration.id, limit)

    let gov: GovernanceConfig | null = null
    try {
      if (platformUser.companies_id) {
        gov = await getGovernanceConfigForRuntime(platformUser.companies_id)
      }
    } catch {
      gov = null
    }
    const dlpConfig: GovernanceConfig = gov ?? FALLBACK_GOVERNANCE_FOR_PREPROCESS

    const normalizedMessages = history.map((message) => ({
      ...message,
      message:
        typeof message.message === 'string' && message.message
          ? applyDLP(message.message, dlpConfig)
          : message.message,
      agent_id: message.agent_id || linkedAgent?.id || null,
    }))

    return res.json({
      success: true,
      integration: buildWhatsAppIntegrationResponse(integration, linkedAgent, null, { includeSecrets: false }),
      contact: contactData || null,
      count: normalizedMessages.length,
      messages: normalizedMessages
    })
  } catch (error: any) {
    logger.error('[getCurrentWhatsAppConversationMessages] Erro ao buscar mensagens da conversa atual', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao buscar mensagens da conversa',
      details: error.message
    })
  }
}

export async function deleteWhatsAppConversationHistory(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const integrationId = String(req.params.integrationId || '').trim()
    const contactId = String(req.params.contactId || '').trim()

    if (!integrationId || !contactId) {
      return res.status(400).json({
        error: 'integrationId e contactId sao obrigatorios'
      })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)

    const { data: contactData, error: contactError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('id, phone_number, lid')
      .eq('id', contactId)
      .maybeSingle()

    if (contactError) {
      throw new Error(contactError.message)
    }

    const deleted = {
      messages: 0,
      decisions: 0,
      events: 0,
      redisKeys: 0
    }

    const { error: eventsError, count: eventsCount } = await supabase
      .from('tb_whatsapp_message_events')
      .delete({ count: 'exact' })
      .eq('integrations_id', integrationId)
      .eq('whatsapp_contact_id', contactId)

    if (eventsError && eventsError.code !== '42P01') {
      throw new Error(eventsError.message)
    }
    deleted.events = eventsCount || 0

    const { error: decisionsError, count: decisionsCount } = await supabase
      .from('tb_agent_decisions')
      .delete({ count: 'exact' })
      .eq('integrations_id', integrationId)
      .eq('contact_id', contactId)

    if (decisionsError && decisionsError.code !== '42P01') {
      throw new Error(decisionsError.message)
    }
    deleted.decisions = decisionsCount || 0

    const { error: messagesError, count: messagesCount } = await supabase
      .from('tb_whatsapp_messages')
      .delete({ count: 'exact' })
      .eq('integrations_id', integrationId)
      .eq('whatsapp_contact_id', contactId)

    if (messagesError) {
      throw new Error(messagesError.message)
    }
    deleted.messages = messagesCount || 0

    const redisReferences = Array.from(
      new Set(
        [contactData?.phone_number, contactData?.lid]
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    )

    for (const reference of redisReferences) {
      const clearResult = await clearHistory(integrationId, reference)
      if (!clearResult.success) {
        throw new Error(clearResult.error || 'Falha ao limpar cache Redis da conversa')
      }
      deleted.redisKeys += 1
    }

    return res.json({
      success: true,
      integration_id: integrationId,
      contact_id: contactId,
      deleted
    })
  } catch (error: any) {
    logger.error('[deleteWhatsAppConversationHistory] Erro ao apagar historico da conversa', {
      integrationId: req.params.integrationId,
      contactId: req.params.contactId,
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao apagar historico da conversa',
      details: error.message
    })
  }
}

export async function processPendingWhatsAppConversations(req: Request, res: Response) {
  if (!getRequestAuthEmail(req)) {
    return res.status(401).json({ error: 'Usuario nao autenticado' })
  }

  return res.json({
    success: true,
    processed: 0,
    message: 'Meta Cloud API nao utiliza processamento manual de conversas pendentes neste endpoint.'
  })
}

export async function processQueueManually(req: Request, res: Response) {
  try {
    if (!getRequestAuthEmail(req)) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { processQueue } = await import('../../services/integrations/whatsapp/whatsapp.queue.worker')
    const result = await processQueue()

    return res.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `${result.processed} mensagem(ns) processada(s)`
    })
  } catch (error: any) {
    logger.error('[processQueueManually] Erro ao processar fila', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao processar fila',
      details: error.message
    })
  }
}

export async function getQueueStatsEndpoint(req: Request, res: Response) {
  try {
    if (!getRequestAuthEmail(req)) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { getWorkerStatus } = await import('../../services/integrations/whatsapp/whatsapp.queue.worker')
    const { getQueueStats: getStats } = await import('../../services/integrations/whatsapp/whatsapp.queue')

    const stats = await getStats()
    const workerStatus = getWorkerStatus()

    return res.json({
      success: true,
      queue: stats,
      worker: workerStatus
    })
  } catch (error: any) {
    logger.error('[getQueueStatsEndpoint] Erro ao obter estatisticas da fila', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao obter estatisticas da fila',
      details: error.message
    })
  }
}

export async function getUnreadWhatsAppMessages(req: Request, res: Response) {
  try {
    const email = getRequestAuthEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }

    const { integration_id } = req.query

    if (!integration_id) {
      return res.status(400).json({
        error: 'integration_id e obrigatorio'
      })
    }

    await loadOwnedWhatsAppIntegration(email, String(integration_id))

    const unreadNumbers = await getUnreadConversations(integration_id as string)
    const unreadMessages = []

    for (const conversationId of unreadNumbers) {
      const history = await getHistoryFromRedis(integration_id as string, conversationId)

      if (history.length > 0 && history[history.length - 1].role === 'user') {
        unreadMessages.push({
          phone_number: conversationId,
          last_message: history[history.length - 1].content,
          timestamp: history[history.length - 1].timestamp
        })
      }
    }

    return res.json({
      success: true,
      count: unreadMessages.length,
      conversations: unreadMessages
    })
  } catch (error: any) {
    if (respondWhatsAppOwnershipError(res, error)) return
    logger.error('[getUnreadWhatsAppMessages] Erro ao buscar mensagens nao lidas', {
      error: error.message
    })
    return res.status(500).json({
      error: 'Erro ao buscar mensagens nao lidas',
      details: error.message
    })
  }
}

/** Fase 3 — sincroniza catálogo de templates da Meta (Graph API). */
export async function syncWhatsAppTemplatesForIntegration(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId e obrigatorio' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)
    const result = await syncTemplatesFromMetaForIntegration(integrationId)

    if (!result.success) {
      return res.status(400).json({ success: false, synced: result.synced, error: result.error })
    }

    return res.json({ success: true, synced: result.synced })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao sincronizar templates',
      details: error.message
    })
  }
}

/** Fase 3 — lista templates armazenados após sync. */
export async function listWhatsAppTemplatesForIntegration(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId e obrigatorio' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)
    const rows = await listStoredTemplates(integrationId)
    return res.json({ success: true, templates: rows })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao listar templates',
      details: error.message
    })
  }
}

/** Fase 2 — envio paralelo por template (não substitui POST legado de mensagens). */
export async function sendWhatsAppTemplateMessage(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId e obrigatorio' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)

    const to = String(req.body?.to || '').trim()
    const templateName = String(req.body?.templateName || req.body?.template_name || '').trim()
    const languageCode = String(req.body?.languageCode || req.body?.language_code || '').trim()
    const components = Array.isArray(req.body?.components) ? req.body.components : undefined
    const agentId = req.body?.agentId ? String(req.body.agentId).trim() : undefined

    if (!to || !templateName || !languageCode) {
      return res.status(400).json({
        error: 'Campos obrigatorios: to, templateName, languageCode'
      })
    }

    const result = await sendWhatsAppTemplate(integrationId, {
      to,
      templateName,
      languageCode,
      components,
      agentId,
      context: typeof req.body?.context === 'object' && req.body.context ? req.body.context : undefined
    })

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error })
    }

    return res.json({ success: true, message_id: result.messageId })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao enviar template',
      details: error.message
    })
  }
}

/** Fase 4 — estado da janela de atendimento (24h) por contato. */
export async function getWhatsAppCustomerCareWindow(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    const contactId = String(req.params.contactId || '').trim()
    if (!integrationId || !contactId) {
      return res.status(400).json({ error: 'integrationId e contactId sao obrigatorios' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)
    const state = await getCustomerCareWindowState(integrationId, contactId)
    return res.json({ success: true, ...state })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao calcular janela',
      details: error.message
    })
  }
}

/** Fase 6 — cria campanha (template Meta) para fila com dedupe/throttle. */
export async function createWhatsAppCampaign(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    if (!integrationId) {
      return res.status(400).json({ error: 'integrationId e obrigatorio' })
    }

    const row = await loadOwnedWhatsAppIntegration(req.user.email, integrationId)

    if (row.companies_id) {
      const { canUseActiveOutbound } = await import('../../utils/plan-helper')
      const outboundCheck = await canUseActiveOutbound(row.companies_id)
      if (!outboundCheck.allowed) {
        return res.status(403).json({
          error: outboundCheck.reason,
          error_code: 'PLAN_ACTIVE_OUTBOUND_REQUIRED',
          upgrade_plan: outboundCheck.upgradePlan,
        })
      }
    }

    const name = String(req.body?.name || '').trim()
    const templateName = String(req.body?.templateName || req.body?.template_name || '').trim()
    const templateLanguage = String(req.body?.languageCode || req.body?.language_code || '').trim()
    if (!name || !templateName || !templateLanguage) {
      return res.status(400).json({ error: 'Campos obrigatorios: name, templateName, languageCode' })
    }
    const components = Array.isArray(req.body?.components) ? req.body.components : undefined

    const result = await createCampaignRecord({
      integrationId,
      companiesId: row.companies_id || null,
      name,
      templateName,
      templateLanguage,
      components
    })

    if ('error' in result) {
      return res.status(400).json({ success: false, error: result.error })
    }

    return res.json({ success: true, campaign_id: result.id })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao criar campanha',
      details: error.message
    })
  }
}

/** Fase 6 — enfileira contatos (UUID em tb_whatsapp_contacts) na campanha. */
export async function enqueueWhatsAppCampaign(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    const campaignId = String(req.params.campaignId || '').trim()
    if (!integrationId || !campaignId) {
      return res.status(400).json({ error: 'integrationId e campaignId sao obrigatorios' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)

    const { data: campaign, error: cErr } = await supabase
      .from('tb_whatsapp_campaigns')
      .select('id, integrations_id, rate_limit_per_minute')
      .eq('id', campaignId)
      .maybeSingle()

    if (cErr || !campaign || String((campaign as any).integrations_id) !== integrationId) {
      return res.status(404).json({ error: 'Campanha nao encontrada nesta integracao' })
    }

    const rawIds = req.body?.contactIds || req.body?.contact_ids
    const contactIds = Array.isArray(rawIds) ? rawIds.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    if (contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds (array de UUID) e obrigatorio' })
    }

    const rate = Number((campaign as any).rate_limit_per_minute) || 30
    const { inserted, error } = await enqueueCampaignContacts({
      campaignId,
      integrationId,
      contactIds,
      rateLimitPerMinute: rate
    })

    if (error) {
      return res.status(400).json({ success: false, error })
    }

    return res.json({ success: true, inserted })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao enfileirar campanha',
      details: error.message
    })
  }
}

/** Fase 7 — agregação simples de eventos + catálogo de preços (referência). */
export async function getWhatsAppUsageReport(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: 'Usuario nao autenticado' })
    }
    const integrationId = String(req.params.integrationId || '').trim()
    const from = String(req.query.from || '').trim()
    const to = String(req.query.to || '').trim()
    if (!integrationId || !from || !to) {
      return res.status(400).json({ error: 'integrationId e query from e to (ISO) sao obrigatorios' })
    }

    await loadOwnedWhatsAppIntegration(req.user.email, integrationId)

    const { data: events, error: evErr } = await supabase
      .from('tb_whatsapp_message_events')
      .select('created_at, event_type, template_name, message_kind')
      .eq('integrations_id', integrationId)
      .gte('created_at', from)
      .lte('created_at', to)

    if (evErr) {
      if (String(evErr.message || '').includes('does not exist') || evErr.code === '42P01') {
        return res.json({ success: true, events: [], by_day: {}, pricing_schedule: [] })
      }
      throw new Error(evErr.message)
    }

    const byDay: Record<string, number> = {}
    for (const ev of events || []) {
      const day = String((ev as any).created_at || '').slice(0, 10)
      if (!day) continue
      byDay[day] = (byDay[day] || 0) + 1
    }

    const { data: pricing } = await supabase.from('tb_whatsapp_pricing_schedule').select('*').limit(500)

    return res.json({
      success: true,
      events_count: (events || []).length,
      by_day: byDay,
      pricing_schedule: pricing || []
    })
  } catch (error: any) {
    const status = error?.message?.includes('negado') ? 403 : 500
    return res.status(status).json({
      error: 'Erro ao montar relatorio',
      details: error.message
    })
  }
}
