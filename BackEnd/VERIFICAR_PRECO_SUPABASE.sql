-- ============================================
-- VERIFICAÇÃO SIMPLES: Por que o preço está 0?
-- ============================================
-- Versão compatível com Supabase SQL Editor
-- ⚠️ Substitua 'carlos.dias@onsmart.com.br' pelo seu email se necessário

-- 1️⃣ Verificar se há registros de token usage
SELECT 
  '1. Token Usage Records' AS check_name,
  COUNT(*) AS quantidade,
  SUM(total_tokens) AS total_tokens,
  SUM(input_tokens) AS total_input,
  SUM(output_tokens) AS total_output,
  MIN(created_at) AS primeira_data,
  MAX(created_at) AS ultima_data
FROM public.tb_agent_token_usage
WHERE companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(created_at) >= CURRENT_DATE - 6;

-- 2️⃣ Verificar provider e model dos registros
SELECT 
  '2. Provider/Model Check' AS check_name,
  provider,
  model,
  COUNT(*) AS quantidade,
  SUM(total_tokens) AS total_tokens,
  SUM(input_tokens) AS total_input,
  SUM(output_tokens) AS total_output
FROM public.tb_agent_token_usage
WHERE companies_id = (
  SELECT cu.companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower('carlos.dias@onsmart.com.br')
  LIMIT 1
)
AND DATE(created_at) >= CURRENT_DATE - 6
GROUP BY provider, model;

-- 3️⃣ Verificar se a tabela de preços existe
SELECT 
  '3. Pricing Table' AS check_name,
  COUNT(*) AS total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) AS ativos
FROM public.tb_llm_pricing;

-- 4️⃣ Verificar preços disponíveis
SELECT 
  '4. Available Prices' AS check_name,
  provider,
  model,
  avg_price_per_1k,
  input_price_per_1k,
  output_price_per_1k,
  is_active
FROM public.tb_llm_pricing
WHERE is_active = true
ORDER BY provider, model;

-- 5️⃣ Testar cálculo manual para UM registro
WITH sample_token AS (
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
  '5. Manual Calculation' AS check_name,
  st.provider AS token_provider,
  st.model AS token_model,
  st.total_tokens,
  st.input_tokens,
  st.output_tokens,
  p.provider AS price_provider,
  p.model AS price_model,
  p.avg_price_per_1k,
  CASE 
    WHEN st.input_tokens > 0 AND st.output_tokens > 0 AND p.id IS NOT NULL THEN
      (st.input_tokens::NUMERIC / 1000.0) * COALESCE(p.input_price_per_1k, p.avg_price_per_1k, 0.01) +
      (st.output_tokens::NUMERIC / 1000.0) * COALESCE(p.output_price_per_1k, p.avg_price_per_1k, 0.01)
    WHEN st.input_tokens > 0 AND st.output_tokens > 0 THEN
      (st.total_tokens::NUMERIC / 1000.0) * 0.01
    WHEN p.id IS NOT NULL THEN
      (st.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
    ELSE
      (st.total_tokens::NUMERIC / 1000.0) * 0.01
  END AS calculated_cost
FROM sample_token st
LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(st.provider, 'openai')))
  AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(st.model, 'gpt-4o')))
  AND p.is_active = true;

-- 6️⃣ Calcular custo total manualmente (igual à função)
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
  '6. Total Cost Calculation' AS check_name,
  total AS total_tokens,
  total_cost AS calculated_total_cost,
  CASE 
    WHEN total_cost IS NULL THEN 'NULL - Verificar se há registros'
    WHEN total_cost = 0 THEN 'ZERO - Verificar cálculo ou dados'
    ELSE 'OK'
  END AS status
FROM tokens_data;

-- 7️⃣ Testar a função diretamente
SELECT 
  '7. Function Result' AS check_name,
  *
FROM sp_get_analytics_summary_by_email('carlos.dias@onsmart.com.br', 7);
