-- ============================================
-- SCRIPT DE TESTE: Funções de Analytics
-- ============================================
-- Execute este script no Supabase SQL Editor
-- para testar se as funções estão funcionando
-- ============================================

-- 1. Verificar se há dados na tabela de tokens
SELECT 
  COUNT(*) as total_tokens,
  MIN(created_at) as primeira_data,
  MAX(created_at) as ultima_data,
  SUM(total_tokens) as total_tokens_sum
FROM public.tb_agent_token_usage;

-- 2. Verificar companies_id dos tokens
SELECT DISTINCT companies_id
FROM public.tb_agent_token_usage;

-- 3. Testar função summary (substitua 'seu-email@exemplo.com' pelo seu email)
SELECT * FROM sp_get_analytics_summary_by_email('seu-email@exemplo.com', 7);

-- 4. Testar função overview
SELECT * FROM sp_get_analytics_overview_by_email('seu-email@exemplo.com', 7);

-- 5. Testar função channels
SELECT * FROM sp_get_analytics_channel_distribution_by_email('seu-email@exemplo.com', 7);

-- 6. Verificar se o companies_id do token corresponde ao do usuário
SELECT 
  tu.companies_id as token_company,
  cu.companies_id as user_company,
  u.email
FROM public.tb_agent_token_usage tu
CROSS JOIN public.tb_users u
INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
LIMIT 5;
