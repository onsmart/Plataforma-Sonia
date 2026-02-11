-- ============================================
-- TABELA: tb_agent_token_usage
-- Rastreia uso de tokens por agente e usuário
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- 
-- Esta tabela permite:
-- - Rastrear tokens usados por agente
-- - Rastrear tokens usados por usuário/contato
-- - Calcular custos estimados
-- - Analisar performance de uso de tokens
--
-- ============================================

-- Criar tabela
CREATE TABLE IF NOT EXISTS public.tb_agent_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Multi-tenant
  companies_id UUID NOT NULL,
  
  -- Identificação
  agent_id UUID NOT NULL REFERENCES tb_agents(id) ON DELETE CASCADE,
  user_id TEXT, -- ID do usuário/contato (phone_number, session_id, etc)
  conversation_id UUID, -- ID da conversa (se aplicável)
  
  -- Dados de uso
  input_tokens INTEGER NOT NULL DEFAULT 0, -- Tokens de entrada (prompt)
  output_tokens INTEGER NOT NULL DEFAULT 0, -- Tokens de saída (completion)
  total_tokens INTEGER NOT NULL DEFAULT 0, -- Total de tokens
  
  -- Modelo usado
  model TEXT, -- Ex: gpt-4o, claude-3-5-sonnet, etc
  provider TEXT, -- Ex: openai, anthropic, groq, etc
  
  -- Metadados
  metadata JSONB DEFAULT '{}', -- Dados adicionais (ex: channel, message_id, etc)
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice para buscar por companies_id (multi-tenant)
CREATE INDEX IF NOT EXISTS idx_token_usage_companies_id 
ON public.tb_agent_token_usage(companies_id);

-- Índice para buscar por agente
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_id 
ON public.tb_agent_token_usage(agent_id);

-- Índice para buscar por data (analytics)
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at 
ON public.tb_agent_token_usage(created_at DESC);

-- Índice composto para analytics por agente e data
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_date 
ON public.tb_agent_token_usage(agent_id, created_at DESC);

-- Índice composto para analytics por companies_id e data
CREATE INDEX IF NOT EXISTS idx_token_usage_company_date 
ON public.tb_agent_token_usage(companies_id, created_at DESC);

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE public.tb_agent_token_usage IS 'Rastreia uso de tokens por agente e usuário para analytics e billing';
COMMENT ON COLUMN public.tb_agent_token_usage.user_id IS 'ID do usuário/contato (phone_number, session_id, etc)';
COMMENT ON COLUMN public.tb_agent_token_usage.input_tokens IS 'Tokens de entrada (prompt/system)';
COMMENT ON COLUMN public.tb_agent_token_usage.output_tokens IS 'Tokens de saída (completion)';
COMMENT ON COLUMN public.tb_agent_token_usage.total_tokens IS 'Total de tokens (input + output)';
COMMENT ON COLUMN public.tb_agent_token_usage.model IS 'Modelo usado (ex: gpt-4o)';
COMMENT ON COLUMN public.tb_agent_token_usage.provider IS 'Provider usado (ex: openai, anthropic)';
