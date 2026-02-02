-- ============================================
-- SCRIPT: Criar tabelas de CRM e popular dados iniciais
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- 
-- Este script cria todas as tabelas necessárias para integração de CRMs
-- e popula a tabela tb_crms com CRMs iniciais
--
-- ============================================

-- ============================================
-- TABELA: tb_crms
-- Catálogo de CRMs disponíveis no sistema
-- ============================================
CREATE TABLE IF NOT EXISTS tb_crms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- hubspot, pipedrive, api_propria
  name TEXT NOT NULL,                     -- HubSpot, Pipedrive, API Própria
  type TEXT NOT NULL CHECK (type IN ('oauth', 'api_key', 'webhook')), -- tipo de autenticação
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crms_slug ON tb_crms(slug);
CREATE INDEX IF NOT EXISTS idx_crms_active ON tb_crms(is_active) WHERE is_active = true;

-- ============================================
-- TABELA: tb_crm_integrations
-- Integrações de CRM por usuário
-- ============================================
CREATE TABLE IF NOT EXISTS tb_crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tb_users(id) ON DELETE CASCADE,
  crm_id UUID NOT NULL REFERENCES tb_crms(id) ON DELETE CASCADE,

  -- Credenciais (dependendo do tipo)
  api_key TEXT,                           -- Para type = 'api_key'
  access_token TEXT,                      -- Para type = 'oauth'
  refresh_token TEXT,                     -- Para type = 'oauth'
  expires_at TIMESTAMP WITH TIME ZONE,    -- Para type = 'oauth'

  -- Configurações extras
  config JSONB DEFAULT '{}',              -- Configs específicas do CRM

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_crm UNIQUE (user_id, crm_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_integrations_user ON tb_crm_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_crm ON tb_crm_integrations(crm_id);
CREATE INDEX IF NOT EXISTS idx_crm_integrations_active ON tb_crm_integrations(is_active) WHERE is_active = true;

-- ============================================
-- TABELA: tb_crm_events
-- Eventos recebidos dos CRMs (formato original)
-- ============================================
CREATE TABLE IF NOT EXISTS tb_crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tb_crm_integration_id UUID NOT NULL REFERENCES tb_crm_integrations(id) ON DELETE CASCADE,

  -- Dados do evento original
  external_event_type TEXT NOT NULL,      -- ex: contact.creation, deal.updated
  external_event_id TEXT,                  -- ID do evento no CRM externo
  payload JSONB NOT NULL,                  -- JSON ORIGINAL do evento

  -- Status de processamento
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_external_event UNIQUE (tb_crm_integration_id, external_event_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_events_integration ON tb_crm_events(tb_crm_integration_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_type ON tb_crm_events(external_event_type);
CREATE INDEX IF NOT EXISTS idx_crm_events_processed ON tb_crm_events(processed, received_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_crm_events_received ON tb_crm_events(received_at DESC);

-- ============================================
-- TABELA: tb_events_canonical
-- Eventos normalizados (formato canônico)
-- ============================================
CREATE TABLE IF NOT EXISTS tb_events_canonical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tb_crm_event_id UUID REFERENCES tb_crm_events(id) ON DELETE SET NULL,

  -- Tipo e entidade canônica
  event_type TEXT NOT NULL,               -- lead.created, deal.updated, message.received
  entity_type TEXT,                        -- lead, deal, contact, message
  entity_id TEXT,                          -- ID normalizado da entidade

  -- Dados normalizados
  data JSONB NOT NULL,                     -- JSON CANÔNICO normalizado
  occurred_at TIMESTAMP WITH TIME ZONE,   -- Quando ocorreu no mundo real (do payload original)

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_events_canonical_type ON tb_events_canonical(event_type);
CREATE INDEX IF NOT EXISTS idx_events_canonical_entity ON tb_events_canonical(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_canonical_occurred ON tb_events_canonical(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_canonical_crm_event ON tb_events_canonical(tb_crm_event_id) WHERE tb_crm_event_id IS NOT NULL;

-- ============================================
-- TABELA: tb_crm_event_mappings
-- Mapeamento de eventos externos para canônicos
-- ============================================
CREATE TABLE IF NOT EXISTS tb_crm_event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_id UUID NOT NULL REFERENCES tb_crms(id) ON DELETE CASCADE,

  -- Mapeamento
  external_event_type TEXT NOT NULL,      -- ex: contact.creation, deal.updated
  canonical_event_type TEXT NOT NULL,     -- lead.created, deal.updated

  -- Regras de transformação
  mapping JSONB NOT NULL DEFAULT '{}',    -- Regras de transformação do payload

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_crm_event_mapping UNIQUE (crm_id, external_event_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_mappings_crm ON tb_crm_event_mappings(crm_id);
CREATE INDEX IF NOT EXISTS idx_crm_mappings_external ON tb_crm_event_mappings(external_event_type);
CREATE INDEX IF NOT EXISTS idx_crm_mappings_canonical ON tb_crm_event_mappings(canonical_event_type);

-- ============================================
-- TRIGGERS PARA updated_at AUTOMÁTICO
-- ============================================
CREATE OR REPLACE FUNCTION update_crms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_crm_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_crm_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
DROP TRIGGER IF EXISTS trigger_update_crms_updated_at ON tb_crms;
CREATE TRIGGER trigger_update_crms_updated_at
  BEFORE UPDATE ON tb_crms
  FOR EACH ROW
  EXECUTE FUNCTION update_crms_updated_at();

DROP TRIGGER IF EXISTS trigger_update_crm_integrations_updated_at ON tb_crm_integrations;
CREATE TRIGGER trigger_update_crm_integrations_updated_at
  BEFORE UPDATE ON tb_crm_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_integrations_updated_at();

DROP TRIGGER IF EXISTS trigger_update_crm_mappings_updated_at ON tb_crm_event_mappings;
CREATE TRIGGER trigger_update_crm_mappings_updated_at
  BEFORE UPDATE ON tb_crm_event_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_crm_mappings_updated_at();

-- ============================================
-- POPULAR TABELA tb_crms COM CRMs INICIAIS
-- ============================================
INSERT INTO tb_crms (slug, name, type, description, is_active) VALUES
  ('hubspot', 'HubSpot', 'api_key', 'Plataforma de CRM e marketing com API completa para gerenciar contatos, empresas, negócios e muito mais.', true),
  ('pipedrive', 'Pipedrive', 'api_key', 'CRM focado em vendas com API para gerenciar pipelines, negócios e atividades.', true),
  ('salesforce', 'Salesforce', 'oauth', 'Plataforma líder de CRM com autenticação OAuth para acesso seguro aos dados.', true),
  ('zoho', 'Zoho CRM', 'api_key', 'CRM completo com API para gerenciar leads, contas, negócios e relatórios.', true),
  ('api_propria', 'API Própria', 'api_key', 'Conecte sua própria API personalizada usando chave de API.', true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- ADICIONAR CAMPO crm_integration_id EM tb_agents
-- ============================================
ALTER TABLE tb_agents 
ADD COLUMN IF NOT EXISTS crm_integration_id UUID REFERENCES tb_crm_integrations(id) ON DELETE SET NULL;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_agents_crm_integration ON tb_agents(crm_integration_id) WHERE crm_integration_id IS NOT NULL;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute para verificar se as tabelas foram criadas:
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('tb_crms', 'tb_crm_integrations', 'tb_crm_events', 'tb_events_canonical', 'tb_crm_event_mappings')
ORDER BY table_name, ordinal_position;

-- Verificar CRMs criados
SELECT id, slug, name, type, is_active FROM tb_crms ORDER BY name;
