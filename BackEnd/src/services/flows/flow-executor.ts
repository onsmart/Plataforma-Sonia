import { FlowData, FlowNode, FlowEdge, FlowExecutionContext, NodeExecutionResult } from './flow.types'
import { chatWithAgent } from '../agents/chatwithAgent'
import logger from '../../lib/logger'

/**
 * Executa um flow de agentes sequencialmente
 * Cada node executa e passa dados para os próximos nodes conectados
 */
export class FlowExecutor {
  private context: FlowExecutionContext
  private flowData: FlowData
  private executedNodes: Set<string> = new Set()

  constructor(flowData: FlowData, context: FlowExecutionContext) {
    this.flowData = flowData
    this.context = context
  }

  /**
   * Executa o flow completo
   */
  async execute(): Promise<FlowExecutionContext> {
    try {
      logger.info(`[FlowExecutor] Iniciando execução do flow ${this.context.flowId}`)
      logger.log(`[FlowExecutor] Flow data:`, {
        startNodeId: this.flowData.startNodeId,
        nodesCount: this.flowData.nodes.length,
        edgesCount: this.flowData.edges.length,
        nodes: this.flowData.nodes.map(n => ({ id: n.id, label: n.data.label })),
        edges: this.flowData.edges.map(e => `${e.source} -> ${e.target}`)
      })
      
      // Valida o flow
      this.validateFlow()
      
      // Encontra o node inicial
      const startNode = this.findStartNode()
      if (!startNode) {
        throw new Error('Node inicial não encontrado')
      }

      logger.info(`[FlowExecutor] Node inicial encontrado: ${startNode.id} (${startNode.data.label})`)

      // Executa a partir do node inicial
      await this.executeNode(startNode.id)

      logger.info(`[FlowExecutor] Flow executado com sucesso. Nodes executados: ${this.executedNodes.size}`)
      
      return this.context
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar flow: ${error.message}`, error)
      throw error
    }
  }

  /**
   * Valida a estrutura do flow
   */
  private validateFlow(): void {
    if (!this.flowData.nodes || this.flowData.nodes.length === 0) {
      throw new Error('Flow não possui nodes')
    }

    if (!this.flowData.startNodeId) {
      throw new Error('Flow não possui startNodeId definido')
    }

    // Valida que todas as edges referenciam nodes existentes
    const nodeIds = new Set(this.flowData.nodes.map(n => n.id))
    for (const edge of this.flowData.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge inválida: source node '${edge.source}' não existe`)
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge inválida: target node '${edge.target}' não existe`)
      }
    }
  }

  /**
   * Encontra o node inicial
   */
  private findStartNode(): FlowNode | null {
    return this.flowData.nodes.find(n => n.id === this.flowData.startNodeId) || null
  }

  /**
   * Executa um node específico e seus sucessores
   */
  private async executeNode(nodeId: string): Promise<void> {
    // Evita execução duplicada
    if (this.executedNodes.has(nodeId)) {
      logger.warn(`[FlowExecutor] Node ${nodeId} já foi executado, pulando...`)
      return
    }

    const node = this.flowData.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} não encontrado`)
    }

    logger.info(`[FlowExecutor] Executando node ${nodeId} (tipo: ${node.type}, label: ${node.data.label})`)

    try {
      let processedResult: any = null
      let shouldContinue = true

      // Processa diferentes tipos de nodes
      switch (node.type) {
        case 'start':
          // Node de início - apenas marca como executado e continua
          logger.log(`[FlowExecutor] Node de início executado`)
          processedResult = { started: true }
          break

        case 'stop':
          // Node de parada - interrompe a execução
          logger.log(`[FlowExecutor] Node de parada encontrado. Interrompendo execução.`)
          processedResult = { stopped: true }
          shouldContinue = false
          break

        case 'delay':
          // Node de delay - aguarda o tempo especificado
          const duration = parseInt(String(node.data.duration || 0))
          if (duration > 0) {
            logger.log(`[FlowExecutor] Aguardando ${duration} segundos...`)
            await new Promise(resolve => setTimeout(resolve, duration * 1000))
            processedResult = { delayed: duration }
          }
          break

        case 'if-else':
          // Node condicional - avalia a condição e determina o caminho
          const conditionResult = this.evaluateCondition(node.data.condition || '', nodeId)
          processedResult = { conditionResult }
          logger.log(`[FlowExecutor] Condição avaliada: ${conditionResult}`)
          // O getNextNodes vai usar o sourceHandle para filtrar o caminho correto
          break

        case 'loop':
          // Node de loop - executa o agente dentro do loop
          await this.executeLoop(node)
          processedResult = { loopCompleted: true }
          // Não continua para os próximos nodes aqui, o loop já os executou
          shouldContinue = false
          break

        case 'code':
          // Node de código - por enquanto apenas loga
          logger.log(`[FlowExecutor] Node de código encontrado (não implementado ainda)`)
          processedResult = { codeExecuted: true }
          break

        case 'agent':
        default:
          // Node de agente - executa normalmente
          const nodeInput = this.prepareNodeInput(node)
          const result = await this.executeAgent(node, nodeInput)
          
          // Processa o resultado (tenta fazer parse de JSON se for string)
          processedResult = result
          if (typeof result === 'string') {
            try {
              processedResult = JSON.parse(result)
              logger.log(`[FlowExecutor] Resultado do node ${nodeId} parseado como JSON`)
              
              // Se for uma ação read_whatsapp_db, extrai apenas os dados das mensagens
              if (processedResult.action === 'read_whatsapp_db' && processedResult.messages) {
                if (processedResult.messages.length === 1) {
                  processedResult = processedResult.messages[0]
                  logger.log(`[FlowExecutor] Extraída 1 mensagem do read_whatsapp_db para o próximo node`)
                } else if (processedResult.messages.length > 1) {
                  processedResult = {
                    messages: processedResult.messages
                  }
                  logger.log(`[FlowExecutor] Extraídas ${processedResult.messages.length} mensagens do read_whatsapp_db`)
                } else {
                  processedResult = { messages: [] }
                  logger.log(`[FlowExecutor] Nenhuma mensagem encontrada no read_whatsapp_db`)
                }
              }
            } catch (e) {
              logger.log(`[FlowExecutor] Resultado do node ${nodeId} mantido como string`)
            }
          }
          break
      }

      // Marca como executado
      this.executedNodes.add(nodeId)

      // Salva o resultado no histórico
      this.context.executionHistory.push({
        nodeId: node.id,
        agentId: node.data.agentId || '',
        success: true,
        output: processedResult
      })

      // Atualiza o contexto com os dados de saída
      this.updateContextWithOutput(nodeId, processedResult)

      // Se for node de parada, não continua
      if (!shouldContinue && node.type === 'stop') {
        logger.info(`[FlowExecutor] Execução interrompida pelo node de parada`)
        return
      }

      // Se for loop, não continua (já executou os nodes internos)
      if (!shouldContinue && node.type === 'loop') {
        logger.info(`[FlowExecutor] Loop completado, continuando para próximos nodes`)
        // Continua para os próximos nodes após o loop
      }

      // Encontra e executa os nodes conectados (sucessores)
      const nextNodes = this.getNextNodes(nodeId, node.type === 'if-else' ? this.evaluateCondition(node.data.condition || '', nodeId) : undefined)
      logger.info(`[FlowExecutor] Node ${nodeId} executado. Próximos nodes encontrados: ${nextNodes.length}`)
      
      if (nextNodes.length === 0) {
        logger.log(`[FlowExecutor] Nenhum próximo node encontrado para ${nodeId}. Edges disponíveis:`, this.flowData.edges.map(e => `${e.source} -> ${e.target}`))
      } else {
        logger.log(`[FlowExecutor] Executando próximos nodes:`, nextNodes.map(n => `${n.id} (${n.data.label})`))
      }
      
      for (const nextNode of nextNodes) {
        await this.executeNode(nextNode.id)
      }

    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar node ${nodeId}: ${error.message}`, error)
      
      this.context.executionHistory.push({
        nodeId: node.id,
        agentId: node.data.agentId || '',
        success: false,
        error: error.message
      })

      // Decide se deve continuar ou parar em caso de erro
      // Por enquanto, propaga o erro
      throw error
    }
  }

  /**
   * Prepara o input para um node baseado no contexto e dados dos nodes anteriores
   * O Flow orquestra e prepara os dados para cada agente
   */
  private prepareNodeInput(node: FlowNode): string {
    // Coleta todos os dados disponíveis (iniciais + predecessores)
    const allData = {
      ...this.context.data,
      ...this.collectPredecessorData(node.id)
    }

    // Se é o node inicial, usa dados iniciais do contexto
    if (node.id === this.flowData.startNodeId) {
      // Formata mensagem clara para o agente
      const dataSummary = Object.keys(allData).length > 0 
        ? `\n\nDados disponíveis:\n${JSON.stringify(allData, null, 2)}`
        : ''
      
      return `Execute sua tarefa como agente "${node.data.label}".${dataSummary}`
    }

    // Para nodes subsequentes, coleta dados dos nodes predecessores
    const predecessorData = this.collectPredecessorData(node.id)
    const predecessorSummary = Object.keys(predecessorData).length > 0
      ? `\n\nDados recebidos dos nodes anteriores:\n${JSON.stringify(predecessorData, null, 2)}`
      : ''
    
    const contextSummary = Object.keys(this.context.data).length > 0
      ? `\n\nContexto global:\n${JSON.stringify(this.context.data, null, 2)}`
      : ''

    const finalMessage = `Execute sua tarefa como agente "${node.data.label}".${predecessorSummary}${contextSummary}`
    
    logger.log(`[FlowExecutor] Input preparado para node ${node.id}:`, {
      predecessorDataKeys: Object.keys(predecessorData),
      contextDataKeys: Object.keys(this.context.data),
      messageLength: finalMessage.length,
      messagePreview: finalMessage.substring(0, 300) + '...'
    })

    return finalMessage
  }

  /**
   * Coleta dados dos nodes predecessores (que apontam para este node)
   */
  private collectPredecessorData(nodeId: string): Record<string, any> {
    const predecessorData: Record<string, any> = {}

    // Encontra edges que apontam para este node
    const incomingEdges = this.flowData.edges.filter(e => e.target === nodeId)
    
    for (const edge of incomingEdges) {
      const predecessorNode = this.flowData.nodes.find(n => n.id === edge.source)
      if (predecessorNode && this.executedNodes.has(edge.source)) {
        // Busca o resultado do node predecessor no histórico
        const predecessorResult = this.context.executionHistory.find(
          h => h.nodeId === edge.source
        )
        
        if (predecessorResult?.output) {
          // Adiciona os dados do predecessor com prefixo do nodeId para evitar conflitos
          predecessorData[`${predecessorNode.id}_output`] = predecessorResult.output
          // Também mescla diretamente se for um objeto
          if (typeof predecessorResult.output === 'object') {
            Object.assign(predecessorData, predecessorResult.output)
          }
        }
      }
    }

    return predecessorData
  }

  /**
   * Executa o agente do node
   * O Flow orquestra e chama o agente com os dados preparados
   */
  private async executeAgent(node: FlowNode, input: string): Promise<any> {
    try {
      // O input já vem formatado como string (mensagem para o agente)
      const message = input

      logger.info(`[FlowExecutor] 🎯 Orquestrando execução do node ${node.id}`)
      logger.info(`[FlowExecutor] 📤 Chamando agente ${node.data.agentId} (${node.data.label})`)
      logger.log(`[FlowExecutor] Mensagem: ${message.substring(0, 200)}...`)

      // Combina contexto global + dados dos predecessores para passar ao agente
      const allContext = {
        ...this.context.data,
        ...this.collectPredecessorData(node.id)
      }

      logger.log(`[FlowExecutor] Contexto para substituição de templates no node ${node.id}:`, {
        contextKeys: Object.keys(allContext),
        contextData: allContext
      })

      // O Flow orquestra - o agente apenas executa
      // Chama o serviço de chat do agente (já existente) passando o contexto para substituição de templates
      const result = await chatWithAgent(
        this.context.userEmail,
        node.data.agentId,
        message,
        allContext // Passa o contexto para substituição de templates
      )
      
      logger.log(`[FlowExecutor] Resultado bruto do agente ${node.id}:`, {
        type: typeof result,
        isString: typeof result === 'string',
        preview: typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
      })

      logger.info(`[FlowExecutor] ✅ Agente ${node.data.agentId} executado com sucesso`)
      logger.log(`[FlowExecutor] Resultado: ${typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result).substring(0, 100)}...`)

      // Retorna o resultado para ser passado aos próximos nodes
      return result
    } catch (error: any) {
      logger.error(`[FlowExecutor] ❌ Erro ao executar agente ${node.data.agentId}: ${error.message}`, error)
      throw new Error(`Falha ao executar agente ${node.data.label}: ${error.message}`)
    }
  }

  /**
   * Atualiza o contexto com os dados de saída do node
   * Tenta fazer parse de JSON se o output for string
   */
  private updateContextWithOutput(nodeId: string, output: any): void {
    let parsedOutput = output

    // Se o output é uma string, tenta fazer parse de JSON
    if (typeof output === 'string') {
      try {
        // Tenta fazer parse do JSON
        parsedOutput = JSON.parse(output)
        logger.log(`[FlowExecutor] JSON parseado do node ${nodeId}:`, parsedOutput)
      } catch (e) {
        // Se não for JSON válido, mantém como string
        logger.log(`[FlowExecutor] Output do node ${nodeId} não é JSON, mantendo como string`)
      }
    }

    // Adiciona os dados de saída ao contexto global
    if (typeof parsedOutput === 'object' && parsedOutput !== null && !Array.isArray(parsedOutput)) {
      // Se for objeto, mescla diretamente no contexto
      Object.assign(this.context.data, parsedOutput)
      logger.log(`[FlowExecutor] Dados do node ${nodeId} mesclados no contexto:`, Object.keys(parsedOutput))
    } else {
      // Se for string, array ou outro tipo, guarda com prefixo do nodeId
      this.context.data[`${nodeId}_output`] = parsedOutput
      logger.log(`[FlowExecutor] Dados do node ${nodeId} guardados como ${nodeId}_output`)
    }
  }

  /**
   * Encontra os próximos nodes (sucessores) conectados a este node
   */
  private getNextNodes(nodeId: string, conditionResult?: boolean): FlowNode[] {
    const outgoingEdges = this.flowData.edges.filter(e => e.source === nodeId)
    logger.log(`[FlowExecutor] Buscando próximos nodes para ${nodeId}. Edges encontradas: ${outgoingEdges.length}`, outgoingEdges.map(e => `${e.source} -> ${e.target}`))
    
    // Se for um if-else e tiver resultado da condição, filtra pelo sourceHandle
    let filteredEdges = outgoingEdges
    if (conditionResult !== undefined) {
      const expectedHandle = conditionResult ? 'true' : 'false'
      filteredEdges = outgoingEdges.filter(e => e.sourceHandle === expectedHandle)
      logger.log(`[FlowExecutor] Filtrado para sourceHandle '${expectedHandle}': ${filteredEdges.length} edges`)
    }
    
    const nextNodeIds = filteredEdges.map(e => e.target)
    const nextNodes = this.flowData.nodes.filter(n => nextNodeIds.includes(n.id))
    
    logger.log(`[FlowExecutor] Nodes encontrados: ${nextNodes.length}`, nextNodes.map(n => n.id))
    
    return nextNodes
  }

  /**
   * Avalia uma condição usando o contexto atual
   */
  private evaluateCondition(condition: string, nodeId: string): boolean {
    if (!condition || condition.trim() === '') {
      logger.warn(`[FlowExecutor] Condição vazia no node ${nodeId}, retornando false`)
      return false
    }

    try {
      // Substitui variáveis do contexto no formato {{variavel}}
      let evaluatedCondition = condition
      const context = this.context.data
      
      // Substitui todas as variáveis {{variavel}} pelos valores do contexto
      evaluatedCondition = evaluatedCondition.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = context[varName]
        if (value === undefined || value === null) {
          logger.warn(`[FlowExecutor] Variável ${varName} não encontrada no contexto`)
          return 'undefined'
        }
        // Se for string, adiciona aspas, senão converte para string
        return typeof value === 'string' ? `'${value}'` : String(value)
      })

      logger.log(`[FlowExecutor] Condição original: ${condition}`)
      logger.log(`[FlowExecutor] Condição avaliada: ${evaluatedCondition}`)

      // Avalia operadores de texto
      if (evaluatedCondition.includes(' contém ')) {
        const [left, right] = evaluatedCondition.split(' contém ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = String(left).includes(String(right))
        logger.log(`[FlowExecutor] Avaliação 'contém': "${left}" contém "${right}" = ${result}`)
        return result
      }

      if (evaluatedCondition.includes(' não contém ')) {
        const [left, right] = evaluatedCondition.split(' não contém ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = !String(left).includes(String(right))
        logger.log(`[FlowExecutor] Avaliação 'não contém': "${left}" não contém "${right}" = ${result}`)
        return result
      }

      if (evaluatedCondition.includes(' está vazio')) {
        const left = evaluatedCondition.split(' está vazio')[0].trim().replace(/^'|'$/g, '')
        const result = !left || left === 'undefined' || left === ''
        logger.log(`[FlowExecutor] Avaliação 'está vazio': "${left}" = ${result}`)
        return result
      }

      if (evaluatedCondition.includes(' não está vazio')) {
        const left = evaluatedCondition.split(' não está vazio')[0].trim().replace(/^'|'$/g, '')
        const result = left && left !== 'undefined' && left !== ''
        logger.log(`[FlowExecutor] Avaliação 'não está vazio': "${left}" = ${result}`)
        return result
      }

      if (evaluatedCondition.includes(' começa com ')) {
        const [left, right] = evaluatedCondition.split(' começa com ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = String(left).startsWith(String(right))
        logger.log(`[FlowExecutor] Avaliação 'começa com': "${left}" começa com "${right}" = ${result}`)
        return result
      }

      if (evaluatedCondition.includes(' termina com ')) {
        const [left, right] = evaluatedCondition.split(' termina com ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = String(left).endsWith(String(right))
        logger.log(`[FlowExecutor] Avaliação 'termina com': "${left}" termina com "${right}" = ${result}`)
        return result
      }

      // Avalia operadores numéricos e de igualdade
      // Remove aspas simples para comparação
      evaluatedCondition = evaluatedCondition.replace(/'/g, '')

      // Substitui operadores por JavaScript
      evaluatedCondition = evaluatedCondition.replace(/==/g, '===')
      evaluatedCondition = evaluatedCondition.replace(/!=/g, '!==')

      // Usa Function para avaliar de forma segura (apenas comparações)
      const safeCondition = evaluatedCondition.replace(/[^a-zA-Z0-9_$.\s=<>!&|()'"]/g, '')
      const result = new Function('return ' + safeCondition)()
      
      logger.log(`[FlowExecutor] Resultado da avaliação: ${result}`)
      return Boolean(result)
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao avaliar condição "${condition}": ${error.message}`)
      return false
    }
  }

  /**
   * Executa um loop
   */
  private async executeLoop(node: FlowNode): Promise<void> {
    const iterations = node.data.infinite ? Infinity : parseInt(String(node.data.iterations || 1))
    const agentId = node.data.agentId

    if (!agentId) {
      logger.warn(`[FlowExecutor] Loop sem agente definido, pulando`)
      return
    }

    logger.log(`[FlowExecutor] Iniciando loop: ${node.data.infinite ? 'infinito' : `${iterations} iterações`} com agente ${agentId}`)

    // Encontra o node do agente dentro do loop (primeiro node conectado após o loop que corresponde ao agentId)
    const loopEdges = this.flowData.edges.filter(e => e.source === node.id)
    if (loopEdges.length === 0) {
      logger.warn(`[FlowExecutor] Loop sem nodes conectados, pulando`)
      return
    }

    // Procura o node que corresponde ao agentId configurado
    let loopTargetNode = this.flowData.nodes.find(n => 
      loopEdges.some(e => e.target === n.id) && n.data.agentId === agentId
    )

    // Se não encontrou pelo agentId, usa o primeiro node conectado
    if (!loopTargetNode) {
      loopTargetNode = this.flowData.nodes.find(n => n.id === loopEdges[0].target)
      if (loopTargetNode) {
        logger.warn(`[FlowExecutor] Node alvo do loop não corresponde ao agente configurado. Usando primeiro node conectado.`)
      }
    }

    if (!loopTargetNode) {
      logger.warn(`[FlowExecutor] Node alvo do loop não encontrado, pulando`)
      return
    }

    let iteration = 0
    while (node.data.infinite || iteration < iterations) {
      iteration++
      logger.log(`[FlowExecutor] Loop iteração ${iteration}${node.data.infinite ? ' (infinito)' : ` de ${iterations}`}`)

      // Executa o node alvo do loop (que deve ser o agente)
      await this.executeNode(loopTargetNode.id)

      // Se não for infinito e já completou todas as iterações, para
      if (!node.data.infinite && iteration >= iterations) {
        break
      }

      // Pequeno delay entre iterações para evitar sobrecarga
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.log(`[FlowExecutor] Loop completado: ${iteration} iterações executadas`)
  }
}
