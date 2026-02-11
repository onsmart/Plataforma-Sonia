-- ============================================
-- VERIFICAR: Por que o cálculo de preço retorna 0?
-- ============================================
-- ⚠️ Compatível com Supabase SQL Editor
-- Substitua 'carlos.dias@onsmart.com.br' pelo seu email se necessário

-- 1️⃣ Verificar companies_id
SELECT 
  '1. Companies ID' AS step,
  cu.companies_id,
  u.email
FROM public.tb_users u
INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
LIMIT 1;

-- 2️⃣ Verificar se há registros de token usage
WITH v_companies_id AS (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
),
v_start_date AS (
  SELECT CURRENT_DATE - 6 AS start_date
)
SELECT 
  '2. Token Usage Records' AS step,
  COUNT(*) AS total_records,
  SUM(total_tokens) AS sum_total_tokens,
  SUM(input_tokens) AS sum_input_tokens,
  SUM(output_tokens) AS sum_output_tokens,
  COUNT(CASE WHEN provider IS NULL OR provider = '' THEN 1 END) AS null_provider,
  COUNT(CASE WHEN model IS NULL OR model = '' THEN 1 END) AS null_model,
  STRING_AGG(DISTINCT provider, ', ') AS unique_providers,
  STRING_AGG(DISTINCT model, ', ') AS unique_models
FROM public.tb_agent_token_usage tu
CROSS JOIN v_companies_id c
CROSS JOIN v_start_date s
WHERE tu.companies_id = c.companies_id
  AND DATE(tu.created_at) >= s.start_date;

-- 3️⃣ Verificar se a tabela de preços existe e tem dados
SELECT 
  '3. Pricing Table' AS step,
  COUNT(*) AS total_prices,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS active_prices,
  STRING_AGG(DISTINCT provider, ', ') AS providers,
  STRING_AGG(DISTINCT model, ', ') AS models
FROM public.tb_llm_pricing;

-- 4️⃣ Verificar match entre token usage e preços
WITH v_companies_id AS (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
),
v_start_date AS (
  SELECT CURRENT_DATE - 6 AS start_date
)
SELECT 
  '4. Match Analysis' AS step,
  tu.id,
  tu.provider AS tu_provider,
  tu.model AS tu_model,
  tu.total_tokens,
  tu.input_tokens,
  tu.output_tokens,
  CASE 
    WHEN p.id IS NOT NULL THEN 'MATCH'
    ELSE 'NO MATCH'
  END AS match_status,
  p.provider AS p_provider,
  p.model AS p_model,
  p.avg_price_per_1k,
  p.input_price_per_1k,
  p.output_price_per_1k,
  -- Cálculo detalhado
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
  END AS calculated_cost,
  -- Debug: valores intermediários
  tu.input_tokens::NUMERIC / 1000.0 AS input_k,
  tu.output_tokens::NUMERIC / 1000.0 AS output_k,
  tu.total_tokens::NUMERIC / 1000.0 AS total_k
FROM public.tb_agent_token_usage tu
CROSS JOIN v_companies_id c
CROSS JOIN v_start_date s
LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(tu.provider, 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(tu.model, 'gpt-4o')))
  AND p.is_active = true
WHERE tu.companies_id = c.companies_id
  AND DATE(tu.created_at) >= s.start_date
ORDER BY tu.created_at DESC
LIMIT 10;

-- 5️⃣ Calcular custo total manualmente (igual à função)
WITH v_companies_id AS (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
),
v_start_date AS (
  SELECT CURRENT_DATE - 6 AS start_date
),
tokens_data AS (
  SELECT 
    COALESCE(SUM(tu.total_tokens), 0) AS total,
    COALESCE(
      SUM(
        CASE 
          WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 AND p.id IS NOT NULL THEN
            (tu.input_tokens::NUMERIC / 1000.0) * COALESCE(p.input_price_per_1k, p.avg_price_per_1k, 0.01) +
            (tu.output_tokens::NUMERIC / 1000.0) * COALESCE(p.output_price_per_1k, p.avg_price_per_1k, 0.01)
          WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 THEN
            (tu.total_tokens::NUMERIC / 1000.0) * 0.01
          WHEN tu.total_tokens > 0 AND p.id IS NOT NULL THEN
            (tu.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
          WHEN tu.total_tokens > 0 THEN
            (tu.total_tokens::NUMERIC / 1000.0) * 0.01
          ELSE
            0
        END
      ),
      0
    ) AS total_cost
  FROM public.tb_agent_token_usage tu
  CROSS JOIN v_companies_id c
  CROSS JOIN v_start_date s
  LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(tu.provider, 'openai')))
    AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(tu.model, 'gpt-4o')))
    AND p.is_active = true
  WHERE tu.companies_id = c.companies_id
    AND DATE(tu.created_at) >= s.start_date
)
SELECT 
  '5. Total Cost Calculation' AS step,
  total AS total_tokens,
  COALESCE(total_cost, 0) AS calculated_total_cost,
  CASE 
    WHEN total_cost IS NULL THEN 'NULL - Verificar se há registros'
    WHEN total_cost = 0 THEN 'ZERO - Verificar cálculo ou dados'
    ELSE 'OK'
  END AS status
FROM tokens_data;

-- 6️⃣ Testar a função diretamente
SELECT 
  '6. Function Result' AS step,
  *
FROM sp_get_analytics_summary_by_email('carlos.dias@onsmart.com.br', 7);
