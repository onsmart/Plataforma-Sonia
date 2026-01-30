-- ============================================
-- TABELA: tb_whatsapp_conversations
-- Gerencia conversas com LID e números reais
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- 
-- Esta tabela permite:
-- - Salvar conversas que chegam com @lid
-- - Vincular LID ao número real quando disponível
-- - Processar mensagens pendentes quando número aparecer
--
-- ============================================

-- Criar tabela
CREATE TABLE IF NOT EXISTS tb_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  lid TEXT,                              -- ID temporário do WhatsApp (ex: 171077204488320@lid)
  phone_number TEXT,                      -- Número real (ex: 5511999xxxx@s.whatsapp.net)
  integrations_id UUID NOT NULL REFERENCES tb_integrations(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_lid_per_integration UNIQUE (lid, integrations_id),
  CONSTRAINT unique_phone_per_integration UNIQUE (phone_number, integrations_id),
  CONSTRAINT has_identifier CHECK (lid IS NOT NULL OR phone_number IS NOT NULL)
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índice para buscar conversas pendentes (worker)
CREATE INDEX IF NOT EXISTS idx_conversations_pending 
ON tb_whatsapp_conversations(status, created_at) 
WHERE status = 'pending';

-- Índice para buscar por LID
CREATE INDEX IF NOT EXISTS idx_conversations_lid 
ON tb_whatsapp_conversations(lid) 
WHERE lid IS NOT NULL;

-- Índice para buscar por número real
CREATE INDEX IF NOT EXISTS idx_conversations_phone 
ON tb_whatsapp_conversations(phone_number) 
WHERE phone_number IS NOT NULL;

-- Índice para buscar por integração
CREATE INDEX IF NOT EXISTS idx_conversations_integration 
ON tb_whatsapp_conversations(integrations_id);

-- Índice composto para buscar conversas prontas por integração
CREATE INDEX IF NOT EXISTS idx_conversations_ready 
ON tb_whatsapp_conversations(integrations_id, status, updated_at DESC) 
WHERE status = 'ready';

-- ============================================
-- FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================
CREATE OR REPLACE FUNCTION update_whatsapp_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_whatsapp_conversations_updated_at ON tb_whatsapp_conversations;
CREATE TRIGGER trigger_update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON tb_whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_conversations_updated_at();

-- ============================================
-- ADICIONAR CAMPO conversation_id EM tb_whatsapp_messages
-- ============================================
-- Adiciona referência à conversa nas mensagens
ALTER TABLE tb_whatsapp_messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES tb_whatsapp_conversations(id) ON DELETE SET NULL;

-- Índice para buscar mensagens por conversa
CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON tb_whatsapp_messages(conversation_id) 
WHERE conversation_id IS NOT NULL;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute para verificar se a tabela foi criada:
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tb_whatsapp_conversations'
ORDER BY ordinal_position;
