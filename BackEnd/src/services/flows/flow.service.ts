import { randomUUID } from 'crypto'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { FlowExecutor, FlowData, FlowExecutionContext, FlowExecutionMode, NodeExecutionResult } from './index'
import { repairFlowDataForExecution } from './flow-data-repair'
import { applyPatientHintsFromUserMessage } from './flow-patient-intake'

function readFlowNodes(raw: unknown): any[] {
  if (!raw || typeof raw !== 'object') return []
  const flow = raw as { nodes?: unknown }
  return Array.isArray(flow.nodes) ? flow.nodes : []
}

function readFlowMeta(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== 'object') return {}
  const meta = (raw as { meta?: unknown }).meta
  return meta && typeof meta === 'object' ? (meta as Record<string, any>) : {}
}

function extractSubflowRefs(raw: unknown): Array<{ flowId: string; flowName: string; nodeId: string; nodeLabel: string }> {
  return readFlowNodes(raw)
    .filter((node) => node && typeof node === 'object' && (node as { type?: string }).type === 'subflow')
    .map((node: any) => {
      const data = node.data || {}
      return {
        flowId: String(data.subflowId || data.flowId || '').trim(),
        flowName: String(data.subflowName || data.flowName || '').trim(),
        nodeId: String(node.id || '').trim(),
        nodeLabel: String(data.label || 'Subfluxo').trim(),
      }
    })
    .filter((ref) => ref.flowId)
}

export class FlowService {
  static async getFlow(flowId: string, userEmail: string): Promise<FlowData | null> {
    try {
      const { getCompanyIdByEmail } = await import('../../utils/company-helper')
      const companiesId = await getCompanyIdByEmail(userEmail)

      let query = supabase
        .from('tb_flows')
        .select('nodes')
        .eq('id', flowId)

      if (companiesId) {
        query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
      } else {
        query = query.is('companies_id', null)
      }

      const { data, error } = await query.single()
      if (error) {
        logger.error(`[FlowService] Erro ao buscar flow ${flowId}:`, error)
        return null
      }

      let flowData = data?.nodes as FlowData | null
      if (flowData) {
        flowData = await repairFlowDataForExecution(flowData, companiesId)
        logger.log('[FlowService] Flow carregado:', {
          startNodeId: flowData.startNodeId,
          nodesCount: flowData.nodes?.length || 0,
          edgesCount: flowData.edges?.length || 0
        })
      }

      return flowData
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao buscar flow: ${error.message}`, error)
      return null
    }
  }

  static async executeFlow(
    flowId: string,
    userEmail: string,
    initialData: Record<string, any> = {},
    options: {
      executionMode?: FlowExecutionMode
      executionId?: string
      executionHistory?: NodeExecutionResult[]
      resumeFromNodeId?: string
    } = {}
  ): Promise<FlowExecutionContext> {
    try {
      logger.info(`[FlowService] Iniciando execucao do flow ${flowId} para ${userEmail}`)

      const flowData = await this.getFlow(flowId, userEmail)
      if (!flowData) {
        throw new Error(`Flow ${flowId} nao encontrado ou nao pertence ao usuario`)
      }

      let userId = ''
      let companiesId = ''
      try {
        logger.log(`[FlowService] Buscando user_id e companies_id para email: ${userEmail}`)
        const userCompanyData = await getUserIdAndCompanyIdByEmail(userEmail)
        if (userCompanyData.userId) {
          userId = userCompanyData.userId
        }
        if (userCompanyData.companyId) {
          companiesId = userCompanyData.companyId
        }
      } catch (error: any) {
        logger.error(`[FlowService] Erro ao buscar user_id/companies_id: ${error.message}`, error)
      }

      const executionMode = options.executionMode || 'live'
      const contextData: Record<string, any> = {
        ...initialData,
        __flow_execution_mode: executionMode,
        ...(companiesId ? { companies_id: companiesId } : {}),
      }

      applyPatientHintsFromUserMessage(contextData)

      if (initialData.message && !initialData.originalMessage && !initialData.userMessage) {
        if (!String(initialData.message).includes('Execute sua tarefa como agente')) {
          contextData.originalMessage = initialData.message
          contextData.userMessage = initialData.message
        }
      } else if (initialData.originalMessage && !initialData.userMessage) {
        contextData.userMessage = initialData.originalMessage
      } else if (initialData.userMessage && !initialData.originalMessage) {
        contextData.originalMessage = initialData.userMessage
      }

      const executionId = options.executionId || randomUUID()
      const resumeFromNodeId = String(options.resumeFromNodeId || '').trim()
      if (resumeFromNodeId) {
        contextData.__resume_from_node_id = resumeFromNodeId
      }

      const context: FlowExecutionContext = {
        flowId,
        userId,
        companiesId,
        userEmail,
        executionId,
        data: contextData,
        executionHistory: Array.isArray(options.executionHistory) ? [...options.executionHistory] : []
      }

      logger.log('[FlowService] Contexto criado:', {
        flowId,
        userId,
        companiesId,
        userEmail,
        executionId,
        executionMode,
        resumeFromNodeId: resumeFromNodeId || null,
        hasCompaniesId: !!companiesId
      })

      const executor = new FlowExecutor(flowData, context)
      const result = await executor.execute()

      logger.info(`[FlowService] Flow ${flowId} executado com sucesso`)
      return result
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao executar flow: ${error.message}`, error)
      throw error
    }
  }

  static async listFlows(userEmail: string): Promise<any[]> {
    try {
      const { getCompanyIdByEmail } = await import('../../utils/company-helper')
      const companiesId = await getCompanyIdByEmail(userEmail)

      let query = supabase
        .from('tb_flows')
        .select('id, name, created_at, companies_id, nodes')
        .order('created_at', { ascending: false })

      if (companiesId) {
        query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
      } else {
        query = query.is('companies_id', null)
      }

      const { data, error } = await query
      if (error) {
        logger.error('[FlowService] Erro ao listar flows:', error)
        return []
      }

      const rows = data || []
      const existingIds = new Set(rows.map((row: any) => String(row.id)))
      const referencedBy = new Map<string, { parentFlowId: string; parentFlowName: string; nodeId: string; nodeLabel: string }>()

      for (const row of rows as any[]) {
        for (const ref of extractSubflowRefs(row.nodes)) {
          if (!referencedBy.has(ref.flowId)) {
            referencedBy.set(ref.flowId, {
              parentFlowId: String(row.id),
              parentFlowName: String(row.name || ''),
              nodeId: ref.nodeId,
              nodeLabel: ref.nodeLabel,
            })
          }
        }
      }

      const enriched = (rows as any[]).map((row) => {
        const meta = readFlowMeta(row.nodes)
        const inferredParent = referencedBy.get(String(row.id))
        const subflowRefs = extractSubflowRefs(row.nodes).map((ref) => ({
          ...ref,
          connected: existingIds.has(ref.flowId),
        }))
        const explicitKind = String(meta.kind || '').trim()
        const flowKind = explicitKind === 'subflow' || inferredParent ? 'subflow' : 'main'
        return {
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          companies_id: row.companies_id,
          flowKind,
          parentFlowId: meta.parentFlowId || inferredParent?.parentFlowId || null,
          parentFlowName: meta.parentFlowName || inferredParent?.parentFlowName || null,
          subflowKey: meta.subflowKey || null,
          subflowOrder: typeof meta.subflowOrder === 'number' ? meta.subflowOrder : null,
          referencedByNodeId: inferredParent?.nodeId || null,
          referencedByNodeLabel: inferredParent?.nodeLabel || null,
          subflowRefs,
        }
      })

      logger.log(`[FlowService] ${enriched.length} flows encontrados (empresa: ${companiesId || 'sem empresa'})`)
      return enriched
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao listar flows: ${error.message}`, error)
      return []
    }
  }
}
