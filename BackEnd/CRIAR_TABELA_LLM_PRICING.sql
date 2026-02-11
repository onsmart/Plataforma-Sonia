-- ============================================
-- TABELA: tb_llm_pricing
-- Preços por provider/modelo
-- ============================================

CREATE TABLE IF NOT EXISTS public.tb_llm_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider e Modelo
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'groq', etc
  model TEXT NOT NULL, -- 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', etc
  
  -- Preços por 1K tokens
  input_price_per_1k NUMERIC(10,6) NOT NULL DEFAULT 0, -- Preço por 1K tokens de entrada (prompt)
  output_price_per_1k NUMERIC(10,6) NOT NULL DEFAULT 0, -- Preço por 1K tokens de saída (completion)
  
  -- Preço médio (para cálculo rápido quando não tiver input/output separado)
  avg_price_per_1k NUMERIC(10,6) NOT NULL DEFAULT 0, -- Preço médio por 1K tokens
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: um modelo por provider
  CONSTRAINT unique_provider_model UNIQUE (provider, model)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_llm_pricing_provider_model 
ON public.tb_llm_pricing(provider, model) 
WHERE is_active = true;

-- Inserir preços padrão (valores aproximados de 2024/2025)
INSERT INTO public.tb_llm_pricing (provider, model, input_price_per_1k, output_price_per_1k, avg_price_per_1k)
VALUES 
  -- OpenAI
  ('openai', 'gpt-4o', 0.005, 0.015, 0.01),
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 0.000375),
  ('openai', 'gpt-4', 0.03, 0.06, 0.045),
  ('openai', 'gpt-4-turbo', 0.01, 0.03, 0.02),
  ('openai', 'gpt-3.5-turbo', 0.0005, 0.0015, 0.001),
  
  -- Anthropic
  ('anthropic', 'claude-3-5-sonnet', 0.003, 0.015, 0.009),
  ('anthropic', 'claude-3-opus', 0.015, 0.075, 0.045),
  ('anthropic', 'claude-3-sonnet', 0.003, 0.015, 0.009),
  ('anthropic', 'claude-3-haiku', 0.00025, 0.00125, 0.00075),
  
  -- Groq
  ('groq', 'llama-3.1-70b', 0.00059, 0.00079, 0.00069),
  ('groq', 'llama-3.1-8b', 0.00005, 0.00008, 0.000065),
  ('groq', 'mixtral-8x7b', 0.00024, 0.00024, 0.00024)
ON CONFLICT (provider, model) DO NOTHING;

-- Comentários
COMMENT ON TABLE public.tb_llm_pricing IS 'Tabela de preços por provider/modelo para cálculo de custos';
COMMENT ON COLUMN public.tb_llm_pricing.input_price_per_1k IS 'Preço por 1.000 tokens de entrada (prompt) em dólares';
COMMENT ON COLUMN public.tb_llm_pricing.output_price_per_1k IS 'Preço por 1.000 tokens de saída (completion) em dólares';
COMMENT ON COLUMN public.tb_llm_pricing.avg_price_per_1k IS 'Preço médio por 1.000 tokens (usado quando não tem input/output separado) em dólares';
