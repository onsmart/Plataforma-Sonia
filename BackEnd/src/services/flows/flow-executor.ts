import { FlowData, FlowNode, FlowEdge, FlowExecutionContext, NodeExecutionResult } from './flow.types'
import { chatWithAgent } from '../agents/chatwithAgent'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'

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
      let extractedQrCode: string | undefined = undefined

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
          
          // Tenta extrair QR code do resultado se for string de erro
          if (typeof result === 'string' && (result.includes('QR') || result.includes('QR Code') || result.includes('qrcode') || result.includes('CÓDIGO BASE64'))) {
            logger.log(`[FlowExecutor] Tentando extrair QR code do resultado do node ${nodeId}`, { 
              resultLength: result.length,
              hasQR: result.includes('QR'),
              hasCodigoBase64: result.includes('CÓDIGO BASE64'),
              preview: result.substring(0, 500)
            })
            
            // Padrão 1: Procura por "CÓDIGO BASE64 DO QR CODE:" seguido de data:image/png;base64,...
            // Captura tudo até encontrar a linha de traços ou fim (usando [\s\S]*? para capturar qualquer coisa incluindo quebras de linha)
            const qrCodeHeaderPattern = /CÓDIGO BASE64 DO QR CODE:[\s\S]*?data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+?)(?:\n[─═]+|────────────────|════|(?:\n\n)|$)/gi
            let qrMatch = qrCodeHeaderPattern.exec(result)
            if (qrMatch && qrMatch[1]) {
              const cleanBase64 = qrMatch[1].replace(/[\s\n\r─═]/g, '').trim()
              if (cleanBase64.length >= 300) {
                extractedQrCode = `data:image/png;base64,${cleanBase64}`
                logger.log(`[FlowExecutor] ✅ QR code extraído (padrão header) do resultado do node ${nodeId}`, { 
                  length: cleanBase64.length,
                  preview: cleanBase64.substring(0, 50) + '...'
                })
              } else {
                logger.log(`[FlowExecutor] ⚠️ Base64 muito curto no padrão header`, { length: cleanBase64.length })
              }
            }
            
            // Padrão 2: Procura diretamente por data:image/png;base64,... (pode estar em qualquer lugar)
            // Captura tudo até encontrar algo que não seja base64 válido ou linha de traços
            // Usa [\s\S]*? para capturar qualquer caractere incluindo quebras de linha
            if (!extractedQrCode) {
              const qrCodePattern = /data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+?)(?:\n[─═]+|────────────────|════|(?:\n\n)|$)/gi
              qrMatch = qrCodePattern.exec(result)
              if (qrMatch && qrMatch[1]) {
                const cleanBase64 = qrMatch[1].replace(/[\s\n\r─═]/g, '').trim()
                if (cleanBase64.length >= 300) {
                  extractedQrCode = `data:image/png;base64,${cleanBase64}`
                  logger.log(`[FlowExecutor] ✅ QR code extraído (padrão data URL) do resultado do node ${nodeId}`, { 
                    length: cleanBase64.length,
                    preview: cleanBase64.substring(0, 50) + '...'
                  })
                } else {
                  logger.log(`[FlowExecutor] ⚠️ Base64 muito curto no padrão data URL`, { length: cleanBase64.length })
                }
              }
            }
            
            // Padrão 2b: Versão mais permissiva - captura tudo após data:image/png;base64, até encontrar linha de traços
            if (!extractedQrCode) {
              const qrCodePattern2 = /data:image\/png;base64,([\s\S]+?)(?:\n[─═]{10,}|────────────────|════)/gi
              qrMatch = qrCodePattern2.exec(result)
              if (qrMatch && qrMatch[1]) {
                const cleanBase64 = qrMatch[1].replace(/[\s\n\r─═]/g, '').trim()
                if (cleanBase64.length >= 300) {
                  extractedQrCode = `data:image/png;base64,${cleanBase64}`
                  logger.log(`[FlowExecutor] ✅ QR code extraído (padrão data URL permissivo) do resultado do node ${nodeId}`, { 
                    length: cleanBase64.length,
                    preview: cleanBase64.substring(0, 50) + '...'
                  })
                }
              }
            }
            
            // Padrão 2c: Versão ainda mais permissiva - captura tudo após data:image/png;base64, até encontrar qualquer linha que não seja base64
            if (!extractedQrCode) {
              // Encontra a posição de "data:image/png;base64,"
              const dataUrlIndex = result.indexOf('data:image/png;base64,')
              if (dataUrlIndex !== -1) {
                // Pega tudo após o prefixo até encontrar uma linha que comece com algo que não seja base64
                const afterPrefix = result.substring(dataUrlIndex + 'data:image/png;base64,'.length)
                // Remove tudo que não é base64 válido (espaços, quebras de linha, traços)
                const cleanBase64 = afterPrefix.replace(/[^A-Za-z0-9+/=]/g, '').trim()
                if (cleanBase64.length >= 300) {
                  extractedQrCode = `data:image/png;base64,${cleanBase64}`
                  logger.log(`[FlowExecutor] ✅ QR code extraído (método direto) do resultado do node ${nodeId}`, { 
                    length: cleanBase64.length,
                    preview: cleanBase64.substring(0, 50) + '...'
                  })
                }
              }
            }
            
            // Padrão 3: Procura por string longa de base64 (mínimo 300 caracteres)
            // Remove quebras de linha e espaços primeiro
            if (!extractedQrCode) {
              const cleanedResult = result.replace(/[\s\n\r─═]/g, '')
              const longBase64Pattern = /([A-Za-z0-9+/=]{300,})/g
              const base64Match = longBase64Pattern.exec(cleanedResult)
              if (base64Match && base64Match[1]) {
                extractedQrCode = `data:image/png;base64,${base64Match[1]}`
                logger.log(`[FlowExecutor] ✅ QR code extraído (base64 puro) do resultado do node ${nodeId}`, { 
                  length: base64Match[1].length,
                  preview: base64Match[1].substring(0, 50) + '...'
                })
              }
            }
            
            if (!extractedQrCode) {
              logger.warn(`[FlowExecutor] ⚠️ QR code NÃO foi extraído do resultado do node ${nodeId}`, {
                resultLength: result.length,
                hasQR: result.includes('QR'),
                hasDataImage: result.includes('data:image/png;base64'),
                resultPreview: result.substring(0, 1000)
              })
            }
          }
          
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
          
          // Se extraiu QR code, armazena para incluir no histórico
          if (extractedQrCode) {
            (processedResult as any).__qrCode = extractedQrCode
          }
          break
      }

      // Marca como executado
      this.executedNodes.add(nodeId)

      // Extrai QR code se estiver no resultado processado ou se foi extraído anteriormente
      let qrCode: string | undefined = extractedQrCode
      if (!qrCode && processedResult && typeof processedResult === 'object' && (processedResult as any).__qrCode) {
        qrCode = (processedResult as any).__qrCode
        // Remove o campo temporário do resultado
        delete (processedResult as any).__qrCode
      }

      // Salva o resultado no histórico
      this.context.executionHistory.push({
        nodeId: node.id,
        agentId: node.data.agentId || '',
        success: true,
        output: processedResult,
        qrCode: qrCode
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
      
      // Tenta extrair QR code da mensagem de erro usando os mesmos padrões
      let extractedQrCode: string | undefined = undefined
      const errorMessage = error.message || String(error)
      if (errorMessage && (errorMessage.includes('QR') || errorMessage.includes('QR Code') || errorMessage.includes('qrcode') || errorMessage.includes('CÓDIGO BASE64'))) {
        // Padrão 1: Procura por "CÓDIGO BASE64 DO QR CODE:" seguido de data:image/png;base64,...
        const qrCodeHeaderPattern = /CÓDIGO BASE64 DO QR CODE:[\s\S]*?data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+?)(?:\n|$|────────────────|════)/gi
        let qrMatch = qrCodeHeaderPattern.exec(errorMessage)
        if (qrMatch && qrMatch[1]) {
          const cleanBase64 = qrMatch[1].replace(/[\s\n\r─═]/g, '').trim()
          if (cleanBase64.length >= 300) {
            extractedQrCode = `data:image/png;base64,${cleanBase64}`
            logger.log(`[FlowExecutor] QR code extraído (padrão header) da mensagem de erro do node ${nodeId}`, { length: cleanBase64.length })
          }
        }
        
        // Padrão 2: Procura diretamente por data:image/png;base64,...
        if (!extractedQrCode) {
          const qrCodePattern = /data:image\/png;base64,([A-Za-z0-9+/=\s\n\r─═]+)/gi
          qrMatch = qrCodePattern.exec(errorMessage)
          if (qrMatch && qrMatch[1]) {
            const cleanBase64 = qrMatch[1].replace(/[\s\n\r─═]/g, '').trim()
            if (cleanBase64.length >= 300) {
              extractedQrCode = `data:image/png;base64,${cleanBase64}`
              logger.log(`[FlowExecutor] QR code extraído (padrão data URL) da mensagem de erro do node ${nodeId}`, { length: cleanBase64.length })
            }
          }
        }
        
        // Padrão 3: Procura por string longa de base64
        if (!extractedQrCode) {
          const cleanedError = errorMessage.replace(/[\s\n\r─═]/g, '')
          const longBase64Pattern = /([A-Za-z0-9+/=]{300,})/g
          const base64Match = longBase64Pattern.exec(cleanedError)
          if (base64Match && base64Match[1]) {
            extractedQrCode = `data:image/png;base64,${base64Match[1]}`
            logger.log(`[FlowExecutor] QR code extraído (base64 puro) da mensagem de erro do node ${nodeId}`, { length: base64Match[1].length })
          }
        }
      }
      
      this.context.executionHistory.push({
        nodeId: node.id,
        agentId: node.data.agentId || '',
        success: false,
        error: error.message,
        qrCode: extractedQrCode
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

      // 🎯 IMPORTANTE: Armazenar a mensagem original do usuário no contexto
      // Se a mensagem original estiver em initialData ou no contexto, preserva para cálculo de confiança
      // A mensagem original pode estar em: initialMessage, userMessage, originalMessage, ou message (se não for instrução do flow)
      if (!allContext.originalMessage && !allContext.userMessage) {
        // Se a mensagem atual não parece ser uma instrução do flow, pode ser a mensagem original
        if (!message.includes('Execute sua tarefa como agente') && !message.includes('Dados recebidos dos nodes anteriores')) {
          allContext.originalMessage = message
          allContext.userMessage = message
        } else if (this.context.data.message || this.context.data.originalMessage || this.context.data.userMessage) {
          // Se a mensagem é uma instrução do flow, busca a mensagem original do contexto
          allContext.originalMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
          allContext.userMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
        }
      }

      logger.log(`[FlowExecutor] Contexto para substituição de templates no node ${node.id}:`, {
        contextKeys: Object.keys(allContext),
        contextData: allContext,
        originalMessage: allContext.originalMessage || allContext.userMessage || 'não encontrada'
      })

      // O Flow orquestra - o agente apenas executa
      // Chama o serviço de chat do agente (já existente) passando o contexto para substituição de templates
      if (!node.data.agentId) {
        throw new Error(`Agent ID não encontrado no node ${node.id}`)
      }
      
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
        const result = !!(left && left !== 'undefined' && left !== '')
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
   * Executa um loop - executa um fluxo completo repetidamente
   */
  private async executeLoop(node: FlowNode): Promise<void> {
    const iterations = node.data.infinite ? Infinity : parseInt(String(node.data.iterations || 1))
    const flowId = node.data.flowId

    if (!flowId) {
      logger.warn(`[FlowExecutor] Loop sem fluxo definido, pulando`)
      return
    }

    // Previne recursão infinita: não permite que um flow execute a si mesmo
    if (flowId === this.context.flowId) {
      logger.error(`[FlowExecutor] Tentativa de executar o próprio flow em loop (recursão infinita). Flow ${flowId} não pode executar a si mesmo.`)
      throw new Error(`Não é possível executar o próprio flow em loop. Isso causaria recursão infinita.`)
    }

    logger.log(`[FlowExecutor] Iniciando loop: ${node.data.infinite ? 'infinito' : `${iterations} iterações`} com fluxo ${flowId}`)

    let iteration = 0
    while (node.data.infinite || iteration < iterations) {
      iteration++
      logger.log(`[FlowExecutor] Loop iteração ${iteration}${node.data.infinite ? ' (infinito)' : ` de ${iterations}`}`)

      try {
        // Busca o flow do banco de dados diretamente (evita dependência circular)
        const { data, error } = await supabase
          .from('tb_flows')
          .select('nodes')
          .eq('id', flowId)
          .eq('user_email', this.context.userEmail)
          .single()

        if (error || !data) {
          logger.error(`[FlowExecutor] Flow ${flowId} não encontrado no loop:`, error)
          break
        }

        const subFlowData = data?.nodes as FlowData | null
        
        if (!subFlowData) {
          logger.error(`[FlowExecutor] Flow ${flowId} não encontrado no loop, interrompendo`)
          break
        }

        // Cria um novo contexto para o sub-flow (herda dados do contexto pai)
        const subContext: FlowExecutionContext = {
          flowId: flowId,
          userId: this.context.userId,
          userEmail: this.context.userEmail,
          data: { ...this.context.data }, // Herda dados do contexto pai
          executionHistory: []
        }

        // Cria e executa o sub-flow
        const subExecutor = new FlowExecutor(subFlowData, subContext)
        const subResult = await subExecutor.execute()

        // Mescla os dados do sub-flow de volta no contexto principal
        Object.assign(this.context.data, subResult.data)

        // Adiciona o histórico de execução do sub-flow ao histórico principal
        this.context.executionHistory.push(...subResult.executionHistory)

        logger.log(`[FlowExecutor] Sub-flow ${flowId} executado com sucesso na iteração ${iteration}`)
      } catch (error: any) {
        logger.error(`[FlowExecutor] Erro ao executar sub-flow ${flowId} na iteração ${iteration}: ${error.message}`)
        // Decide se deve continuar ou parar em caso de erro
        // Por enquanto, continua para a próxima iteração
      }

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
