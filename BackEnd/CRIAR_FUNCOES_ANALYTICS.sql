-- ============================================
-- FUNÇÕES: Analytics e Insights
-- ============================================
-- Funções para buscar métricas de analytics
-- Filtra por companies_id (multi-tenant)
-- ============================================

-- ============================================
-- FUNÇÃO: sp_get_analytics_overview_by_email
-- ============================================
-- Retorna volume de interações por dia (últimos N dias)
-- Fonte: tb_agent_decisions, tb_whatsapp_messages
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_analytics_overview_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  name TEXT, -- Data formatada (ex: "2024-01-01")
  date DATE, -- Data real
  conversations INTEGER, -- Total de interações/conversas
  cost NUMERIC -- Custo estimado em dólares
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

  -- 2️⃣ Calcular data inicial (incluir hoje e futuro - para pegar todos os dados)
  v_start_date := CURRENT_DATE - (p_days - 1);

  -- 3️⃣ Retornar dados agregados por dia
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, CURRENT_DATE + INTERVAL '30 days', '1 day'::interval)::DATE AS date
  ),
  decisions_by_date AS (
    SELECT 
      DATE(d.created_at) AS date,
      COUNT(*) AS count
    FROM public.tb_agent_decisions d
    WHERE d.companies_id = v_companies_id
      AND DATE(d.created_at) >= v_start_date
    GROUP BY DATE(d.created_at)
  ),
  messages_by_date AS (
    SELECT 
      DATE(wm.created_at) AS date,
      COUNT(DISTINCT wm.phone_number) AS count
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
      SUM(tu.output_tokens) AS output_tokens
    FROM public.tb_agent_token_usage tu
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
    GROUP BY DATE(tu.created_at)
  )
  SELECT 
    TO_CHAR(ds.date, 'YYYY-MM-DD') AS name,
    ds.date AS date,
    COALESCE(db.count, 0) + COALESCE(mb.count, 0) + 
    CASE WHEN tb.total_tokens IS NOT NULL AND tb.total_tokens > 0 THEN 1 ELSE 0 END AS conversations,
    -- Custo estimado: $0.01 por 1K tokens (preço médio gpt-4o)
    COALESCE((tb.total_tokens::NUMERIC / 1000.0) * 0.01, 0) AS cost
  FROM date_series ds
  LEFT JOIN decisions_by_date db ON db.date = ds.date
  LEFT JOIN messages_by_date mb ON mb.date = ds.date
  LEFT JOIN tokens_by_date tb ON tb.date = ds.date
  WHERE (COALESCE(db.count, 0) > 0 OR COALESCE(mb.count, 0) > 0 OR COALESCE(tb.total_tokens, 0) > 0)
  ORDER BY ds.date ASC;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_analytics_agent_performance_by_email
-- ============================================
-- Retorna performance por agente
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
    COALESCE((SUM(tu.total_tokens)::NUMERIC / 1000.0) * 0.01, 0) AS estimated_cost
  FROM public.tb_agents a
  LEFT JOIN public.tb_agent_decisions d ON d.agent_id = a.id
    AND d.companies_id = v_companies_id
    AND d.created_at >= v_start_date
  LEFT JOIN public.tb_agent_token_usage tu ON tu.agent_id = a.id
    AND tu.companies_id = v_companies_id
    AND tu.created_at >= v_start_date
  WHERE a.companies_id = v_companies_id
    AND a.status_id = 1
  GROUP BY a.id, a.nome
  HAVING COUNT(DISTINCT d.id) > 0 OR SUM(tu.total_tokens) > 0
  ORDER BY (COUNT(DISTINCT d.id)) DESC;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_analytics_rag_usage_by_email
-- ============================================
-- Retorna uso de RAG (arquivos consultados)
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_analytics_rag_usage_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_rag_uses BIGINT,
  total_interactions BIGINT,
  rag_usage_rate NUMERIC,
  top_files JSONB
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

  -- 3️⃣ Retornar uso de RAG
  RETURN QUERY
  WITH rag_uses AS (
    SELECT COUNT(*) AS count
    FROM public.tb_file_usage fu
    WHERE fu.companies_id = v_companies_id
      AND fu.created_at >= v_start_date
      AND fu.context = 'agent_knowledge'
  ),
  total_interactions AS (
    SELECT COUNT(*) AS count
    FROM public.tb_agent_decisions d
    WHERE d.companies_id = v_companies_id
      AND d.created_at >= v_start_date
  ),
  top_files_data AS (
    SELECT 
      f.id,
      f.name,
      COUNT(*) AS usage_count
    FROM public.tb_file_usage fu
    INNER JOIN public.tb_files f ON f.id = fu.file_id
    WHERE fu.companies_id = v_companies_id
      AND fu.created_at >= v_start_date
      AND fu.context = 'agent_knowledge'
    GROUP BY f.id, f.name
    ORDER BY usage_count DESC
    LIMIT 10
  )
  SELECT 
    COALESCE(ru.count, 0)::BIGINT AS total_rag_uses,
    COALESCE(ti.count, 0)::BIGINT AS total_interactions,
    CASE 
      WHEN ti.count > 0 THEN (ru.count::NUMERIC / ti.count::NUMERIC * 100.0)
      ELSE 0
    END::NUMERIC(5,2) AS rag_usage_rate,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'file_id', tf.id,
          'file_name', tf.name,
          'usage_count', tf.usage_count
        )
        ORDER BY tf.usage_count DESC
      ),
      '[]'::jsonb
    ) AS top_files
  FROM rag_uses ru
  CROSS JOIN total_interactions ti
  LEFT JOIN top_files_data tf ON true
  GROUP BY ru.count, ti.count;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_analytics_channel_distribution_by_email
-- ============================================
-- Retorna distribuição por canal
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_analytics_channel_distribution_by_email(
  p_email TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  name TEXT, -- Nome do canal
  value INTEGER -- Quantidade de interações
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

  -- 2️⃣ Calcular data inicial (sem limite de data futura)
  v_start_date := CURRENT_DATE - (p_days - 1);

  -- 3️⃣ Retornar distribuição por canal
  RETURN QUERY
  WITH decisions_channels AS (
    SELECT 
      COALESCE(d.channel, 'webchat') AS name,
      COUNT(*)::INTEGER AS value
    FROM public.tb_agent_decisions d
    WHERE d.companies_id = v_companies_id
      AND DATE(d.created_at) >= v_start_date
    GROUP BY COALESCE(d.channel, 'webchat')
  ),
  tokens_channels AS (
    SELECT 
      COALESCE(tu.metadata->>'channel', 'webchat') AS name,
      COUNT(*)::INTEGER AS value
    FROM public.tb_agent_token_usage tu
    WHERE tu.companies_id = v_companies_id
      AND DATE(tu.created_at) >= v_start_date
    GROUP BY COALESCE(tu.metadata->>'channel', 'webchat')
  )
  SELECT 
    COALESCE(dc.name, tc.name, 'webchat') AS name,
    COALESCE(dc.value, 0) + COALESCE(tc.value, 0) AS value
  FROM decisions_channels dc
  FULL OUTER JOIN tokens_channels tc ON tc.name = dc.name
  ORDER BY value DESC;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_analytics_summary_by_email
-- ============================================
-- Retorna resumo geral de analytics
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

  -- 2️⃣ Calcular data inicial (sem limite de data futura)
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
      COALESCE(SUM(tu.total_tokens), 0) AS total
    FROM public.tb_agent_token_usage tu
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
    CASE 
      WHEN COALESCE(td.total, 0) > 0 THEN (td.total::NUMERIC / 1000.0) * 0.01
      ELSE 0
    END::NUMERIC(10,4) AS total_cost,
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
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_get_analytics_overview_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_overview_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_agent_performance_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_agent_performance_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_rag_usage_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_rag_usage_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_channel_distribution_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_channel_distribution_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_get_analytics_summary_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_analytics_summary_by_email TO anon;
