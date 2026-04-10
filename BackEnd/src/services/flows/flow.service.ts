import { supabase } from '../../lib/supabase'
import { FlowExecutor, FlowData, FlowExecutionContext } from './index'
import logger from '../../lib/logger'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { randomUUID } from 'crypto'
import { repairFlowDataForExecution } from './flow-data-repair'

/**
 * Serviço para gerenciar e executar flows
 */
export class FlowService {
  /**
   * Busca um flow do banco de dados (da empresa + globais)
   */
  static async getFlow(flowId: string, userEmail: string): Promise<FlowData | null> {
    try {
      // 1. Buscar companies_id a partir do user_email (pode ser null)
      const { getCompanyIdByEmail } = await import('../../utils/company-helper')
      const companiesId = await getCompanyIdByEmail(userEmail)

      // 2. Buscar flow por id (da empresa OU global)
      let query = supabase
        .from('tb_flows')
        .select('nodes')
        .eq('id', flowId)

      if (companiesId) {
        // Se tem empresa, busca flow da empresa OU global
        query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
      } else {
        // Se não tem empresa, busca apenas global
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
        logger.log(`[FlowService] Flow carregado:`, {
          startNodeId: flowData.startNodeId,
          nodesCount: flowData.nodes?.length || 0,
          edgesCount: flowData.edges?.length || 0,
        })
      }

      return flowData
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao buscar flow: ${error.message}`, error)
      return null
    }
  }

  /**
   * Executa um flow
   * @param flowId ID do flow no banco
   * @param userEmail Email do usuário
   * @param initialData Dados iniciais para o primeiro node (ex: { nome: "João", email: "joao@example.com" })
   */
  static async executeFlow(
    flowId: string,
    userEmail: string,
    initialData: Record<string, any> = {}
  ): Promise<FlowExecutionContext> {
    try {
      logger.info(`[FlowService] Iniciando execução do flow ${flowId} para ${userEmail}`)

      // Busca o flow do banco
      const flowData = await this.getFlow(flowId, userEmail)
      if (!flowData) {
        throw new Error(`Flow ${flowId} não encontrado ou não pertence ao usuário`)
      }

      // 🎯 Buscar user_id e companies_id da tabela tb_users pelo email (necessário para salvar fallbacks)
      let userId = ''
      let companiesId = ''
      try {
        logger.log(`[FlowService] Buscando user_id e companies_id para email: ${userEmail}`)
        const userCompanyData = await getUserIdAndCompanyIdByEmail(userEmail)
        
        if (userCompanyData.userId) {
          userId = userCompanyData.userId
          logger.log(`[FlowService] ✅ user_id encontrado para ${userEmail}: ${userId}`)
        } else {
          logger.warn(`[FlowService] ⚠️ user_id não encontrado para ${userEmail}. Verifique se o email está correto na tabela tb_users.`)
        }
        
        if (userCompanyData.companyId) {
          companiesId = userCompanyData.companyId
          logger.log(`[FlowService] ✅ companies_id encontrado para ${userEmail}: ${companiesId}`)
        } else {
          logger.warn(`[FlowService] ⚠️ companies_id não encontrado para ${userEmail}. Fallbacks podem não ser salvos corretamente.`)
        }
      } catch (err: any) {
        logger.error(`[FlowService] Erro ao buscar user_id/companies_id: ${err.message}`, err)
      }

      // Cria o contexto de execução
      // 🎯 IMPORTANTE: Preserva a mensagem original do usuário no contexto
      // A mensagem original pode estar em initialData.message, initialData.originalMessage, ou initialData.userMessage
      const contextData = { ...initialData }
      
      // Se houver uma mensagem original, garante que esteja em originalMessage e userMessage
      if (initialData.message && !initialData.originalMessage && !initialData.userMessage) {
        // Se message não parece ser uma instrução do flow, assume que é a mensagem original
        if (!initialData.message.includes('Execute sua tarefa como agente')) {
          contextData.originalMessage = initialData.message
          contextData.userMessage = initialData.message
        }
      } else if (initialData.originalMessage && !initialData.userMessage) {
        contextData.userMessage = initialData.originalMessage
      } else if (initialData.userMessage && !initialData.originalMessage) {
        contextData.originalMessage = initialData.userMessage
      }
      
      // ✅ Gerar executionId único para rastreamento
      const executionId = randomUUID()
      
      const context: FlowExecutionContext = {
        flowId,
        userId, // ✅ Agora preenchido com o user_id da tabela tb_users
        companiesId, // ✅ Adicionado para multi-tenant
        userEmail,
        executionId, // ✅ ID único da execução
        data: contextData, // Dados iniciais (ex: nome, email do usuário) + mensagem original preservada
        executionHistory: []
      }
      
      logger.log(`[FlowService] Contexto criado:`, {
        flowId,
        userId,
        companiesId,
        userEmail,
        executionId,
        hasCompaniesId: !!companiesId
      })
      
      logger.log(`[FlowService] Contexto criado com mensagem original:`, {
        hasOriginalMessage: !!(contextData.originalMessage || contextData.userMessage),
        originalMessage: (contextData.originalMessage || contextData.userMessage || 'não encontrada')?.substring(0, 100),
        contextKeys: Object.keys(contextData)
      })

      // Cria e executa o executor
      const executor = new FlowExecutor(flowData, context)
      const result = await executor.execute()

      logger.info(`[FlowService] Flow ${flowId} executado com sucesso`)
      return result
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao executar flow: ${error.message}`, error)
      throw error
    }
  }

  /**
   * Lista flows do usuário (filtrado por companies_id + globais)
   */
  static async listFlows(userEmail: string): Promise<any[]> {
    try {
      // 1. Buscar companies_id a partir do user_email (pode ser null)
      const { getCompanyIdByEmail } = await import('../../utils/company-helper')
      const companiesId = await getCompanyIdByEmail(userEmail)

      // 2. Buscar flows: da empresa (se tiver) + globais (companies_id IS NULL)
      let query = supabase
        .from('tb_flows')
        .select('id, name, created_at, companies_id')
        .order('created_at', { ascending: false })

      if (companiesId) {
        // Se tem empresa, busca flows da empresa OU globais
        query = query.or(`companies_id.eq.${companiesId},companies_id.is.null`)
      } else {
        // Se não tem empresa, busca apenas globais
        query = query.is('companies_id', null)
      }

      const { data, error } = await query

      if (error) {
        logger.error(`[FlowService] Erro ao listar flows:`, error)
        return []
      }

      logger.log(`[FlowService] ✅ ${data?.length || 0} flows encontrados (empresa: ${companiesId || 'sem empresa'})`)
      return data || []
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao listar flows: ${error.message}`, error)
      return []
    }
  }
}
