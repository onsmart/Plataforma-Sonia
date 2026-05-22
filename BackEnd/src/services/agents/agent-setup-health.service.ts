import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { listCalendlyIntegrationConfigsForUser } from '../integrations/calendly'
import {
  parseAgentExtraFeatures,
  resolveSchedulingConfig,
} from './agent-extra-features'

export type SetupHealthStatus = 'ok' | 'warn' | 'fail'

export type SetupHealthCheck = {
  id: string
  label: string
  status: SetupHealthStatus
  message: string
}

export type AgentSetupHealthResult = {
  ok: boolean
  agentId: string
  demo?: string
  checks: SetupHealthCheck[]
}

function push(
  checks: SetupHealthCheck[],
  id: string,
  label: string,
  status: SetupHealthStatus,
  message: string
) {
  checks.push({ id, label, status, message })
}

function specialtyMapped(mappings: unknown, specialty: string): boolean {
  if (!mappings || !specialty) return false
  const key = specialty.trim().toLowerCase()
  if (Array.isArray(mappings)) {
    return mappings.some(
      (m) =>
        m &&
        typeof m === 'object' &&
        String((m as { specialty?: string }).specialty || '')
          .trim()
          .toLowerCase() === key
    )
  }
  if (typeof mappings === 'object') {
    return Object.keys(mappings as Record<string, unknown>).some(
      (k) => k.trim().toLowerCase() === key
    )
  }
  return false
}

export async function getAgentSetupHealth(
  agentId: string,
  userEmail: string
): Promise<AgentSetupHealthResult> {
  const checks: SetupHealthCheck[] = []
  const companiesId = await getCompanyIdByEmail(userEmail)

  if (!companiesId) {
    push(checks, 'company', 'Empresa do usuário', 'fail', 'Empresa não encontrada.')
    return { ok: false, agentId, checks }
  }

  const { data: agent, error } = await supabase
    .from('tb_agents')
    .select(
      'id, nome, status_id, extra_features, integrations_id, companies_id, automation_mode'
    )
    .eq('id', agentId)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error || !agent) {
    push(checks, 'agent', 'Agente', 'fail', 'Agente não encontrado nesta empresa.')
    return { ok: false, agentId, checks }
  }

  push(
    checks,
    'agent_active',
    'Agente ativo',
    Number(agent.status_id) === 1 ? 'ok' : 'warn',
    Number(agent.status_id) === 1 ? 'Agente ativo.' : 'Agente inativo (status_id ≠ 1).'
  )

  const extra = parseAgentExtraFeatures(agent.extra_features)
  if (!extra) {
    push(checks, 'extra_features', 'Configuração do agente', 'warn', 'extra_features vazio ou inválido.')
  } else {
    push(checks, 'extra_features', 'Configuração do agente', 'ok', 'extra_features legível.')
  }

  const scheduling = resolveSchedulingConfig(extra)
  if (!scheduling) {
    push(
      checks,
      'scheduling',
      'Agendamento Calendly',
      'fail',
      'Habilite Consultar disponibilidade + Confirmar agendamento com integração e specialty.'
    )
  } else {
    push(
      checks,
      'scheduling',
      'Agendamento Calendly',
      'ok',
      `Coordenador ativo (integração ${scheduling.calendly_integration_id.slice(0, 8)}…, specialty ${scheduling.specialty}).`
    )

    try {
      const configs = await listCalendlyIntegrationConfigsForUser(userEmail)
      const match = configs.find((c) => String(c.integrationId) === scheduling.calendly_integration_id)
      if (!match) {
        push(
          checks,
          'calendly_integration',
          'Integração Calendly',
          'fail',
          'ID da integração não encontrado para este usuário.'
        )
      } else if (match.isActive === false || (match as { is_active?: boolean }).is_active === false) {
        push(
          checks,
          'calendly_integration',
          'Integração Calendly',
          'warn',
          'Integração existe mas está desativada.'
        )
      } else {
        push(checks, 'calendly_integration', 'Integração Calendly', 'ok', 'Integração ativa.')

        if (specialtyMapped(match.eventTypeMappings, scheduling.specialty)) {
          push(
            checks,
            'calendly_specialty',
            'Mapeamento specialty',
            'ok',
            `Specialty "${scheduling.specialty}" mapeada no Calendly.`
          )
        } else {
          push(
            checks,
            'calendly_specialty',
            'Mapeamento specialty',
            'fail',
            `Configure o mapeamento da specialty "${scheduling.specialty}" em Integrações → Calendly.`
          )
        }
      }
    } catch (err: any) {
      push(
        checks,
        'calendly_integration',
        'Integração Calendly',
        'warn',
        err?.message || 'Não foi possível validar Calendly.'
      )
    }
  }

  const { count: ragCount, error: ragError } = await supabase
    .from('tb_agent_files')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('companies_id', companiesId)

  if (ragError) {
    push(checks, 'rag', 'Base de conhecimento (RAG)', 'warn', ragError.message)
  } else if ((ragCount || 0) === 0) {
    push(
      checks,
      'rag',
      'Base de conhecimento (RAG)',
      'warn',
      'Nenhum arquivo vinculado ao agente. Envie o FAQ na Knowledge Base e associe aqui.'
    )
  } else {
    push(
      checks,
      'rag',
      'Base de conhecimento (RAG)',
      'ok',
      `${ragCount} arquivo(s) vinculado(s).`
    )
  }

  if (agent.integrations_id) {
    const { data: wa } = await supabase
      .from('tb_integrations')
      .select('id, provider, automation_mode, linked_flow_id')
      .eq('id', agent.integrations_id)
      .eq('companies_id', companiesId)
      .maybeSingle()

    if (!wa) {
      push(checks, 'whatsapp', 'WhatsApp', 'warn', 'integrations_id definido mas integração não encontrada.')
    } else if (String(wa.provider) !== 'whatsapp') {
      push(checks, 'whatsapp', 'WhatsApp', 'warn', 'Integração vinculada não é WhatsApp.')
    } else {
      const mode = String((wa as any).automation_mode || '').trim()
      const linkedFlow = (wa as any).linked_flow_id
      if (mode === 'agent' && !linkedFlow) {
        push(checks, 'whatsapp', 'WhatsApp', 'ok', 'Modo agente, sem fluxo vinculado.')
      } else {
        push(
          checks,
          'whatsapp',
          'WhatsApp',
          'warn',
          `Modo: ${mode || 'desconhecido'}${linkedFlow ? ', fluxo vinculado' : ''}. Ideal: automation_mode=agent.`
        )
      }
    }
  } else {
    push(
      checks,
      'whatsapp',
      'WhatsApp',
      'warn',
      'Nenhum WhatsApp vinculado ao agente (opcional para Playground).'
    )
  }

  const ok = checks.every((c) => c.status !== 'fail')
  return {
    ok,
    agentId,
    demo: extra?.demo,
    checks,
  }
}
