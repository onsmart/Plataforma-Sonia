import { randomUUID } from 'crypto'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { FlowExecutor, FlowData, FlowExecutionContext, FlowExecutionMode, NodeExecutionResult } from './index'
import { repairFlowDataForExecution } from './flow-data-repair'

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
        __flow_execution_mode: executionMode
      }

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
        .select('id, name, created_at, companies_id')
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

      logger.log(`[FlowService] ${data?.length || 0} flows encontrados (empresa: ${companiesId || 'sem empresa'})`)
      return data || []
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao listar flows: ${error.message}`, error)
      return []
    }
  }
}
