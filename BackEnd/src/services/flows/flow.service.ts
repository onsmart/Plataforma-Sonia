import { supabase } from '../../lib/supabase'
import { FlowExecutor, FlowData, FlowExecutionContext } from './index'
import logger from '../../lib/logger'

/**
 * Serviço para gerenciar e executar flows
 */
export class FlowService {
  /**
   * Busca um flow do banco de dados
   */
  static async getFlow(flowId: string, userEmail: string): Promise<FlowData | null> {
    try {
      const { data, error } = await supabase
        .from('tb_flows')
        .select('nodes')
        .eq('id', flowId)
        .eq('user_email', userEmail)
        .single()

      if (error) {
        logger.error(`[FlowService] Erro ao buscar flow ${flowId}:`, error)
        return null
      }

      // Extrai os dados do JSON
      const flowData = data?.nodes as FlowData | null
      
      if (flowData) {
        logger.log(`[FlowService] Flow carregado:`, {
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

      // Cria o contexto de execução
      const context: FlowExecutionContext = {
        flowId,
        userId: '', // Pode ser preenchido se necessário
        userEmail,
        data: initialData, // Dados iniciais (ex: nome, email do usuário)
        executionHistory: []
      }

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
   * Lista flows do usuário
   */
  static async listFlows(userEmail: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tb_flows')
        .select('id, name, created_at')
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error(`[FlowService] Erro ao listar flows:`, error)
        return []
      }

      return data || []
    } catch (error: any) {
      logger.error(`[FlowService] Erro ao listar flows: ${error.message}`, error)
      return []
    }
  }
}
