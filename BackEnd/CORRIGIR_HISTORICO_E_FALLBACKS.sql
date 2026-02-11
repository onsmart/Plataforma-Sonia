-- ============================================
-- CORREÇÃO COMPLETA: Histórico e Fallbacks
-- ============================================
-- Versões simplificadas e robustas que funcionam mesmo com dados NULL
-- ============================================

-- ============================================
-- FUNÇÃO: sp_activity_overview (VERSÃO SIMPLIFICADA)
-- ============================================
CREATE OR REPLACE FUNCTION sp_activity_overview(
  p_email TEXT
)
RETURNS TABLE (
  tipo TEXT,
  data_evento TIMESTAMPTZ,
  status SMALLINT,
  user_name TEXT,
  user_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
BEGIN
  -- 1️⃣ email → user_id
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 2️⃣ user_id → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  LIMIT 1;

  -- ✅ Se não tiver companies_id, retorna vazio (multi-tenant obrigatório)
  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 3️⃣ Retornar histórico de atividades
  RETURN QUERY
  SELECT
    CASE
      WHEN h.activity_type = 'agent_updated' THEN 'Agents Alterado'
      WHEN h.activity_type = 'flow_updated' THEN 'Flows Alterado'
      WHEN h.activity_type = 'integration_updated' THEN 'Integration Alterada'
      WHEN h.activity_type = 'integration_expired' THEN 'Data expirada'
      WHEN h.activity_type = 'log_cleaned' THEN 'Logs Limpos'
      WHEN h.activity_type = 'fallback_cleaned' THEN 'Fallbacks Limpos'
      ELSE COALESCE(h.description, h.activity_type)
    END AS tipo,
    COALESCE(h.activity_date, h.created_at) AS data_evento,
    COALESCE(h.status, 1)::SMALLINT AS status,  -- ✅ CAST explícito para SMALLINT
    COALESCE(
      u.name || CASE WHEN u.last_name IS NOT NULL THEN ' ' || u.last_name ELSE '' END,
      u.name,
      u.email,
      'Sistema'
    ) AS user_name,
    COALESCE(u.email, 'sistema@interno') AS user_email
  FROM public.tb_activity_history h
  LEFT JOIN public.tb_users u ON u.id = h.user_id
  WHERE h.companies_id = v_companies_id
  ORDER BY h.status DESC NULLS LAST, COALESCE(h.activity_date, h.created_at) DESC
  LIMIT 50;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_fallbacks_by_email (VERSÃO SIMPLIFICADA)
-- ============================================
CREATE OR REPLACE FUNCTION sp_get_fallbacks_by_email(
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  level TEXT,
  message TEXT,
  metadata JSONB,
  impact_level TEXT,
  workflow_id UUID,
  node_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
BEGIN
  -- 1️⃣ email → user_id
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 2️⃣ user_id → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  LIMIT 1;

  -- ✅ Se não tiver companies_id, retorna vazio (multi-tenant obrigatório)
  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 3️⃣ Retorna os eventos de fallback
  RETURN QUERY
  SELECT 
    e.id,
    e.event_type,
    e.level,
    e.message,
    e.metadata,
    e.impact_level,
    e.workflow_id,
    e.node_id,
    e.created_at
  FROM public.tb_system_events e
  WHERE e.companies_id = v_companies_id
  ORDER BY e.created_at DESC
  LIMIT 100;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_count_fallbacks_by_email (VERSÃO SIMPLIFICADA)
-- ============================================
CREATE OR REPLACE FUNCTION sp_count_fallbacks_by_email(
  p_email TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_count BIGINT;
BEGIN
  -- 1️⃣ email → user_id
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 2️⃣ user_id → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 3️⃣ Conta os eventos de fallback
  SELECT COUNT(*) INTO v_count
  FROM public.tb_system_events e
  WHERE e.companies_id = v_companies_id;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_activity_overview TO authenticated;
GRANT EXECUTE ON FUNCTION sp_activity_overview TO anon;
GRANT EXECUTE ON FUNCTION sp_get_fallbacks_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_fallbacks_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_count_fallbacks_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_count_fallbacks_by_email TO anon;
