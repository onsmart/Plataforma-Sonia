import { supabase } from '../../lib/supabase'
import { getAgentSetupHealth, type SetupHealthCheck } from './agent-setup-health.service'
import { runAgentConversationTurn } from './agent-turn.service'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'
import {
  buildToolKey,
  type AgentToolSelectionInput,
} from './agent-extra-features'
export type AgentAiArchetype = 'faq' | 'receptive' | 'sdr'

export type AgentGenerateAiIntegrations = {
  whatsappIntegrationId?: string | null
  calendlyIntegrationId?: string | null
  crmIntegrationId?: string | null
}

export type SmokeCheckStatus = 'ok' | 'warn' | 'fail'

export type SmokeCheck = {
  id: string
  label: string
  status: SmokeCheckStatus
  message: string
}

export type ChatTurnSmokeResult = {
  userMessage: string
  replyPreview: string
  parsedAction?: string | null
  status: SmokeCheckStatus
  message: string
}

export type AgentGenerateValidationReport = {
  ok: boolean
  checks: SmokeCheck[]
  chatTurn?: ChatTurnSmokeResult
}

function pushCheck(checks: SmokeCheck[], id: string, label: string, status: SmokeCheckStatus, message: string) {
  checks.push({ id, label, status, message })
}

function syntheticChatMessage(archetype: AgentAiArchetype): string {
  if (archetype === 'receptive') return 'Quero marcar uma reunião amanhã de tarde'
  return 'Qual o horário de atendimento?'
}

function tryParseAgentJsonAction(reply: string): string | null {
  const trimmed = reply.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed) as { action?: string }
    return typeof parsed.action === 'string' ? parsed.action : null
  } catch {
    return null
  }
}

async function validateWhatsAppIntegration(integrationId: string, companiesId: string): Promise<SmokeCheckStatus> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('id, provider, access_token, app_key, companies_id')
    .eq('id', integrationId)
    .eq('provider', 'whatsapp')
    .maybeSingle()

  if (error || !data) return 'fail'
  if (String(data.companies_id || '') !== companiesId) return 'fail'
  if (!String(data.access_token || '').trim() || !String(data.app_key || '').trim()) return 'warn'
  return 'ok'
}

export async function runAgentGenerateSmokeTest(params: {
  agentId: string
  userEmail: string
  archetype: AgentAiArchetype
  selectedTools: AgentToolSelectionInput[]
  integrations?: AgentGenerateAiIntegrations
}): Promise<AgentGenerateValidationReport> {
  const checks: SmokeCheck[] = []
  const enabled = (params.selectedTools || []).filter((t) => t.enabled !== false)

  const health = await getAgentSetupHealth(params.agentId, params.userEmail)
  for (const hc of health.checks) {
    const status: SmokeCheckStatus =
      hc.status === 'ok' ? 'ok' : hc.status === 'warn' ? 'warn' : 'fail'
    pushCheck(checks, `health_${hc.id}`, hc.label, status, hc.message)
  }

  for (const tool of enabled) {
    const provider = tool.provider
    const toolName = tool.toolName
    const toolKey = tool.toolKey || buildToolKey(provider, toolName)
    const integrationId = String(tool.integrationId || '').trim()
    const crmIntegrationId = String(tool.crmIntegrationId || '').trim()

    try {
      if (provider === 'calendly' && toolName === 'list_event_types') {
        if (!integrationId) {
          pushCheck(checks, `tool_${toolKey}`, 'Calendly list_event_types', 'fail', 'integrationId ausente')
          continue
        }
        const result = await executeIntegrationTool({
          provider: 'calendly',
          toolName: 'list_event_types',
          payload: { integrationId },
        })
        pushCheck(
          checks,
          `tool_${toolKey}`,
          'Calendly — tipos de evento',
          result.success ? 'ok' : 'fail',
          result.userSafeMessage || (result.success ? 'OK' : 'Falha ao listar eventos')
        )
        continue
      }

      if (provider === 'hubspot' && toolName === 'lookup_contact') {
        if (!crmIntegrationId) {
          pushCheck(checks, `tool_${toolKey}`, 'HubSpot lookup', 'fail', 'crmIntegrationId ausente')
          continue
        }
        const result = await executeIntegrationTool({
          provider: 'hubspot',
          toolName: 'lookup_contact',
          payload: {
            crmIntegrationId,
            email: 'smoke-test-sonia@example.invalid',
          },
        })
        pushCheck(
          checks,
          `tool_${toolKey}`,
          'HubSpot — buscar contato',
          result.success ? 'ok' : 'warn',
          result.userSafeMessage || 'Consulta de teste executada'
        )
        continue
      }

      if (provider === 'whatsapp') {
        const waId =
          integrationId || String(params.integrations?.whatsappIntegrationId || '').trim()
        if (!waId) {
          pushCheck(checks, `tool_${toolKey}`, 'WhatsApp', 'fail', 'Integração WhatsApp não vinculada')
          continue
        }
        const { data: agent } = await supabase
          .from('tb_agents')
          .select('companies_id')
          .eq('id', params.agentId)
          .maybeSingle()
        const companiesId = String(agent?.companies_id || '').trim()
        const waStatus = await validateWhatsAppIntegration(waId, companiesId)
        pushCheck(
          checks,
          `tool_${toolKey}`,
          'WhatsApp — credenciais',
          waStatus,
          waStatus === 'ok'
            ? 'Integração WhatsApp configurada no agente.'
            : waStatus === 'warn'
              ? 'Integração encontrada; credenciais podem estar incompletas.'
              : 'Integração WhatsApp inválida ou inacessível.'
        )
        continue
      }

      if (provider === 'email' && toolName === 'send_email') {
        if (!integrationId) {
          pushCheck(checks, `tool_${toolKey}`, 'E-mail', 'warn', 'integrationId ausente — configure no agente')
        } else {
          pushCheck(checks, `tool_${toolKey}`, 'E-mail', 'ok', 'Ferramenta de e-mail habilitada (envio não testado na v1).')
        }
        continue
      }

      pushCheck(
        checks,
        `tool_${toolKey}`,
        `${provider}.${toolName}`,
        'ok',
        'Ferramenta habilitada (ping específico não aplicável).'
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      pushCheck(checks, `tool_${toolKey}`, `${provider}.${toolName}`, 'fail', msg.slice(0, 240))
    }
  }

  let chatTurn: ChatTurnSmokeResult | undefined
  const userMessage = syntheticChatMessage(params.archetype)

  try {
    const contactId = `smoke-${params.agentId.slice(0, 8)}`
    const turn = await runAgentConversationTurn({
      userEmail: params.userEmail,
      agentId: params.agentId,
      contactId,
      message: userMessage,
      channel: 'webchat',
      context: { is_first_turn: true, is_smoke_test: true },
    })

    const replyPreview = String(turn.reply || '').trim().slice(0, 400)
    const parsedAction = tryParseAgentJsonAction(replyPreview)

    let chatStatus: SmokeCheckStatus = 'ok'
    let chatMessage = 'Agente respondeu ao turno de teste.'

    if (!replyPreview) {
      chatStatus = 'fail'
      chatMessage = 'Resposta vazia no turno de teste.'
    } else if (params.archetype === 'receptive' && enabled.some((t) => t.provider === 'calendly')) {
      if (parsedAction === 'integration_tool') {
        chatMessage = 'Resposta JSON com action integration_tool (esperado para receptivo+Calendly).'
      } else if (parsedAction === 'reply') {
        chatStatus = 'warn'
        chatMessage =
          'Resposta JSON com action reply — aceitável na v1 (ex.: pedir nome/e-mail antes de agendar).'
      } else if (!parsedAction) {
        chatStatus = 'warn'
        chatMessage = 'Resposta em texto livre (sem JSON action) — aceitável na v1.'
      }
    }

    chatTurn = {
      userMessage,
      replyPreview,
      parsedAction,
      status: chatStatus,
      message: chatMessage,
    }

    pushCheck(checks, 'chat_turn', 'Turno de chat simulado', chatStatus, chatMessage)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    chatTurn = {
      userMessage,
      replyPreview: '',
      parsedAction: null,
      status: 'fail',
      message: msg.slice(0, 240),
    }
    pushCheck(checks, 'chat_turn', 'Turno de chat simulado', 'fail', msg.slice(0, 240))
  }

  const hasFail = checks.some((c) => c.status === 'fail')
  const ok = !hasFail

  return {
    ok,
    checks,
    chatTurn,
  }
}
