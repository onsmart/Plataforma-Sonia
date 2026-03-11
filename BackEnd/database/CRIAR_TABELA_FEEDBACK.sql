-- ============================================
-- TABELA: tb_feedback
-- Descrição: Armazena feedback de usuários (CSAT, NPS, Sentimento)
-- ============================================

CREATE TABLE IF NOT EXISTS tb_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companies_id UUID REFERENCES tb_companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES tb_users(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES tb_agents(id) ON DELETE SET NULL,
    conversation_id UUID, -- ID da conversa (pode ser de diferentes tabelas)
    channel VARCHAR(50), -- 'whatsapp', 'webchat', 'sms', etc.
    
    -- Métricas de Feedback
    csat_score INTEGER CHECK (csat_score >= 1 AND csat_score <= 5), -- Customer Satisfaction (1-5)
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10), -- Net Promoter Score (0-10)
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0), -- -1 (negativo) a 1 (positivo)
    
    -- Feedback textual opcional
    feedback_text TEXT,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_feedback_companies_id ON tb_feedback(companies_id);
CREATE INDEX IF NOT EXISTS idx_feedback_agent_id ON tb_feedback(agent_id);
CREATE INDEX IF NOT EXISTS idx_feedback_conversation_id ON tb_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON tb_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_channel ON tb_feedback(channel);

-- Comentários
COMMENT ON TABLE tb_feedback IS 'Armazena feedback de usuários sobre interações com agentes';
COMMENT ON COLUMN tb_feedback.csat_score IS 'Customer Satisfaction Score (1-5 estrelas)';
COMMENT ON COLUMN tb_feedback.nps_score IS 'Net Promoter Score (0-10, probabilidade de recomendar)';
COMMENT ON COLUMN tb_feedback.sentiment_score IS 'Análise de sentimento (-1 negativo a 1 positivo)';
