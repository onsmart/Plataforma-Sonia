-- ============================================
-- SCRIPT DE DEBUG: Verificar dados de Analytics
-- ============================================
-- Execute este script no Supabase SQL Editor
-- para verificar se os dados estão sendo encontrados
-- ============================================

-- 1. Ver todos os tokens (sem filtro de data)
SELECT 
  id,
  companies_id,
  agent_id,
  total_tokens,
  created_at,
  DATE(created_at) as date_only
FROM public.tb_agent_token_usage
ORDER BY created_at DESC
LIMIT 10;

-- 2. Verificar companies_id do token vs companies_id do usuário
-- (Substitua 'seu-email@exemplo.com' pelo seu email)
SELECT 
  tu.companies_id as token_company_id,
  cu.companies_id as user_company_id,
  u.email,
  tu.total_tokens,
  tu.created_at
FROM public.tb_agent_token_usage tu
CROSS JOIN public.tb_users u
INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
WHERE lower(u.email) = lower('seu-email@exemplo.com')
LIMIT 5;

-- 3. Testar busca direta por companies_id
-- (Substitua 'e95017dc-d649-4066-a795-fd047abe0000' pelo companies_id do seu token)
SELECT 
  COUNT(*) as total,
  SUM(total_tokens) as total_tokens_sum,
  MIN(created_at) as primeira_data,
  MAX(created_at) as ultima_data
FROM public.tb_agent_token_usage
WHERE companies_id = 'e95017dc-d649-4066-a795-fd047abe0000';

-- 4. Testar função summary diretamente
-- (Substitua 'seu-email@exemplo.com' pelo seu email)
SELECT * FROM sp_get_analytics_summary_by_email('seu-email@exemplo.com', 30);

-- 5. Verificar se o companies_id do token está correto
SELECT DISTINCT 
  tu.companies_id,
  COUNT(*) as token_count
FROM public.tb_agent_token_usage tu
GROUP BY tu.companies_id;

-- 6. Verificar se há dados nos últimos 30 dias (sem filtro de companies_id)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as count,
  SUM(total_tokens) as total_tokens
FROM public.tb_agent_token_usage
WHERE DATE(created_at) >= CURRENT_DATE - 30
GROUP BY DATE(created_at)
ORDER BY date DESC;
