-- ============================================
-- DEBUG: Por que o custo está zerado?
-- ============================================

-- 1️⃣ Verificar se a tabela de preços existe e tem dados
SELECT 
  'Tabela de preços' AS check_name,
  COUNT(*) AS total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS registros_ativos
FROM public.tb_llm_pricing;

-- 2️⃣ Verificar dados de token usage
SELECT 
  'Token Usage' AS check_name,
  COUNT(*) AS total_registros,
  SUM(total_tokens) AS total_tokens,
  SUM(input_tokens) AS total_input,
  SUM(output_tokens) AS total_output,
  STRING_AGG(DISTINCT provider, ', ') AS providers,
  STRING_AGG(DISTINCT model, ', ') AS models
FROM public.tb_agent_token_usage
WHERE companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(created_at) >= CURRENT_DATE - 6;

-- 3️⃣ Verificar match entre token usage e preços
SELECT 
  tu.id,
  tu.provider AS tu_provider,
  tu.model AS tu_model,
  tu.total_tokens,
  tu.input_tokens,
  tu.output_tokens,
  p.id AS pricing_id,
  p.provider AS p_provider,
  p.model AS p_model,
  p.avg_price_per_1k,
  p.input_price_per_1k,
  p.output_price_per_1k,
  CASE 
    WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 AND p.id IS NOT NULL THEN
      (tu.input_tokens::NUMERIC / 1000.0) * COALESCE(p.input_price_per_1k, p.avg_price_per_1k, 0.01) +
      (tu.output_tokens::NUMERIC / 1000.0) * COALESCE(p.output_price_per_1k, p.avg_price_per_1k, 0.01)
    WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 THEN
      (tu.total_tokens::NUMERIC / 1000.0) * 0.01
    WHEN p.id IS NOT NULL THEN
      (tu.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
    ELSE
      (tu.total_tokens::NUMERIC / 1000.0) * 0.01
  END AS calculated_cost
FROM public.tb_agent_token_usage tu
LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(tu.provider, 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(tu.model, 'gpt-4o')))
  AND p.is_active = true
WHERE tu.companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(tu.created_at) >= CURRENT_DATE - 6
ORDER BY tu.created_at DESC
LIMIT 10;

-- 4️⃣ Testar a função diretamente
SELECT * FROM sp_get_analytics_summary_by_email('carlos.dias@onsmart.com.br', 7);
