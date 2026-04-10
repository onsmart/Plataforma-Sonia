import type { FlowData, FlowNode } from './flow.types'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/** Aceita snake_case vindo de serializações antigas ou APIs. */
function normalizeAgentDataKeys(data: FlowNode['data'] | Record<string, unknown>): FlowNode['data'] {
  if (!data || typeof data !== 'object') return data as FlowNode['data']
  const d = { ...(data as Record<string, unknown>) }
  if (d.template_id != null && d.templateId == null) d.templateId = d.template_id
  if (d.agent_id != null && d.agentId == null) d.agentId = d.agent_id
  if (d.template_name != null && d.templateName == null) d.templateName = d.template_name
  if (d.agent_name != null && d.agentName == null) d.agentName = d.agent_name
  if (d.execution_mode != null && d.executionMode == null) d.executionMode = d.execution_mode
  if (d.additional_instructions != null && d.additionalInstructions == null) {
    d.additionalInstructions = d.additional_instructions
  }
  if (d.skip_reply_confidence != null && d.skipReplyConfidence == null) {
    d.skipReplyConfidence = Boolean(d.skip_reply_confidence)
  }
  return d as FlowNode['data']
}

function trimId(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

/**
 * Nós agente sem agentId e sem templateId (ex.: ramos apagados pelo normalize antigo do front)
 * recebem o template compartilhado usado no restante do fluxo.
 */
function applySharedTemplateToOrphanAgentNodes(flow: FlowData, templateId: string): number {
  let fixed = 0
  for (const n of flow.nodes) {
    if (n.type !== 'agent') continue
    const aid = trimId(n.data?.agentId)
    const tid = trimId(n.data?.templateId)
    if (aid) continue
    if (tid) continue
    n.data = {
      ...n.data,
      templateId,
      templateName: n.data.templateName || '',
      executionMode: 'template',
      agentId: '',
      agentName: '',
    }
    fixed++
  }
  return fixed
}

const BRAIN_NAME_HINT =
  /\[FLUXO IA\].*(?:modelo compartilhado|modelo único|modelo unico)|Assistente virtual \(modelo compartilhado\)|Assistente \(modelo único\)|Assistente \(modelo unico\)/i

async function inferSharedBrainTemplateId(companiesId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tb_agents_templates')
    .select('id, name, created_at')
    .eq('companies_id', companiesId)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error || !data?.length) {
    if (error) logger.warn('[flow-data-repair] Falha ao listar templates para inferência:', error.message)
    return null
  }

  const rows = data as { id: string; name: string | null }[]
  const hits = rows.filter((r) => BRAIN_NAME_HINT.test(String(r.name || '')))
  if (hits.length >= 1) return hits[0].id

  const broad = rows.filter((r) => {
    const n = String(r.name || '')
    return /\[FLUXO IA\]/i.test(n) && !/classificador/i.test(n)
  })
  if (broad.length >= 1) return broad[0].id

  return null
}

/**
 * Prepara JSON do fluxo antes da execução: camelCase, reparo de ramos sem template.
 */
export async function repairFlowDataForExecution(
  flow: FlowData,
  companiesId: string | null
): Promise<FlowData> {
  const out: FlowData = {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.type === 'agent' ? { ...n, data: normalizeAgentDataKeys(n.data) } : { ...n }
    ),
  }

  const agentNodes = out.nodes.filter((n) => n.type === 'agent')
  const templateIds = new Set<string>()
  for (const n of agentNodes) {
    const tid = trimId(n.data?.templateId)
    if (tid) templateIds.add(tid)
  }

  if (templateIds.size === 1) {
    const only = [...templateIds][0]
    const n = applySharedTemplateToOrphanAgentNodes(out, only)
    if (n > 0) {
      logger.warn(
        `[flow-data-repair] ${n} nó(s) agente sem agentId/templateId preenchidos com o único templateId do fluxo (${only.slice(0, 8)}…)`
      )
    }
    return out
  }

  if (templateIds.size === 0 && companiesId) {
    const inferred = await inferSharedBrainTemplateId(companiesId)
    if (inferred) {
      const n = applySharedTemplateToOrphanAgentNodes(out, inferred)
      if (n > 0) {
        logger.warn(
          `[flow-data-repair] ${n} nó(s) reparados com template compartilhado inferido da empresa (${inferred.slice(0, 8)}…). Salve o fluxo no editor para persistir.`
        )
      }
    }
  }

  return out
}
