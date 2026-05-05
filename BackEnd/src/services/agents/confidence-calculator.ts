import { AgentDecision } from './agent-response.types'

/** Limiar padrão alinhado ao fluxo de aprovação no chatWithAgent */
export const DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD = 0.7

/**
 * Permite ajustar o corte sem alterar código (ex.: 0.65 em produção).
 * Valores fora de (0,1) ignorados.
 */
export function getConfidenceApprovalThreshold(): number {
  const raw = parseFloat(String(process.env.AGENT_CONFIDENCE_THRESHOLD ?? '').trim())
  if (!Number.isFinite(raw) || raw <= 0 || raw >= 1) {
    return DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD
  }
  return raw
}

type ConfidenceReason = AgentDecision['reason']

type AdjustmentLog = {
  label: string
  delta: number
  note?: string
}

/** Incerteza explícita do usuário — não confundir com "?" de pergunta direta */
const USER_UNCERTAINTY_RE =
  /\b(?:n[aã]o\s+sei|talvez|ser[aá]\s+que|acho\s+que|n[aã]o\s+tenho\s+certeza|n[aã]o\s+tenho\s+ideia|pode\s+ser|ou\s+seja)\b/i

function isClearQuestion(message: string): boolean {
  const t = message.trim()
  if (!t) return false
  const lower = t.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  if (/^\s*(?:o\s+que|qual|quais|como|quando|onde|por\s*qu[eê]|porque|quem)\b/i.test(lower)) {
    return words.length >= 2
  }
  if (t.includes('?')) {
    return words.length >= 4 || t.length >= 24
  }
  return false
}

function pickReason(current: ConfidenceReason, next: ConfidenceReason): ConfidenceReason {
  const rank: Record<ConfidenceReason, number> = {
    insufficient_data: 4,
    ambiguous: 3,
    low_context: 2,
    high_match: 1,
  }
  return rank[next] > rank[current] ? next : current
}

export function calculateConfidence(
  parsedResponse: any,
  originalMessage: string,
  context?: Record<string, any>,
  historyLength: number = 0,
  hasFileContext: boolean = false,
  sources?: string[]
): AgentDecision {
  const threshold = getConfidenceApprovalThreshold()
  const adjustments: AdjustmentLog[] = []
  let reason: ConfidenceReason = 'high_match'

  const messageLength = parsedResponse.message?.length || 0
  const original = String(originalMessage ?? '').trim()
  const originalLength = original.length

  let confidence = 0.85

  const apply = (label: string, delta: number, note?: string, reasonHint?: ConfidenceReason) => {
    adjustments.push({ label, delta, note })
    confidence += delta
    if (reasonHint && delta < 0) {
      reason = pickReason(reason, reasonHint)
    }
  }

  const applyFloor = (min: number, label: string) => {
    if (confidence < min) {
      const delta = min - confidence
      adjustments.push({ label, delta, note: `piso ${(min * 100).toFixed(0)}%` })
      confidence = min
    }
  }

  // --- RAG: bônus e pisos (comportamento preservado) ---
  if (hasFileContext) {
    apply('rag_contexto_arquivos', 0.3)

    const responseMessage = (parsedResponse.message || '').toLowerCase()
    const responseLength = responseMessage.length
    const hasPhoneNumber = /\d{10,}/.test(responseMessage)
    const hasContactKeywords = /ligue|telefone|contato|suporte|numero|número|ligar|chamar/i.test(responseMessage)
    const hasSpecificData = /\d+/.test(responseMessage) && responseLength > 40
    const isDetailedResponse =
      responseLength > 50 && !/^(ok|sim|não|entendi|claro)$/i.test((parsedResponse.message || '').trim())
    const hasUsefulInfo =
      responseLength > 30 && !/^(ok|sim|não|entendi|claro|tudo bem)$/i.test((parsedResponse.message || '').trim())
    const isSubstantialResponse =
      responseLength > 40 &&
      !/^(ok|sim|não|entendi|claro|tudo bem|beleza)$/i.test((parsedResponse.message || '').trim())

    if ((hasPhoneNumber || (hasContactKeywords && hasSpecificData)) && isDetailedResponse) {
      apply('rag_resposta_alinhada_contexto', 0.5)
      applyFloor(0.85, 'rag_piso_forte')
      reason = 'high_match'
    } else if (hasContactKeywords && hasUsefulInfo) {
      apply('rag_mencao_contato_util', 0.35)
      applyFloor(0.75, 'rag_piso_contato')
      reason = pickReason(reason, 'high_match')
    } else if (isSubstantialResponse) {
      apply('rag_resposta_substancial', 0.25)
      applyFloor(0.7, 'rag_piso_substancial')
      reason = pickReason(reason, 'high_match')
    } else {
      applyFloor(0.65, 'rag_piso_base')
    }

    if (reason === 'low_context' || reason === 'ambiguous') {
      reason = 'high_match'
    }
  }

  // Mensagem vazia
  if (!originalLength) {
    apply('mensagem_original_vazia', -0.25, undefined, 'low_context')
  }

  // Tamanho da mensagem original
  if (originalLength > 0 && originalLength < 5) {
    apply('mensagem_muito_curta', hasFileContext ? -0.05 : -0.1, '< 5 chars', 'low_context')
  } else if (originalLength >= 5 && originalLength < 10) {
    apply('mensagem_curta', hasFileContext ? -0.03 : -0.06, '< 10 chars', 'low_context')
  } else if (originalLength >= 10 && originalLength < 20) {
    apply('mensagem_media_curta', hasFileContext ? -0.02 : -0.04, '< 20 chars', 'low_context')
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  }

  // Histórico
  if (historyLength === 0) {
    apply('sem_historico', hasFileContext ? -0.02 : -0.04, '0 msgs', 'low_context')
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  } else if (historyLength < 3) {
    apply('historico_curto', hasFileContext ? -0.01 : -0.02, '< 3 msgs', 'low_context')
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  }

  // Ambiguidade real (não usar "?" sozinho — pergunta clara não é ambiguidade)
  const userUncertain = USER_UNCERTAINTY_RE.test(original)
  if (userUncertain) {
    if (originalLength < 15) {
      apply('usuario_incerto_curto', hasFileContext ? -0.05 : -0.1, undefined, 'ambiguous')
    } else if (originalLength < 30) {
      apply('usuario_incerto_medio', hasFileContext ? -0.03 : -0.06, undefined, 'ambiguous')
    } else {
      apply('usuario_incerto_longo', hasFileContext ? -0.02 : -0.04, undefined, 'ambiguous')
    }
  }

  // Pergunta clara: compensa penalidades de "primeira mensagem" / texto médio
  if (originalLength > 0 && isClearQuestion(original) && !userUncertain) {
    apply('pergunta_clara', 0.08)
    if (reason === 'low_context' || reason === 'ambiguous') {
      reason = 'high_match'
    }
  }

  const veryGenericPatterns = /^(ok|sim|não|tudo bem|entendi|claro|beleza|tá|blz)$/i
  if (veryGenericPatterns.test(original)) {
    apply('mensagem_generica_usuario', hasFileContext ? -0.05 : -0.1, undefined, 'low_context')
    if (reason === 'high_match' && !hasFileContext) reason = 'low_context'
  }

  const interjectionPatterns = /^(ah|eh|hmm|hã|ops|eita|nossa|putz|caramba|😊|👍|👌|🤔|❓)$/i
  if (interjectionPatterns.test(original)) {
    apply('interjeicao_emoji', hasFileContext ? -0.06 : -0.12, undefined, 'low_context')
    if (!hasFileContext) reason = pickReason(reason, 'low_context')
  }

  const complexActions = ['send_email', 'send_whatsapp', 'crm_capture_lead']
  if (complexActions.includes(parsedResponse.action) && !context) {
    apply('acao_complexa_sem_contexto', hasFileContext ? -0.05 : -0.08, undefined, 'insufficient_data')
    if (!hasFileContext) reason = pickReason(reason, 'insufficient_data')
  }

  if (parsedResponse.message && /\{\{[^}]+\}\}/.test(parsedResponse.message)) {
    apply('placeholder_nao_substuido', -0.15, undefined, 'insufficient_data')
  }

  const genericResponsePatterns = /^(ok|entendi|claro|sim|não|tudo bem)$/i
  if (genericResponsePatterns.test((parsedResponse.message || '').trim())) {
    apply('resposta_agente_generica', -0.05, undefined, 'low_context')
    if (reason === 'high_match') reason = 'low_context'
  }

  if (originalLength > 200 && !original.includes('?') && !original.includes('!')) {
    apply('mensagem_longa_sem_pontuacao', -0.04, undefined, 'ambiguous')
    if (reason === 'high_match') reason = 'ambiguous'
  }

  confidence = Math.max(0, Math.min(1, confidence))

  const requiresApproval = confidence < threshold

  // Log alinhado aos ajustes reais (evita divergência visual vs score)
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🎯 [CONFIDENCE CALCULATOR] Cálculo de Confiança')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('📝 Mensagem Original:', original.substring(0, 100) || '(vazia)')
  console.log('📏 Tamanho da Mensagem Original:', originalLength, 'caracteres')
  console.log('💬 Resposta Gerada:', (parsedResponse.message || '').substring(0, 100) || '(vazia)')
  console.log('📏 Tamanho da Resposta:', messageLength, 'caracteres')
  console.log('📚 Histórico de Conversa:', historyLength, 'mensagens')
  console.log('🔧 Ação:', parsedResponse.action || 'nenhuma')
  console.log('📐 Limiar de aprovação:', (threshold * 100).toFixed(1) + '%', '(AGENT_CONFIDENCE_THRESHOLD)')
  console.log('')
  console.log('📊 AJUSTES (soma = variação sobre base 0.85):')
  for (const a of adjustments) {
    const sign = a.delta >= 0 ? '+' : ''
    const extra = a.note ? ` (${a.note})` : ''
    console.log(`  • ${a.label}: ${sign}${a.delta.toFixed(3)}${extra}`)
  }
  if (adjustments.length === 0) {
    console.log('  • (nenhum ajuste além da base)')
  }
  console.log('')
  console.log('🎯 SCORE FINAL:', (confidence * 100).toFixed(1) + '%')
  console.log('📌 Motivo:', reason)
  console.log(
    '🚦 Status:',
    requiresApproval ? '🛡️ BLOQUEADO (requer aprovação)' : '✅ APROVADO (envio automático)'
  )
  console.log('═══════════════════════════════════════════════════════════')

  return {
    answer: parsedResponse.message || '',
    confidence_score: confidence,
    reason,
    sources: sources || undefined,
    metadata: {
      message_length: messageLength,
      has_context: !!context,
      action_type: parsedResponse.action,
      requires_approval: requiresApproval,
    },
  }
}
