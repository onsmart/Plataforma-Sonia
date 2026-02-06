export interface AgentDecision {
  answer: string                    // Resposta gerada
  confidence_score: number          // 0-1 (0.7 = threshold)
  reason: string                    // "low_context" | "ambiguous" | "high_match" | "insufficient_data"
  sources?: string[]                // IDs de documentos RAG (quando houver)
  metadata?: {
    message_length?: number
    has_context?: boolean
    action_type?: string
    requires_approval?: boolean
  }
}

export interface AgentResponse {
  decision: AgentDecision
  should_block: boolean            // true se confidence < 0.7
  original_parsed?: any            // Dados originais do parse
}
