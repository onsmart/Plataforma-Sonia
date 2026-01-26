-- ============================================
-- EXEMPLO: Criar Integração WhatsApp
-- ============================================
-- 
-- IMPORTANTE: Configure primeiro o arquivo .env com:
--   EVOLUTION_API_URL=http://localhost:8080
--   EVOLUTION_API_KEY=sua-api-key-evolution
--
-- Substitua os valores abaixo pelos seus dados:
-- - 'SEU_USER_ID': ID do usuário na tabela tb_users
-- - '5511999999999': Seu número de telefone (formato: DDI + DDD + número)
--
-- ============================================

-- 1. Criar a integração (apenas phone_number, configurações vêm do .env)
INSERT INTO tb_integrations (
  user_id,
  phone_number,
  provider,
  created_at,
  updated_at
) VALUES (
  'SEU_USER_ID',                    -- Substitua pelo ID do usuário
  '5511999999999',                  -- Número de telefone (sem caracteres especiais)
  'whatsapp',                       -- Provider (opcional)
  NOW(),
  NOW()
) RETURNING id;

-- 2. Anote o ID retornado acima e use para associar ao agente:
-- UPDATE tb_agents 
-- SET integrations_id = 'ID_RETORNADO_ACIMA'
-- WHERE id = 'ID_DO_AGENTE';

-- ============================================
-- EXEMPLO COMPLETO COM SELECT
-- ============================================

-- Criar integração e retornar o ID
-- (Configurações da Evolution API vêm do .env, não do banco)
WITH nova_integracao AS (
  INSERT INTO tb_integrations (
    user_id,
    phone_number,
    provider,
    created_at,
    updated_at
  )
  SELECT 
    u.id,                           -- Pega o user_id pelo email
    '5511999999999',                -- Número de telefone
    'whatsapp',                     -- Provider (opcional)
    NOW(),
    NOW()
  FROM tb_users u
  WHERE u.email = 'seu-email@exemplo.com'  -- Substitua pelo email do usuário
  RETURNING id
)
SELECT id as integration_id FROM nova_integracao;

-- ============================================
-- VERIFICAR INTEGRAÇÕES EXISTENTES
-- ============================================

SELECT 
  i.id,
  i.user_id,
  i.phone_number,
  i.smtp_host,
  i.provider,
  i.created_at,
  u.email as user_email
FROM tb_integrations i
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE i.phone_number IS NOT NULL
ORDER BY i.created_at DESC;

-- ============================================
-- ATUALIZAR INTEGRAÇÃO EXISTENTE
-- ============================================
-- (Para mudar URL/API Key, edite o arquivo .env)

UPDATE tb_integrations
SET 
  phone_number = '5511999999999',      -- Novo número
  updated_at = NOW()
WHERE id = 'ID_DA_INTEGRACAO';

-- ============================================
-- ASSOCIAR INTEGRAÇÃO A UM AGENTE
-- ============================================

UPDATE tb_agents
SET 
  integrations_id = 'ID_DA_INTEGRACAO',
  updated_at = NOW()
WHERE id = 'ID_DO_AGENTE';

-- ============================================
-- VERIFICAR AGENTES COM INTEGRAÇÃO WHATSAPP
-- ============================================

SELECT 
  a.id as agent_id,
  a.nome as agent_name,
  a.integrations_id,
  i.phone_number,
  i.provider
FROM tb_agents a
LEFT JOIN tb_integrations i ON i.id = a.integrations_id
WHERE i.phone_number IS NOT NULL
ORDER BY a.created_at DESC;

-- Nota: EVOLUTION_API_URL e EVOLUTION_API_KEY estão no arquivo .env
