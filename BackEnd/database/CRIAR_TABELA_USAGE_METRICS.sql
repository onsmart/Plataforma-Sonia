-- ============================================
-- TABELA: tb_usage_metrics
-- Descrição: Armazena métricas de uso mensal por empresa (cache para billing)
-- ============================================

CREATE TABLE IF NOT EXISTS tb_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    companies_id UUID NOT NULL REFERENCES tb_companies(id) ON DELETE CASCADE,
    
    -- Período mensal (início do mês)
    month_start DATE NOT NULL,
    
    -- Contadores de uso
    message_count INTEGER DEFAULT 0 NOT NULL,
    agent_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: uma única métrica por empresa por mês
    UNIQUE(companies_id, month_start)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_usage_metrics_companies_id ON tb_usage_metrics(companies_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_month_start ON tb_usage_metrics(month_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_companies_month ON tb_usage_metrics(companies_id, month_start DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_usage_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_usage_metrics_updated_at ON tb_usage_metrics;
CREATE TRIGGER trigger_update_usage_metrics_updated_at
    BEFORE UPDATE ON tb_usage_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_usage_metrics_updated_at();

-- Comentários
COMMENT ON TABLE tb_usage_metrics IS 'Armazena métricas de uso mensal por empresa para controle de billing e limites de planos';
COMMENT ON COLUMN tb_usage_metrics.month_start IS 'Data de início do mês (ex: 2026-03-01)';
COMMENT ON COLUMN tb_usage_metrics.message_count IS 'Número de mensagens enviadas no mês';
COMMENT ON COLUMN tb_usage_metrics.agent_count IS 'Número de agentes ativos no mês';
