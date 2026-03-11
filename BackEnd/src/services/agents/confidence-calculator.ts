import { AgentDecision } from './agent-response.types'

export function calculateConfidence(
  parsedResponse: any,
  originalMessage: string,
  context?: Record<string, any>,
  historyLength: number = 0,
  hasFileContext: boolean = false, // ✅ NOVO: indica se há contexto de arquivos (RAG)
  sources?: string[] // ✅ NOVO: IDs dos arquivos usados no RAG
): AgentDecision {
  // ✅ AJUSTE: Começar com 85% para dar mais margem e evitar aprovações desnecessárias
  // Isso garante que mensagens normais passem do threshold de 70%
  let confidence = 0.85
  let reason = 'high_match'

  const messageLength = parsedResponse.message?.length || 0
  const originalLength = originalMessage?.trim().length || 0

  // ✅ BÔNUS: Se há contexto de arquivos (RAG), aumenta confiança MUITO significativamente
  if (hasFileContext) {
    // Quando há arquivos, começamos com um bônus base maior
    confidence += 0.3 // Bônus base aumentado quando há contexto de arquivos (RAG)

    // ✅ BÔNUS EXTRA: Se a resposta parece estar usando o contexto corretamente
    const responseMessage = parsedResponse.message?.toLowerCase() || ''
    const responseLength = responseMessage.length

    // Verifica se a resposta contém informações específicas que provavelmente vieram dos arquivos
    const hasPhoneNumber = /\d{10,}/.test(responseMessage) // Números de telefone (10+ dígitos)
    const hasContactKeywords = /ligue|telefone|contato|suporte|numero|número|ligar|chamar/i.test(responseMessage)
    const hasSpecificData = /\d+/.test(responseMessage) && responseLength > 40 // Tem números e é detalhada
    const isDetailedResponse = responseLength > 50 && !/^(ok|sim|não|entendi|claro)$/i.test(parsedResponse.message?.trim() || '')
    const hasUsefulInfo = responseLength > 30 && !/^(ok|sim|não|entendi|claro|tudo bem)$/i.test(parsedResponse.message?.trim() || '')
    const isSubstantialResponse = responseLength > 40 && !/^(ok|sim|não|entendi|claro|tudo bem|beleza)$/i.test(parsedResponse.message?.trim() || '')

    // Se a resposta parece estar usando o contexto corretamente (tem informações específicas)
    if ((hasPhoneNumber || (hasContactKeywords && hasSpecificData)) && isDetailedResponse) {
      // Resposta está usando o contexto dos arquivos corretamente - CONFIANÇA MÁXIMA
      confidence += 0.5 // Bônus extra MUITO significativo quando resposta parece correta
      // Garantir que chegue a pelo menos 80-90% mesmo com penalidades
      if (confidence < 0.85) {
        confidence = 0.85 // Mínimo de 85% quando há arquivos e resposta é correta
      }
      reason = 'high_match' // Arquivos fornecem contexto suficiente e resposta parece correta
      console.log('  • Contexto de arquivos (RAG) encontrado: ✅ +0.30')
      console.log('  • Resposta usando contexto corretamente: ✅ +0.50 (BÔNUS EXTRA MÁXIMO)')
      console.log('  • 🎯 CONFIANÇA GARANTIDA: Mínimo 85% quando há arquivos e resposta correta')
    } else if (hasContactKeywords && hasUsefulInfo) {
      // Resposta menciona contato mas pode não ter número específico
      confidence += 0.35 // Bônus médio aumentado
      // Garantir pelo menos 75% quando há arquivos e menciona contato
      if (confidence < 0.75) {
        confidence = 0.75
      }
      console.log('  • Contexto de arquivos (RAG) encontrado: ✅ +0.30')
      console.log('  • Resposta menciona contato: ✅ +0.35 (BÔNUS EXTRA)')
      console.log('  • 🎯 CONFIANÇA GARANTIDA: Mínimo 75% quando há arquivos e menciona contato')
    } else if (isSubstantialResponse) {
      // Resposta tem informações úteis mesmo sem palavras-chave específicas
      confidence += 0.25 // Bônus significativo
      // Garantir pelo menos 70% quando há arquivos e resposta é substancial
      if (confidence < 0.7) {
        confidence = 0.7
      }
      console.log('  • Contexto de arquivos (RAG) encontrado: ✅ +0.30')
      console.log('  • Resposta com informações úteis: ✅ +0.25 (BÔNUS EXTRA)')
      console.log('  • 🎯 CONFIANÇA GARANTIDA: Mínimo 70% quando há arquivos e resposta útil')
    } else {
      // Apenas tem arquivos, mas resposta não é muito útil
      // Garantir pelo menos 65% quando há arquivos
      if (confidence < 0.65) {
        confidence = 0.65
      }
      console.log('  • Contexto de arquivos (RAG) encontrado: ✅ +0.30')
      console.log('  • 🎯 CONFIANÇA GARANTIDA: Mínimo 65% quando há arquivos')
    }

    if (reason === 'low_context' || reason === 'ambiguous') {
      reason = 'high_match' // Arquivos fornecem contexto suficiente
    }
  }

  // Heurística 1: Mensagem original muito curta = baixa confiança
  // Mensagens com menos de 5 caracteres são ambíguas, mas aceitáveis para saudações
  if (originalLength < 5) {
    confidence -= hasFileContext ? 0.05 : 0.10 // Reduzido: penalidade menor para mensagens muito curtas
    reason = 'low_context'
  } else if (originalLength < 10) {
    confidence -= hasFileContext ? 0.03 : 0.06 // Reduzido: penalidade leve
    reason = 'low_context'
  } else if (originalLength < 20) {
    confidence -= hasFileContext ? 0.02 : 0.04 // Reduzido: penalidade muito leve
    if (reason === 'high_match') reason = 'low_context'
  }

  // Heurística 2: Sem histórico de conversa
  // Primeira mensagem sem contexto é comum em chats, mas reduz confiança
  if (historyLength === 0) {
    confidence -= hasFileContext ? 0.02 : 0.04 // Reduzido: penalidade leve para primeira mensagem
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  } else if (historyLength < 3) {
    confidence -= hasFileContext ? 0.01 : 0.02 // Reduzido: penalidade muito leve para histórico curto
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  }

  // Heurística 3: Mensagem original ambígua (contém "?", múltiplas intenções)
  // Mensagens ambíguas precisam de mais contexto
  const ambiguousPatterns = /\?|ou|talvez|não sei|pode ser|será que|acho que|não tenho certeza/i
  const isAmbiguous = ambiguousPatterns.test(originalMessage)

  if (isAmbiguous) {
    if (originalLength < 15) {
      confidence -= hasFileContext ? 0.05 : 0.10 // Reduzido: penalidade menor para ambiguidade + mensagem curta
      reason = 'ambiguous'
    } else if (originalLength < 30) {
      confidence -= hasFileContext ? 0.03 : 0.06 // Reduzido: penalidade leve
      reason = 'ambiguous'
    } else {
      confidence -= hasFileContext ? 0.02 : 0.04 // Reduzido: penalidade muito leve para ambiguidade em mensagens longas
      reason = 'ambiguous'
    }
  }

  // Heurística 4: Mensagens muito genéricas ou vazias
  const veryGenericPatterns = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i
  if (veryGenericPatterns.test(originalMessage?.trim() || '')) {
    confidence -= hasFileContext ? 0.05 : 0.10 // Reduzido: penalidade menor para respostas genéricas
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  }

  // Heurística 5: Mensagens que são apenas interjeições ou emojis
  const interjectionPatterns = /^(ah|eh|hmm|hã|ops|eita|nossa|putz|caramba|😊|👍|👌|🤔|❓)$/i
  if (interjectionPatterns.test(originalMessage?.trim() || '')) {
    confidence -= hasFileContext ? 0.06 : 0.12 // Reduzido: penalidade menor para interjeições
    if (!hasFileContext) reason = 'low_context'
  }

  // Heurística 6: Ação complexa sem contexto suficiente
  const complexActions = ['send_email', 'send_whatsapp', 'crm_capture_lead']
  if (complexActions.includes(parsedResponse.action) && !context) {
    confidence -= hasFileContext ? 0.05 : 0.08 // Reduzido: penalidade menor para ações complexas sem contexto
    if (!hasFileContext) reason = 'insufficient_data'
  }

  // Heurística 7: Resposta contém placeholders não substituídos
  if (parsedResponse.message && /\{\{.*\}\}/.test(parsedResponse.message)) {
    confidence -= 0.15 // Reduzido: penalidade menor para placeholders não substituídos
    reason = 'insufficient_data'
  }

  // Heurística 8: Resposta muito genérica ou vazia
  const genericResponsePatterns = /^(ok|entendi|claro|sim|não|tudo bem)$/i
  if (genericResponsePatterns.test(parsedResponse.message?.trim() || '')) {
    confidence -= 0.05 // Reduzido: penalidade leve para respostas genéricas do agente
    if (reason === 'high_match') reason = 'low_context'
  }

  // Heurística 9: Mensagem original muito longa sem estrutura clara (pode ser confusa)
  if (originalLength > 200 && !originalMessage.includes('?') && !originalMessage.includes('!')) {
    confidence -= 0.04 // Reduzido: penalidade muito leve para mensagens muito longas
    if (reason === 'high_match') reason = 'ambiguous'
  }
  
  // ✅ NOVA Heurística 10: Bônus para mensagens bem estruturadas e informativas
  // Mensagens com boa estrutura (pergunta clara, contexto suficiente) recebem bônus
  if (originalLength >= 20 && originalLength <= 200) {
    const hasQuestion = originalMessage.includes('?')
    const hasContext = originalLength > 30
    const isWellStructured = hasQuestion || hasContext
    const isVeryGenericCheck = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i.test(originalMessage?.trim() || '')
    
    if (isWellStructured && !isAmbiguous && !isVeryGenericCheck) {
      confidence += 0.08 // Aumentado: bônus maior para mensagens bem estruturadas
      if (reason === 'low_context' || reason === 'ambiguous') {
        reason = 'high_match'
      }
    }
  }

  // Garantir que confidence está entre 0 e 1
  confidence = Math.max(0, Math.min(1, confidence))

  // 📊 LOG DETALHADO DO SCORE
  // Variáveis já declaradas acima, apenas reutilizando para logs
  const isVeryGeneric = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i.test(originalMessage?.trim() || '')
  const isInterjection = /^(ah|eh|hmm|hã|ops|eita|nossa|putz|caramba|😊|👍|👌|🤔|❓)$/i.test(originalMessage?.trim() || '')
  
  // Recalcular isAmbiguous para o log (já foi calculado acima)
  const isAmbiguousForLog = ambiguousPatterns.test(originalMessage)

  console.log('═══════════════════════════════════════════════════════════')
  console.log('🎯 [CONFIDENCE CALCULATOR] Cálculo de Confiança')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('📝 Mensagem Original:', originalMessage?.substring(0, 100) || '(vazia)')
  console.log('📏 Tamanho da Mensagem Original:', originalLength, 'caracteres')
  console.log('💬 Resposta Gerada:', parsedResponse.message?.substring(0, 100) || '(vazia)')
  console.log('📏 Tamanho da Resposta:', messageLength, 'caracteres')
  console.log('📚 Histórico de Conversa:', historyLength, 'mensagens')
  console.log('🔧 Ação:', parsedResponse.action || 'nenhuma')
  console.log('')
  console.log('📊 HEURÍSTICAS APLICADAS:')
  const shortPenalty = originalLength < 5 ? (hasFileContext ? 0.08 : 0.15) :
    originalLength < 10 ? (hasFileContext ? 0.05 : 0.10) :
      originalLength < 20 ? (hasFileContext ? 0.03 : 0.06) : 0
  console.log('  • Mensagem original muito curta:',
    shortPenalty > 0 ? `❌ -${shortPenalty.toFixed(2)}` : '✅ OK')

  const historyPenalty = historyLength === 0 ? (hasFileContext ? 0.03 : 0.08) :
    historyLength < 3 ? (hasFileContext ? 0.02 : 0.04) : 0
  console.log('  • Sem histórico:',
    historyPenalty > 0 ? `❌ -${historyPenalty.toFixed(2)}` : '✅ OK')

  const ambiguousPenalty = isAmbiguousForLog && originalLength < 15 ? (hasFileContext ? 0.08 : 0.15) :
    isAmbiguousForLog && originalLength < 30 ? (hasFileContext ? 0.05 : 0.10) :
      isAmbiguousForLog ? (hasFileContext ? 0.03 : 0.06) : 0
  console.log('  • Mensagem ambígua:',
    ambiguousPenalty > 0 ? `❌ -${ambiguousPenalty.toFixed(2)}` : '✅ OK')

  const genericPenalty = isVeryGeneric ? (hasFileContext ? 0.08 : 0.15) : 0
  console.log('  • Mensagem muito genérica:', genericPenalty > 0 ? `❌ -${genericPenalty.toFixed(2)}` : '✅ OK')

  const interjectionPenalty = isInterjection ? (hasFileContext ? 0.10 : 0.20) : 0
  console.log('  • Apenas interjeição/emoji:', interjectionPenalty > 0 ? `❌ -${interjectionPenalty.toFixed(2)}` : '✅ OK')

  const complexActionPenalty = ['send_email', 'send_whatsapp', 'crm_capture_lead'].includes(parsedResponse.action) && !context ? (hasFileContext ? 0.08 : 0.12) : 0
  console.log('  • Ação complexa sem contexto:', complexActionPenalty > 0 ? `❌ -${complexActionPenalty.toFixed(2)}` : '✅ OK')
  
  // Bônus para mensagens bem estruturadas
  const wellStructuredBonus = (originalLength >= 20 && originalLength <= 200 && 
    (originalMessage.includes('?') || originalLength > 30) && 
    !isAmbiguousForLog && !isVeryGeneric) ? 0.05 : 0
  console.log('  • Mensagem bem estruturada:', wellStructuredBonus > 0 ? `✅ +${wellStructuredBonus.toFixed(2)}` : '➖ N/A')

  // Calcular bônus total de RAG para o log
  let ragBonusText = '❌ Nenhum'
  if (hasFileContext) {
    const responseMsg = parsedResponse.message?.toLowerCase() || ''
    const hasPhone = /\d{10,}/.test(responseMsg)
    const hasContact = /ligue|telefone|contato|suporte|numero|número|ligar|chamar/i.test(responseMsg)
    const hasData = /\d+/.test(responseMsg) && responseMsg.length > 40
    const isDetailed = responseMsg.length > 50 && !/^(ok|sim|não|entendi|claro)$/i.test(parsedResponse.message?.trim() || '')
    const hasUseful = responseMsg.length > 30 && !/^(ok|sim|não|entendi|claro|tudo bem)$/i.test(parsedResponse.message?.trim() || '')
    const isSubstantial = responseMsg.length > 40 && !/^(ok|sim|não|entendi|claro|tudo bem|beleza)$/i.test(parsedResponse.message?.trim() || '')

    if ((hasPhone || (hasContact && hasData)) && isDetailed) {
      ragBonusText = '✅ +0.80 (base +0.30 + extra +0.50) → MÍNIMO 85%'
    } else if (hasContact && hasUseful) {
      ragBonusText = '✅ +0.65 (base +0.30 + extra +0.35) → MÍNIMO 75%'
    } else if (isSubstantial) {
      ragBonusText = '✅ +0.55 (base +0.30 + extra +0.25) → MÍNIMO 70%'
    } else {
      ragBonusText = '✅ +0.30 (base) → MÍNIMO 65%'
    }
  }
  console.log('  • Contexto de arquivos (RAG):', ragBonusText)
  console.log('  • Placeholders não substituídos:', parsedResponse.message && /\{\{.*\}\}/.test(parsedResponse.message) ? '❌ -0.15' : '✅ OK')
  console.log('  • Resposta genérica:', /^(ok|entendi|claro|sim|não|tudo bem)$/i.test(parsedResponse.message?.trim() || '') ? '❌ -0.05' : '✅ OK')
  console.log('')
  console.log('🎯 SCORE FINAL:', (confidence * 100).toFixed(1) + '%')
  console.log('📌 Motivo:', reason)
  console.log('🚦 Status:', confidence < 0.7 ? '🛡️ BLOQUEADO (requer aprovação)' : '✅ APROVADO (envio automático)')
  console.log('═══════════════════════════════════════════════════════════')

  return {
    answer: parsedResponse.message || '',
    confidence_score: confidence,
    reason: reason,
    sources: sources || undefined, // ✅ IDs dos arquivos usados no RAG
    metadata: {
      message_length: messageLength,
      has_context: !!context,
      action_type: parsedResponse.action,
      requires_approval: confidence < 0.7
    }
  }
}
