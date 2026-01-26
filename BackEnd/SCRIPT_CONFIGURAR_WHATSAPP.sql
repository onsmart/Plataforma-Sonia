-- ============================================
-- SCRIPT: Configurar WhatsApp para número 11943687794
-- Email: carlos.dias@gmail.com
-- ============================================
-- 
-- INSTRUÇÕES:
-- 1. Execute este script completo no Supabase SQL Editor
-- 2. Anote o integration_id retornado
-- 3. Use o integration_id para associar ao agente (veja PASSO 3)
--
-- ============================================

-- PASSO 1: Criar a integração WhatsApp (busca user_id automaticamente pelo email)
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
    '5511943687794',                -- Número formatado: DDI (55) + DDD (11) + número (943687794)
    'whatsapp',
    NOW(),
    NOW()
  FROM user_data
  RETURNING id, user_id, phone_number
)
SELECT 
  id as integration_id,
  user_id,
  phone_number,
  'Integração criada com sucesso!' as mensagem
FROM nova_integracao;

-- PASSO 2: Verificar integrações criadas
SELECT 
  i.id as integration_id,
  i.phone_number,
  i.provider,
  u.email as user_email,
  i.created_at
FROM tb_integrations i
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE u.email = 'carlos.dias@gmail.com'
  AND i.phone_number = '5511943687794'
ORDER BY i.created_at DESC;

-- PASSO 3: Listar agentes do usuário (para escolher qual associar)
SELECT 
  a.id as agent_id,
  a.nome as agent_name,
  a.integrations_id,
  a.created_at
FROM tb_agents a
INNER JOIN tb_users u ON u.id = (SELECT user_id FROM tb_integrations WHERE id = a.integrations_id LIMIT 1)
  OR EXISTS (
    SELECT 1 FROM tb_users u2 
    WHERE u2.email = 'carlos.dias@gmail.com'
  )
ORDER BY a.created_at DESC;

-- PASSO 4: Associar integração a um agente
-- (Execute após obter o integration_id do PASSO 1 e agent_id do PASSO 3)
-- Descomente e substitua os IDs:
/*
UPDATE tb_agents
SET 
  integrations_id = 'INTEGRATION_ID_DO_PASSO_1',  -- ⚠️ Substitua pelo id retornado no PASSO 1
  updated_at = NOW()
WHERE id = 'AGENT_ID_DO_PASSO_3';  -- ⚠️ Substitua pelo ID do agente do PASSO 3
*/

-- PASSO 5: Verificar agentes com WhatsApp configurado
SELECT 
  a.id as agent_id,
  a.nome as agent_name,
  a.integrations_id,
  i.phone_number,
  i.provider,
  u.email as user_email
FROM tb_agents a
LEFT JOIN tb_integrations i ON i.id = a.integrations_id
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE i.phone_number = '5511943687794'
  AND u.email = 'carlos.dias@gmail.com'
ORDER BY a.created_at DESC;
