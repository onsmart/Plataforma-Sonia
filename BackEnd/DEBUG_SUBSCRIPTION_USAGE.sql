-- ============================================
-- SCRIPT DE DEBUG: Verificar dados de uso
-- ============================================
-- Execute este script para verificar se há dados e se a função está funcionando

-- 1️⃣ Verificar se há dados em tb_agent_token_usage para o mês atual
SELECT 
    COUNT(*) as total_registros,
    COUNT(DISTINCT companies_id) as empresas_diferentes,
    MIN(created_at) as primeira_interacao,
    MAX(created_at) as ultima_interacao
FROM public.tb_agent_token_usage
WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(created_at) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- 2️⃣ Verificar companies_id do usuário
SELECT 
    u.email,
    u.id as user_id,
    cu.companies_id
FROM public.tb_users u
INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br'); -- ⚠️ SUBSTITUA PELO SEU EMAIL

-- 3️⃣ Verificar se há registros de token_usage para essa empresa no mês atual
WITH user_company AS (
    SELECT cu.companies_id
    FROM public.tb_users u
    INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
    WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br') -- ⚠️ SUBSTITUA PELO SEU EMAIL
    LIMIT 1
)
SELECT 
    tu.id,
    tu.companies_id,
    tu.agent_id,
    tu.total_tokens,
    tu.created_at,
    DATE(tu.created_at) as data
FROM public.tb_agent_token_usage tu
CROSS JOIN user_company uc
WHERE tu.companies_id = uc.companies_id
  AND DATE(tu.created_at) >= DATE_TRUNC('month', CURRENT_DATE)
  AND DATE(tu.created_at) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY tu.created_at DESC
LIMIT 10;

-- 4️⃣ Testar a função diretamente
SELECT * FROM sp_get_subscription_usage_by_email('carlos.dias@onsmart.com.br'); -- ⚠️ SUBSTITUA PELO SEU EMAIL

-- 5️⃣ Verificar todos os registros de token_usage (últimos 30 dias) para debug
SELECT 
    tu.companies_id,
    COUNT(*) as total_interacoes,
    MIN(tu.created_at) as primeira,
    MAX(tu.created_at) as ultima
FROM public.tb_agent_token_usage tu
WHERE tu.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tu.companies_id
ORDER BY total_interacoes DESC;
