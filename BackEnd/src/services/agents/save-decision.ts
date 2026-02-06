import { supabase } from '../../lib/supabase'
import { AgentDecision } from './agent-response.types'

export async function saveBlockedDecision(
  agentId: string,
  userId: string,
  originalMessage: string,
  decision: AgentDecision,
  context?: Record<string, any>,
  channel?: string,
  integrationsId?: string,
  contactId?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    console.log('[saveBlockedDecision] Salvando decisão bloqueada:', {
      agentId,
      userId,
      confidence: decision.confidence_score,
      reason: decision.reason,
      channel
    })
    
    const { data, error } = await supabase
      .from('tb_agent_decisions')
      .insert({
        agent_id: agentId,
        user_id: userId,
        original_message: originalMessage,
        answer: decision.answer,
        confidence_score: decision.confidence_score,
        reason: decision.reason,
        sources: decision.sources || null,
        status: 'pending_approval',
        metadata: decision.metadata || {},
        context: context || {},
        channel: channel,
        integrations_id: integrationsId,
        contact_id: contactId
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('[saveBlockedDecision] ❌ Erro ao salvar:', error)
      console.error('[saveBlockedDecision] Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return { success: false, error: error.message }
    }
    
    console.log('[saveBlockedDecision] ✅ Decisão salva com sucesso!')
    console.log('[saveBlockedDecision] ID da decisão:', data.id)
    console.log('[saveBlockedDecision] Dados salvos:', {
      agent_id: agentId,
      user_id: userId,
      status: 'pending_approval',
      confidence: decision.confidence_score,
      reason: decision.reason,
      channel: channel || 'webchat'
    })
    return { success: true, id: data.id }
  } catch (err: any) {
    console.error('[saveBlockedDecision] Erro:', err)
    return { success: false, error: err.message }
  }
}
