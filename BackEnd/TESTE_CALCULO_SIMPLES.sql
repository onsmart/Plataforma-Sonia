-- ============================================
-- TESTE SIMPLES: Verificar se o cálculo funciona
-- ============================================

-- Teste 1: Calcular manualmente com 120 tokens
SELECT 
  'Teste Manual' AS teste,
  120 AS tokens,
  0.01 AS preco_por_1k,
  (120::NUMERIC / 1000.0) * 0.01 AS custo_calculado;

-- Teste 2: Verificar se há match entre provider/model
SELECT 
  tu.provider AS token_provider,
  tu.model AS token_model,
  p.provider AS price_provider,
  p.model AS price_model,
  CASE 
    WHEN p.id IS NOT NULL THEN 'MATCH ✅'
    ELSE 'NO MATCH ❌'
  END AS status,
  tu.total_tokens,
  (tu.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01) AS custo
FROM public.tb_agent_token_usage tu
LEFT JOIN public.tb_llm_pricing p ON 
  LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(NULLIF(tu.provider, ''), 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(NULLIF(tu.model, ''), 'gpt-4o')))
  AND p.is_active = true
WHERE tu.companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(tu.created_at) >= CURRENT_DATE - 6
LIMIT 5;

-- Teste 3: Calcular custo total com SUM
SELECT 
  SUM(tu.total_tokens) AS total_tokens,
  SUM(
    CASE 
      WHEN tu.total_tokens > 0 AND p.id IS NOT NULL THEN
        (tu.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
      WHEN tu.total_tokens > 0 THEN
        (tu.total_tokens::NUMERIC / 1000.0) * 0.01
      ELSE
        0
    END
  ) AS custo_total
FROM public.tb_agent_token_usage tu
LEFT JOIN public.tb_llm_pricing p ON 
  LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(NULLIF(tu.provider, ''), 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(NULLIF(tu.model, ''), 'gpt-4o')))
  AND p.is_active = true
WHERE tu.companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(tu.created_at) >= CURRENT_DATE - 6
AND tu.total_tokens > 0;
