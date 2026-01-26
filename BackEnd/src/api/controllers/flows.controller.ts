import { Request, Response } from 'express'
import { FlowService } from '../../services/flows'

/**
 * Lista flows do usuário
 */
export async function listFlows(req: Request, res: Response) {
  try {
    const email = req.query.email as string

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    const flows = await FlowService.listFlows(email)
    return res.json(flows)
  } catch (error: any) {
    console.error('[FlowsController] Erro ao listar flows:', error)
    return res.status(500).json({
      error: 'Erro ao buscar flows',
      details: error.message
    })
  }
}

/**
 * Executa um flow
 * O Flow é a orquestração central - decide a ordem de execução
 */
export async function executeFlow(req: Request, res: Response) {
  try {
    const { flow_id, email, initial_data } = req.body

    if (!flow_id || !email) {
      return res.status(400).json({ 
        error: 'flow_id e email são obrigatórios' 
      })
    }

    // Dados iniciais para o primeiro node (ex: { nome: "João", email: "joao@example.com" })
    const initialData = initial_data || {}

    // Executa o flow (orquestração central)
    const result = await FlowService.executeFlow(
      flow_id,
      email,
      initialData
    )

    return res.json({
      success: true,
      flowId: result.flowId,
      executionHistory: result.executionHistory,
      finalData: result.data,
      nodesExecuted: result.executionHistory.length
    })
  } catch (error: any) {
    console.error('[FlowsController] Erro ao executar flow:', error)
    return res.status(500).json({
      error: 'Erro ao executar flow',
      details: error.message
    })
  }
}

/**
 * Busca um flow específico
 */
export async function getFlow(req: Request, res: Response) {
  try {
    const flowId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]
    const email = req.query.email as string

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    const flow = await FlowService.getFlow(flowId, email)
    
    if (!flow) {
      return res.status(404).json({ error: 'Flow não encontrado' })
    }

    return res.json(flow)
  } catch (error: any) {
    console.error('[FlowsController] Erro ao buscar flow:', error)
    return res.status(500).json({
      error: 'Erro ao buscar flow',
      details: error.message
    })
  }
}
