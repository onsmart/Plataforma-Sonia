-- ============================================
-- ATUALIZAR FUNÇÕES ANALYTICS COM PREÇOS REAIS
-- ============================================
-- Atualiza as funções para usar tb_llm_pricing
-- ============================================

-- ============================================
-- FUNÇÃO: sp_get_analytics_overview_by_email (ATUALIZADA)
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_analytics_overview_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  name TEXT,
  date DATE,
  conversations INTEGER,
  cost NUMERIC
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

  -- 3️⃣ Retornar dados agregados por dia
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, CURRENT_DATE + INTERVAL '30 days', '1 day'::interval)::DATE AS date
  ),
  decisions_by_date AS (
    SELECT 
      DATE(d.created_at) AS date,
      COUNT(*)::INTEGER AS count
    FROM public.tb_agent_decisions d
    WHERE d.companies_id = v_companies_id
      AND DATE(d.created_at) >= v_start_date
    GROUP BY DATE(d.created_at)
  ),
  messages_by_date AS (
    SELECT 
      DATE(wm.created_at) AS date,
      COUNT(*)::INTEGER AS count
    FROM public.tb_whatsapp_messages wm
    INNER JOIN public.tb_integrations i ON i.id = wm.integrations_id
    WHERE i.companies_id = v_companies_id
      AND DATE(wm.created_at) >= v_start_date
      AND wm.direction = 'inbound'
    GROUP BY DATE(wm.created_at)
  ),
  tokens_by_date AS (
    SELECT 
      DATE(tu.created_at) AS date,
      SUM(tu.total_tokens) AS total_tokens,
      SUM(tu.input_tokens) AS input_tokens,
      SUM(tu.output_tokens) AS output_tokens,
      -- Calcular custo real usando preços da tabela
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
        0
      ) AS total_cost
    FROM public.tb_agent_token_usage tu
    LEFT JOIN public.tb_llm_pricing p ON 
      LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(NULLIF(tu.provider, ''), 'openai')))
      AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(NULLIF(tu.model, ''), 'gpt-4o')))
      AND p.is_active = true
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
    GROUP BY DATE(tu.created_at)
  )
  SELECT 
    TO_CHAR(ds.date, 'YYYY-MM-DD') AS name,
    ds.date AS date,
    (COALESCE(db.count, 0) + COALESCE(mb.count, 0) + 
    CASE WHEN tb.total_tokens IS NOT NULL AND tb.total_tokens > 0 THEN 1 ELSE 0 END)::INTEGER AS conversations,
    COALESCE(tb.total_cost, 0) AS cost
  FROM date_series ds
  LEFT JOIN decisions_by_date db ON db.date = ds.date
  LEFT JOIN messages_by_date mb ON mb.date = ds.date
  LEFT JOIN tokens_by_date tb ON tb.date = ds.date
  WHERE (COALESCE(db.count, 0) > 0 OR COALESCE(mb.count, 0) > 0 OR COALESCE(tb.total_tokens, 0) > 0)
  ORDER BY ds.date ASC;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_analytics_summary_by_email (ATUALIZADA)
-- ============================================

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
        0
      ) AS total_cost
    FROM public.tb_agent_token_usage tu
    LEFT JOIN public.tb_llm_pricing p ON 
      LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(NULLIF(tu.provider, ''), 'openai')))
      AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(NULLIF(tu.model, ''), 'gpt-4o')))
      AND p.is_active = true
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
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
    COALESCE(td.total_cost, 0)::NUMERIC(10,4) AS total_cost,
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

-- ============================================
-- FUNÇÃO: sp_get_analytics_agent_performance_by_email (ATUALIZADA)
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_analytics_agent_performance_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  total_interactions INTEGER,
  approved_count INTEGER,
  rejected_count INTEGER,
  pending_count INTEGER,
  avg_confidence NUMERIC,
  total_tokens BIGINT,
  estimated_cost NUMERIC
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

  -- 3️⃣ Retornar performance por agente
  RETURN QUERY
  SELECT 
    a.id AS agent_id,
    a.nome AS agent_name,
    COUNT(DISTINCT d.id)::INTEGER AS total_interactions,
    COUNT(DISTINCT CASE WHEN d.status = 'approved' THEN d.id END)::INTEGER AS approved_count,
    COUNT(DISTINCT CASE WHEN d.status = 'rejected' THEN d.id END)::INTEGER AS rejected_count,
    COUNT(DISTINCT CASE WHEN d.status = 'pending_approval' THEN d.id END)::INTEGER AS pending_count,
    AVG(d.confidence_score)::NUMERIC(5,2) AS avg_confidence,
    COALESCE(SUM(tu.total_tokens), 0)::BIGINT AS total_tokens,
    -- Calcular custo real usando preços da tabela
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
      0
    )::NUMERIC(10,4) AS estimated_cost
  FROM public.tb_agents a
  LEFT JOIN public.tb_agent_decisions d ON d.agent_id = a.id
    AND d.companies_id = v_companies_id
    AND DATE(d.created_at) >= v_start_date
  LEFT JOIN public.tb_agent_token_usage tu ON tu.agent_id = a.id
    AND tu.companies_id = v_companies_id
    AND DATE(tu.created_at) >= v_start_date
  LEFT JOIN public.tb_llm_pricing p ON LOWER(TRIM(p.provider)) = LOWER(TRIM(COALESCE(tu.provider, 'openai')))
    AND LOWER(TRIM(p.model)) = LOWER(TRIM(COALESCE(tu.model, 'gpt-4o')))
    AND p.is_active = true
  WHERE a.companies_id = v_companies_id
    AND a.status_id = 1
  GROUP BY a.id, a.nome
  HAVING COUNT(DISTINCT d.id) > 0 OR SUM(tu.total_tokens) > 0
  ORDER BY (COUNT(DISTINCT d.id)) DESC;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_get_analytics_overview_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_overview_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_summary_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_summary_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_agent_performance_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_agent_performance_by_email TO anon;
