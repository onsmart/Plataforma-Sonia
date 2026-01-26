-- ============================================
-- TABELA: tb_whatsapp_messages
-- Armazena histórico de mensagens do WhatsApp
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- 
-- Estrutura:
-- - Uma linha por mensagem (inbound ou outbound)
-- - Índices otimizados para buscas rápidas
-- - Suporta milhões de mensagens sem travar
--
-- ============================================

-- Criar tabela
CREATE TABLE IF NOT EXISTS tb_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  phone_number TEXT NOT NULL,              -- Número do remetente/destinatário (formato: 5511999999999)
  integrations_id UUID REFERENCES tb_integrations(id) ON DELETE CASCADE,
  
  -- Mensagem
  message TEXT NOT NULL,                   -- Conteúdo da mensagem
  message_id TEXT,                          -- ID da mensagem na Evolution API (opcional)
  
  -- Direção
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')), -- 'inbound' = recebida, 'outbound' = enviada
  
  -- Metadados
  agent_id UUID REFERENCES tb_agents(id) ON DELETE SET NULL, -- Agente que processou/respondeu (se aplicável)
  is_read BOOLEAN DEFAULT false,            -- Se a mensagem foi lida/processada
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
-- Esses índices garantem buscas rápidas mesmo com milhões de mensagens

-- Índice para buscar mensagens por número de telefone (mais usado)
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_number 
ON tb_whatsapp_messages(phone_number);

-- Índice para buscar mensagens por data (ordenar por mais recente)
CREATE INDEX IF NOT EXISTS idx_whatsapp_created_at 
ON tb_whatsapp_messages(created_at DESC);

-- Índice composto para buscar mensagens não lidas de um número específico (usando timestamp)
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_unread 
ON tb_whatsapp_messages(phone_number, created_at DESC) 
WHERE is_read = false;

-- Índice composto para buscar por agente e número (busca histórica)
CREATE INDEX IF NOT EXISTS idx_whatsapp_agent_phone 
ON tb_whatsapp_messages(agent_id, phone_number, created_at DESC) 
WHERE agent_id IS NOT NULL;

-- Índice para buscar por integração
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations 
ON tb_whatsapp_messages(integrations_id);

-- Índice para buscar por agente
CREATE INDEX IF NOT EXISTS idx_whatsapp_agent 
ON tb_whatsapp_messages(agent_id) 
WHERE agent_id IS NOT NULL;

-- ============================================
-- FUNÇÃO PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================
CREATE OR REPLACE FUNCTION update_whatsapp_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS trigger_update_whatsapp_messages_updated_at ON tb_whatsapp_messages;
CREATE TRIGGER trigger_update_whatsapp_messages_updated_at
  BEFORE UPDATE ON tb_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_messages_updated_at();

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
WHERE table_name = 'tb_whatsapp_messages'
ORDER BY ordinal_position;

-- ============================================
-- EXEMPLO DE CONSULTAS ÚTEIS
-- ============================================

-- Buscar últimas 10 mensagens de um número
-- SELECT * FROM tb_whatsapp_messages 
-- WHERE phone_number = '5511999999999' 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Buscar mensagens não lidas
-- SELECT * FROM tb_whatsapp_messages 
-- WHERE is_read = false 
-- ORDER BY created_at DESC;

-- Buscar mensagens das últimas 24h de um número
-- SELECT * FROM tb_whatsapp_messages 
-- WHERE phone_number = '5511999999999' 
--   AND created_at >= NOW() - INTERVAL '24 hours'
-- ORDER BY created_at ASC;

-- Buscar histórico por agente e número (exemplo de uso)
-- SELECT * FROM tb_whatsapp_messages 
-- WHERE agent_id = 'ID_DO_AGENTE'
--   AND phone_number = '5511999999999'
-- ORDER BY created_at DESC 
-- LIMIT 20;

-- Buscar mensagens não lidas após um timestamp específico
-- SELECT * FROM tb_whatsapp_messages 
-- WHERE phone_number = '5511999999999'
--   AND is_read = false
--   AND created_at >= '2024-01-01 00:00:00'::timestamp
-- ORDER BY created_at ASC;
