-- ============================================
-- VERIFICAR E CORRIGIR PHONE_NUMBER
-- ============================================
-- 
-- Execute este script no Supabase SQL Editor
-- Ele vai mostrar o phone_number atual e permitir corrigir
--
-- ============================================

-- 1. Verificar integrações WhatsApp existentes
SELECT 
  id,
  phone_number,
  provider,
  created_at,
  CASE 
    WHEN phone_number = '11943687794' THEN '✅ CORRETO (corresponde ao instanceName)'
    WHEN phone_number IS NULL THEN '❌ VAZIO'
    ELSE '⚠️ DIFERENTE - Precisa atualizar para: 11943687794'
  END as status
FROM tb_integrations
WHERE provider = 'whatsapp'
ORDER BY created_at DESC;

-- ============================================
-- 2. ATUALIZAR phone_number (se necessário)
-- ============================================
-- Descomente e execute se o phone_number estiver diferente:

/*
UPDATE tb_integrations
SET 
  phone_number = '11943687794',  -- InstanceName da Evolution API
  updated_at = NOW()
WHERE provider = 'whatsapp'
  AND (phone_number != '11943687794' OR phone_number IS NULL)
RETURNING id, phone_number, '✅ Atualizado!' as status;
*/

-- ============================================
-- 3. Verificar se há mensagens salvas
-- ============================================
SELECT 
  COUNT(*) as total_mensagens,
  COUNT(*) FILTER (WHERE direction = 'inbound') as recebidas,
  COUNT(*) FILTER (WHERE direction = 'outbound') as enviadas,
  COUNT(*) FILTER (WHERE is_read = false) as nao_lidas
FROM tb_whatsapp_messages
WHERE integrations_id IN (
  SELECT id FROM tb_integrations WHERE provider = 'whatsapp'
);

-- ============================================
-- 4. Ver últimas mensagens (se houver)
-- ============================================
SELECT 
  phone_number,
  message,
  direction,
  is_read,
  created_at
FROM tb_whatsapp_messages
WHERE integrations_id IN (
  SELECT id FROM tb_integrations WHERE provider = 'whatsapp'
)
ORDER BY created_at DESC
LIMIT 10;
