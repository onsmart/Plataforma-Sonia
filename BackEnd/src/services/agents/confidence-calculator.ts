import { AgentDecision } from './agent-response.types'

export function calculateConfidence(
  parsedResponse: any,
  originalMessage: string,
  context?: Record<string, any>,
  historyLength: number = 0
): AgentDecision {
  let confidence = 1.0
  let reason = 'high_match'
  
  const messageLength = parsedResponse.message?.length || 0
  const originalLength = originalMessage?.trim().length || 0
  
  // Heurística 1: Mensagem original muito curta = baixa confiança
  // Mensagens com menos de 5 caracteres são extremamente ambíguas
  if (originalLength < 5) {
    confidence -= 0.4
    reason = 'low_context'
  } else if (originalLength < 10) {
    confidence -= 0.3
    reason = 'low_context'
  } else if (originalLength < 20) {
    confidence -= 0.2
    if (reason === 'high_match') reason = 'low_context'
  }
  
  // Heurística 2: Sem histórico de conversa = baixa confiança
  // Primeira mensagem sem contexto é sempre mais arriscada
  if (historyLength === 0) {
    confidence -= 0.25
    if (reason === 'high_match') reason = 'low_context'
  } else if (historyLength < 3) {
    // Pouco histórico também reduz confiança
    confidence -= 0.1
    if (reason === 'high_match') reason = 'low_context'
  }
  
  // Heurística 3: Mensagem original ambígua (contém "?", múltiplas intenções)
  // Mensagens ambíguas precisam de mais contexto
  const ambiguousPatterns = /\?|ou|talvez|não sei|pode ser|será que|acho que|não tenho certeza/i
  const isAmbiguous = ambiguousPatterns.test(originalMessage)
  
  if (isAmbiguous) {
    if (originalLength < 15) {
      // Muito ambígua e curta = muito baixa confiança
      confidence -= 0.35
      reason = 'ambiguous'
    } else if (originalLength < 30) {
      // Ambígua e curta = baixa confiança
      confidence -= 0.3
      reason = 'ambiguous'
    } else {
      // Ambígua mas com mais contexto
      confidence -= 0.2
      reason = 'ambiguous'
    }
  }
  
  // Heurística 4: Mensagens muito genéricas ou vazias
  const veryGenericPatterns = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i
  if (veryGenericPatterns.test(originalMessage?.trim() || '')) {
    confidence -= 0.3
    if (reason === 'high_match') reason = 'low_context'
  }
  
  // Heurística 5: Mensagens que são apenas interjeições ou emojis
  const interjectionPatterns = /^(ah|eh|hmm|hã|ops|eita|nossa|putz|caramba|😊|👍|👌|🤔|❓)$/i
  if (interjectionPatterns.test(originalMessage?.trim() || '')) {
    confidence -= 0.4
    reason = 'low_context'
  }
  
  // Heurística 6: Ação complexa sem contexto suficiente
  const complexActions = ['send_email', 'send_whatsapp', 'crm_capture_lead']
  if (complexActions.includes(parsedResponse.action) && !context) {
    confidence -= 0.25
    reason = 'insufficient_data'
  }
  
  // Heurística 7: Resposta contém placeholders não substituídos
  if (parsedResponse.message && /\{\{.*\}\}/.test(parsedResponse.message)) {
    confidence -= 0.35
    reason = 'insufficient_data'
  }
  
  // Heurística 8: Resposta muito genérica ou vazia
  const genericResponsePatterns = /^(ok|entendi|claro|sim|não|tudo bem)$/i
  if (genericResponsePatterns.test(parsedResponse.message?.trim() || '')) {
    confidence -= 0.2
    if (reason === 'high_match') reason = 'low_context'
  }
  
  // Heurística 9: Mensagem original muito longa sem estrutura clara (pode ser confusa)
  if (originalLength > 200 && !originalMessage.includes('?') && !originalMessage.includes('!')) {
    confidence -= 0.15
    if (reason === 'high_match') reason = 'ambiguous'
  }
  
  // Garantir que confidence está entre 0 e 1
  confidence = Math.max(0, Math.min(1, confidence))
  
  // 📊 LOG DETALHADO DO SCORE
  // Variáveis já declaradas acima, apenas reutilizando para logs
  const isVeryGeneric = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i.test(originalMessage?.trim() || '')
  const isInterjection = /^(ah|eh|hmm|hã|ops|eita|nossa|putz|caramba|😊|👍|👌|🤔|❓)$/i.test(originalMessage?.trim() || '')
  
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
  console.log('  • Mensagem original muito curta:', 
    originalLength < 5 ? '❌ -0.4' : 
    originalLength < 10 ? '❌ -0.3' : 
    originalLength < 20 ? '❌ -0.2' : '✅ OK')
  console.log('  • Sem histórico:', 
    historyLength === 0 ? '❌ -0.25' : 
    historyLength < 3 ? '⚠️ -0.1' : '✅ OK')
  console.log('  • Mensagem ambígua:', 
    isAmbiguous && originalLength < 15 ? '❌ -0.35' :
    isAmbiguous && originalLength < 30 ? '❌ -0.3' :
    isAmbiguous ? '⚠️ -0.2' : '✅ OK')
  console.log('  • Mensagem muito genérica:', isVeryGeneric ? '❌ -0.3' : '✅ OK')
  console.log('  • Apenas interjeição/emoji:', isInterjection ? '❌ -0.4' : '✅ OK')
  console.log('  • Ação complexa sem contexto:', ['send_email', 'send_whatsapp', 'crm_capture_lead'].includes(parsedResponse.action) && !context ? '❌ -0.25' : '✅ OK')
  console.log('  • Placeholders não substituídos:', parsedResponse.message && /\{\{.*\}\}/.test(parsedResponse.message) ? '❌ -0.35' : '✅ OK')
  console.log('  • Resposta genérica:', /^(ok|entendi|claro|sim|não|tudo bem)$/i.test(parsedResponse.message?.trim() || '') ? '❌ -0.2' : '✅ OK')
  console.log('')
  console.log('🎯 SCORE FINAL:', (confidence * 100).toFixed(1) + '%')
  console.log('📌 Motivo:', reason)
  console.log('🚦 Status:', confidence < 0.7 ? '🛡️ BLOQUEADO (requer aprovação)' : '✅ APROVADO (envio automático)')
  console.log('═══════════════════════════════════════════════════════════')
  
  return {
    answer: parsedResponse.message || '',
    confidence_score: confidence,
    reason: reason,
    metadata: {
      message_length: messageLength,
      has_context: !!context,
      action_type: parsedResponse.action,
      requires_approval: confidence < 0.7
    }
  }
}
