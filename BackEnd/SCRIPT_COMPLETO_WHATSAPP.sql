-- ============================================
-- SCRIPT COMPLETO: Configurar WhatsApp
-- Email: carlos.dias@gmail.com
-- Número: 11943687794 (5511943687794)
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- Ele cria a integração e lista os agentes disponíveis
--
-- ============================================

-- ============================================
-- PASSO 1: Criar Integração WhatsApp
-- ============================================
WITH user_data AS (
  SELECT id as user_id, email
  FROM tb_users
  WHERE email = 'carlos.dias@gmail.com'
),
nova_integracao AS (
  INSERT INTO tb_integrations (
    user_id,
    phone_number,
    provider,
    created_at,
    updated_at
  )
  SELECT 
    user_id,
    '5511943687794',                -- Número: 11943687794 (formato: 55 + 11 + 943687794)
    'whatsapp',
    NOW(),
    NOW()
  FROM user_data
  WHERE NOT EXISTS (
    SELECT 1 FROM tb_integrations 
    WHERE phone_number = '5511943687794' 
    AND user_id = (SELECT user_id FROM user_data)
  )
  RETURNING id, user_id, phone_number
)
SELECT 
  id as integration_id,
  user_id,
  phone_number,
  '✅ Integração criada com sucesso!' as status
FROM nova_integracao

UNION ALL

-- Se já existe, retorna a existente
SELECT 
  i.id as integration_id,
  i.user_id,
  i.phone_number,
  'ℹ️ Integração já existe' as status
FROM tb_integrations i
INNER JOIN tb_users u ON u.id = i.user_id
WHERE u.email = 'carlos.dias@gmail.com'
  AND i.phone_number = '5511943687794';

-- ============================================
-- PASSO 2: Listar Agentes do Usuário
-- ============================================
SELECT 
  a.id as agent_id,
  a.nome as agent_name,
  a.integrations_id as current_integration_id,
  CASE 
    WHEN a.integrations_id IS NOT NULL THEN '✅ Já tem integração'
    ELSE '❌ Sem integração'
  END as status,
  a.created_at
FROM tb_agents a
WHERE EXISTS (
  SELECT 1 FROM tb_users u 
  WHERE u.email = 'carlos.dias@gmail.com'
)
ORDER BY a.created_at DESC;

-- ============================================
-- PASSO 3: Associar Integração ao Agente
-- ============================================
-- Descomente e substitua os IDs pelos valores retornados acima:
/*
UPDATE tb_agents
SET 
  integrations_id = (
    SELECT id FROM tb_integrations i
    INNER JOIN tb_users u ON u.id = i.user_id
    WHERE u.email = 'carlos.dias@gmail.com'
      AND i.phone_number = '5511943687794'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE id = 'AGENT_ID_AQUI'  -- ⚠️ Substitua pelo agent_id do PASSO 2
  AND EXISTS (
    SELECT 1 FROM tb_users u 
    WHERE u.email = 'carlos.dias@gmail.com'
  )
RETURNING id, nome, integrations_id;
*/

-- ============================================
-- PASSO 4: Verificar Configuração Final
-- ============================================
SELECT 
  a.id as agent_id,
  a.nome as agent_name,
  i.id as integration_id,
  i.phone_number,
  u.email as user_email,
  CASE 
    WHEN i.phone_number = '5511943687794' THEN '✅ Configurado corretamente'
    ELSE '⚠️ Verificar configuração'
  END as status
FROM tb_agents a
LEFT JOIN tb_integrations i ON i.id = a.integrations_id
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE u.email = 'carlos.dias@gmail.com'
ORDER BY a.created_at DESC;
