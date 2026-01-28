-- ============================================
-- CRIAR INTEGRAÇÃO WHATSAPP
-- ============================================
-- Execute este SQL no Supabase para criar a integração
-- ============================================

-- IMPORTANTE: Substitua 'SEU_EMAIL@exemplo.com' pelo email do seu usuário
-- O phone_number deve ser: 11943687794 (sem código do país, como vem do Evolution API)

-- 1. Verificar se já existe integração
SELECT 
  i.id,
  i.user_id,
  i.phone_number,
  i.provider,
  u.email as user_email
FROM tb_integrations i
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE i.phone_number = '11943687794'
  AND i.provider = 'whatsapp';

-- 2. Se não existir, criar a integração
-- (Substitua 'SEU_EMAIL@exemplo.com' pelo email do seu usuário)
INSERT INTO tb_integrations (
  user_id,
  phone_number,
  provider,
  created_at,
  updated_at
)
SELECT 
  u.id,                           -- Pega o user_id pelo email
  '11943687794',                  -- Número da instância (sem código do país)
  'whatsapp',                     -- Provider
  NOW(),
  NOW()
FROM tb_users u
WHERE u.email = 'SEU_EMAIL@exemplo.com'  -- ⚠️ SUBSTITUA PELO SEU EMAIL
  AND NOT EXISTS (
    SELECT 1 FROM tb_integrations i2
    WHERE i2.phone_number = '11943687794'
      AND i2.provider = 'whatsapp'
  )
RETURNING id, phone_number;

-- 3. Verificar se foi criada
SELECT 
  i.id,
  i.user_id,
  i.phone_number,
  i.provider,
  u.email as user_email,
  i.created_at
FROM tb_integrations i
LEFT JOIN tb_users u ON u.id = i.user_id
WHERE i.phone_number = '11943687794'
  AND i.provider = 'whatsapp';
