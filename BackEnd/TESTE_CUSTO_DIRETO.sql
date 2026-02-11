-- ============================================
-- TESTE DIRETO: Por que o custo está 0?
-- ============================================
-- Execute cada query separadamente e me envie os resultados

-- QUERY 1: Verificar registros de token usage
SELECT 
  id,
  provider,
  model,
  total_tokens,
  input_tokens,
  output_tokens,
  created_at
FROM public.tb_agent_token_usage
WHERE companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(created_at) >= CURRENT_DATE - 6
ORDER BY created_at DESC
LIMIT 5;

-- QUERY 2: Verificar se a tabela de preços existe
SELECT COUNT(*) AS total_precos FROM public.tb_llm_pricing;

-- QUERY 3: Ver preços disponíveis
SELECT provider, model, avg_price_per_1k, is_active 
FROM public.tb_llm_pricing 
WHERE is_active = true
LIMIT 10;

-- QUERY 4: Calcular custo para UM registro específico
-- ⚠️ Substitua 'SEU_ID_AQUI' pelo ID de um registro da QUERY 1
WITH sample AS (
  SELECT 
    tu.id,
    tu.provider,
    tu.model,
    tu.total_tokens,
    tu.input_tokens,
    tu.output_tokens
  FROM public.tb_agent_token_usage tu
  WHERE tu.companies_id = (
    SELECT cu.companies_id
    FROM public.tb_users u
    INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
    WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
    LIMIT 1
  )
  AND DATE(tu.created_at) >= CURRENT_DATE - 6
  LIMIT 1
)
SELECT 
  s.*,
  p.id AS pricing_id,
  p.provider AS price_provider,
  p.model AS price_model,
  p.avg_price_per_1k,
  -- Cálculo passo a passo
  CASE 
    WHEN s.input_tokens > 0 AND s.output_tokens > 0 AND p.id IS NOT NULL THEN
      'Caso 1: Input+Output com preço'
    WHEN s.input_tokens > 0 AND s.output_tokens > 0 THEN
      'Caso 2: Input+Output sem preço'
    WHEN s.total_tokens > 0 AND p.id IS NOT NULL THEN
      'Caso 3: Total com preço'
    WHEN s.total_tokens > 0 THEN
      'Caso 4: Total sem preço (fallback)'
    ELSE
      'Caso 5: Sem tokens'
  END AS caso_usado,
  -- Cálculo do custo
  CASE 
    WHEN s.input_tokens > 0 AND s.output_tokens > 0 AND p.id IS NOT NULL THEN
      (s.input_tokens::NUMERIC / 1000.0) * COALESCE(p.input_price_per_1k, p.avg_price_per_1k, 0.01) +
      (s.output_tokens::NUMERIC / 1000.0) * COALESCE(p.output_price_per_1k, p.avg_price_per_1k, 0.01)
    WHEN s.input_tokens > 0 AND s.output_tokens > 0 THEN
      (s.total_tokens::NUMERIC / 1000.0) * 0.01
    WHEN s.total_tokens > 0 AND p.id IS NOT NULL THEN
      (s.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
    WHEN s.total_tokens > 0 THEN
      (s.total_tokens::NUMERIC / 1000.0) * 0.01
    ELSE
      0
  END AS custo_calculado
FROM sample s
LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(s.provider, 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(s.model, 'gpt-4o')))
  AND p.is_active = true;

-- QUERY 5: Testar a função
SELECT * FROM sp_get_analytics_summary_by_email('carlos.dias@onsmart.com.br', 7);
