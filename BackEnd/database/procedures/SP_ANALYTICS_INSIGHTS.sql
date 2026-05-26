-- ============================================
-- RPCs de analytics usadas pela pagina Insights & Data
-- Aplicar no Supabase SQL Editor ou via supabase db push.
-- ============================================
-- Se aparecer 42P13 (return type diferente), os DROP abaixo removem a versão antiga.
DROP FUNCTION IF EXISTS public.sp_get_analytics_agent_performance_by_email(text, integer);
DROP FUNCTION IF EXISTS public.sp_get_analytics_channel_distribution_by_email(text, integer);
DROP FUNCTION IF EXISTS public.sp_get_analytics_summary_by_email(text, integer);
DROP FUNCTION IF EXISTS public.sp_get_analytics_overview_by_email(text, integer);
DROP FUNCTION IF EXISTS public.sp_get_analytics_company_id_by_email(text);

CREATE OR REPLACE FUNCTION public.sp_get_analytics_company_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.companies_id
  FROM public.tb_users u
  JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(trim(p_email))
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.sp_get_analytics_overview_by_email(
  p_email text,
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  name text,
  date text,
  conversations integer,
  cost numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_days integer := greatest(coalesce(p_days, 7), 1);
BEGIN
  v_company_id := public.sp_get_analytics_company_id_by_email(p_email);

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH bounds AS (
    SELECT (current_date - (v_days - 1))::date AS start_date, current_date::date AS end_date
  ),
  days AS (
    SELECT generate_series((SELECT start_date FROM bounds), (SELECT end_date FROM bounds), interval '1 day')::date AS day
  ),
  usage_by_day AS (
    SELECT
      atu.created_at::date AS day,
      count(DISTINCT coalesce(atu.conversation_id::text, atu.id::text))::integer AS conversations,
      sum(
        ((coalesce(atu.input_tokens, 0)::numeric / 1000000) *
          CASE coalesce(atu.model, 'gpt-4o')
            WHEN 'gpt-4o-mini' THEN 0.15
            WHEN 'gpt-4o' THEN 2.5
            WHEN 'gpt-4' THEN 30
            WHEN 'gpt-3.5-turbo' THEN 0.5
            ELSE 2.5
          END)
        +
        ((coalesce(atu.output_tokens, 0)::numeric / 1000000) *
          CASE coalesce(atu.model, 'gpt-4o')
            WHEN 'gpt-4o-mini' THEN 0.6
            WHEN 'gpt-4o' THEN 10
            WHEN 'gpt-4' THEN 60
            WHEN 'gpt-3.5-turbo' THEN 1.5
            ELSE 10
          END)
      ) AS cost
    FROM public.tb_agent_token_usage atu
    CROSS JOIN bounds
    WHERE atu.companies_id = v_company_id
      AND atu.created_at >= bounds.start_date
      AND atu.created_at < (bounds.end_date + 1)
    GROUP BY atu.created_at::date
  )
  SELECT
    to_char(d.day, 'DD/MM') AS name,
    d.day::text AS date,
    coalesce(u.conversations, 0)::integer AS conversations,
    round(coalesce(u.cost, 0), 6) AS cost
  FROM days d
  LEFT JOIN usage_by_day u ON u.day = d.day
  ORDER BY d.day;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_get_analytics_summary_by_email(
  p_email text,
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  total_interactions integer,
  total_cost numeric,
  active_channels integer,
  total_tokens integer,
  rag_usage_count integer,
  rag_usage_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_days integer := greatest(coalesce(p_days, 7), 1);
  v_start timestamptz := (current_date - (greatest(coalesce(p_days, 7), 1) - 1))::timestamptz;
  v_end timestamptz := (current_date + 1)::timestamptz;
BEGIN
  v_company_id := public.sp_get_analytics_company_id_by_email(p_email);

  IF v_company_id IS NULL THEN
    RETURN QUERY SELECT 0, 0::numeric, 0, 0, 0, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  WITH usage AS (
    SELECT
      count(DISTINCT coalesce(atu.conversation_id::text, atu.id::text))::integer AS interactions,
      coalesce(sum(coalesce(atu.total_tokens, coalesce(atu.input_tokens, 0) + coalesce(atu.output_tokens, 0))), 0)::integer AS tokens,
      coalesce(sum(
        ((coalesce(atu.input_tokens, 0)::numeric / 1000000) *
          CASE coalesce(atu.model, 'gpt-4o')
            WHEN 'gpt-4o-mini' THEN 0.15
            WHEN 'gpt-4o' THEN 2.5
            WHEN 'gpt-4' THEN 30
            WHEN 'gpt-3.5-turbo' THEN 0.5
            ELSE 2.5
          END)
        +
        ((coalesce(atu.output_tokens, 0)::numeric / 1000000) *
          CASE coalesce(atu.model, 'gpt-4o')
            WHEN 'gpt-4o-mini' THEN 0.6
            WHEN 'gpt-4o' THEN 10
            WHEN 'gpt-4' THEN 60
            WHEN 'gpt-3.5-turbo' THEN 1.5
            ELSE 10
          END)
      ), 0) AS cost
    FROM public.tb_agent_token_usage atu
    WHERE atu.companies_id = v_company_id
      AND atu.created_at >= v_start
      AND atu.created_at < v_end
  ),
  decisions AS (
    SELECT
      count(*)::integer AS total_decisions,
      count(*) FILTER (
        WHERE td.sources IS NOT NULL
          AND jsonb_typeof(to_jsonb(td.sources)) = 'array'
          AND jsonb_array_length(to_jsonb(td.sources)) > 0
      )::integer AS rag_count,
      count(DISTINCT nullif(td.channel, ''))::integer AS decision_channels
    FROM public.tb_agent_decisions td
    WHERE td.companies_id = v_company_id
      AND td.created_at >= v_start
      AND td.created_at < v_end
  ),
  integrations AS (
    SELECT count(DISTINCT coalesce(nullif(i.provider, ''), nullif(i.type, '')))::integer AS integration_channels
    FROM public.tb_integrations i
    WHERE i.companies_id = v_company_id
  )
  SELECT
    usage.interactions,
    round(usage.cost, 6),
    greatest(coalesce(decisions.decision_channels, 0), coalesce(integrations.integration_channels, 0))::integer,
    usage.tokens,
    coalesce(decisions.rag_count, 0)::integer,
    CASE
      WHEN coalesce(decisions.total_decisions, 0) = 0 THEN 0::numeric
      ELSE round((decisions.rag_count::numeric / decisions.total_decisions::numeric) * 100, 2)
    END
  FROM usage, decisions, integrations;
END;
$$;

-- Distribuição por "canal": conta linhas em tb_agent_decisions agrupadas pelo texto em channel
-- (ex.: whatsapp, whatsapp_audio, webchat). Valores distintos geram fatias/linhas separadas ainda que
-- o frontend mostre o mesmo rótulo amigável ("WhatsApp"). Integrações só entram se não houver decisões no período.
CREATE OR REPLACE FUNCTION public.sp_get_analytics_channel_distribution_by_email(
  p_email text,
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  name text,
  value integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_start timestamptz := (current_date - (greatest(coalesce(p_days, 7), 1) - 1))::timestamptz;
  v_end timestamptz := (current_date + 1)::timestamptz;
BEGIN
  v_company_id := public.sp_get_analytics_company_id_by_email(p_email);

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH decision_channels AS (
    SELECT coalesce(nullif(channel, ''), 'webchat') AS channel, count(*)::integer AS total
    FROM public.tb_agent_decisions
    WHERE companies_id = v_company_id
      AND created_at >= v_start
      AND created_at < v_end
    GROUP BY coalesce(nullif(channel, ''), 'webchat')
  ),
  integration_channels AS (
    SELECT coalesce(nullif(provider, ''), nullif(type, ''), 'integração') AS channel, count(*)::integer AS total
    FROM public.tb_integrations
    WHERE companies_id = v_company_id
    GROUP BY coalesce(nullif(provider, ''), nullif(type, ''), 'integração')
  )
  SELECT dc.channel::text AS name, dc.total AS value
  FROM decision_channels dc
  UNION ALL
  SELECT ic.channel::text AS name, ic.total AS value
  FROM integration_channels ic
  WHERE NOT EXISTS (SELECT 1 FROM decision_channels)
  ORDER BY value DESC, name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_get_analytics_agent_performance_by_email(
  p_email text,
  p_days integer DEFAULT 7
)
RETURNS TABLE (
  agent_name text,
  avg_confidence numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_start timestamptz := (current_date - (greatest(coalesce(p_days, 7), 1) - 1))::timestamptz;
  v_end timestamptz := (current_date + 1)::timestamptz;
BEGIN
  v_company_id := public.sp_get_analytics_company_id_by_email(p_email);

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    coalesce(a.nome, 'Agente sem nome')::text AS agent_name,
    round(avg(coalesce(d.confidence_score, 0))::numeric, 4) AS avg_confidence
  FROM public.tb_agent_decisions d
  LEFT JOIN public.tb_agents a ON a.id = d.agent_id
  WHERE d.companies_id = v_company_id
    AND d.created_at >= v_start
    AND d.created_at < v_end
  GROUP BY coalesce(a.nome, 'Agente sem nome')
  ORDER BY avg_confidence DESC, agent_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sp_get_analytics_company_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_company_id_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_overview_by_email(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_overview_by_email(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_summary_by_email(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_summary_by_email(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_channel_distribution_by_email(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_channel_distribution_by_email(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_agent_performance_by_email(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_analytics_agent_performance_by_email(text, integer) TO service_role;
