-- ============================================
-- CORREÇÃO FINAL: Garantir que custo nunca seja 0 quando há tokens
-- ============================================

-- Atualizar a função sp_get_analytics_summary_by_email
CREATE OR REPLACE FUNCTION sp_get_analytics_summary_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_interactions BIGINT,
  total_cost NUMERIC,
  active_channels INTEGER,
  total_tokens BIGINT,
  rag_usage_count BIGINT,
  rag_usage_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_companies_id UUID;
  v_start_date DATE;
BEGIN
  -- 1️⃣ email → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 2️⃣ Calcular data inicial
  v_start_date := CURRENT_DATE - (p_days - 1);

  -- 3️⃣ Retornar resumo
  RETURN QUERY
  WITH decisions_count AS (
    SELECT COALESCE(COUNT(*), 0) AS count
    FROM public.tb_agent_decisions d
    WHERE d.companies_id = v_companies_id
      AND DATE(d.created_at) >= v_start_date
  ),
  tokens_count AS (
    SELECT COALESCE(COUNT(*), 0) AS count
    FROM public.tb_agent_token_usage tu
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
  ),
  tokens_data AS (
    SELECT 
      COALESCE(SUM(tu.total_tokens), 0) AS total,
      -- Calcular custo real usando preços da tabela
      -- IMPORTANTE: Garantir que sempre calcule, mesmo sem match
      COALESCE(
        SUM(
          CASE 
            -- Se tiver input e output separados E tem preço na tabela, usa preços específicos
            WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 AND p.id IS NOT NULL THEN
              (tu.input_tokens::NUMERIC / 1000.0) * COALESCE(p.input_price_per_1k, p.avg_price_per_1k, 0.01) +
              (tu.output_tokens::NUMERIC / 1000.0) * COALESCE(p.output_price_per_1k, p.avg_price_per_1k, 0.01)
            -- Se tiver input e output mas não tem preço na tabela, usa fallback
            WHEN tu.input_tokens > 0 AND tu.output_tokens > 0 THEN
              (tu.total_tokens::NUMERIC / 1000.0) * 0.01
            -- Se tiver apenas total_tokens e tem preço na tabela, usa preço médio
            WHEN tu.total_tokens > 0 AND p.id IS NOT NULL THEN
              (tu.total_tokens::NUMERIC / 1000.0) * COALESCE(p.avg_price_per_1k, 0.01)
            -- Fallback: se não tem preço na tabela, usa $0.01 por 1K tokens
            WHEN tu.total_tokens > 0 THEN
              (tu.total_tokens::NUMERIC / 1000.0) * 0.01
            -- Se total_tokens for 0, retorna 0
            ELSE
              0
          END
        ),
        -- Se SUM retornar NULL (nenhum registro), retorna 0
        0
      ) AS total_cost
    FROM public.tb_agent_token_usage tu
    LEFT JOIN public.tb_llm_pricing p ON 
      LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(NULLIF(tu.provider, ''), 'openai')))
      AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(NULLIF(tu.model, ''), 'gpt-4o')))
      AND p.is_active = true
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
      AND tu.total_tokens > 0  -- ⚠️ IMPORTANTE: Só calcular se tiver tokens
  ),
  rag_uses AS (
    SELECT COALESCE(COUNT(*), 0) AS count
    FROM public.tb_file_usage fu
    WHERE fu.companies_id = v_companies_id
      AND DATE(fu.created_at) >= v_start_date
      AND fu.context = 'agent_knowledge'
  ),
  channels AS (
    SELECT COALESCE(COUNT(DISTINCT channel_name), 0) AS count
    FROM (
      SELECT COALESCE(d.channel, 'webchat') AS channel_name
      FROM public.tb_agent_decisions d
      WHERE d.companies_id = v_companies_id
        AND DATE(d.created_at) >= v_start_date
      UNION
      SELECT COALESCE(tu.metadata->>'channel', 'webchat') AS channel_name
      FROM public.tb_agent_token_usage tu
      WHERE tu.companies_id = v_companies_id
        AND DATE(tu.created_at) >= v_start_date
    ) channels_union
  )
  SELECT 
    (dc.count + tc.count)::BIGINT AS total_interactions,
    COALESCE(td.total_cost, 0)::NUMERIC(12,6) AS total_cost,
    c.count::INTEGER AS active_channels,
    COALESCE(td.total, 0)::BIGINT AS total_tokens,
    ru.count::BIGINT AS rag_usage_count,
    CASE 
      WHEN (dc.count + tc.count) > 0 THEN (ru.count::NUMERIC / (dc.count + tc.count)::NUMERIC * 100.0)
      ELSE 0
    END::NUMERIC(5,2) AS rag_usage_rate
  FROM decisions_count dc
  CROSS JOIN tokens_count tc
  CROSS JOIN tokens_data td
  CROSS JOIN rag_uses ru
  CROSS JOIN channels c;
END;
$$;

-- Testar
SELECT * FROM sp_get_analytics_summary_by_email('carlos.dias@onsmart.com.br', 7);
