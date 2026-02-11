-- ============================================
-- CORREÇÃO: Funções de Fallback com companies_id
-- ============================================
-- Atualiza as funções para usar companies_id como filtro principal
-- ============================================

-- ============================================
-- FUNÇÃO: sp_get_fallbacks_by_email (CORRIGIDA)
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

  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 3️⃣ Retorna os eventos de fallback (filtrado por companies_id)
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
    AND e.companies_id IS NOT NULL
  ORDER BY e.created_at DESC
  LIMIT 100;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_count_fallbacks_by_email (CORRIGIDA)
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

  -- 3️⃣ Conta os eventos de fallback (filtrado por companies_id)
  SELECT COUNT(*) INTO v_count
  FROM public.tb_system_events e
  WHERE e.companies_id = v_companies_id
    AND e.companies_id IS NOT NULL;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_get_fallbacks_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_fallbacks_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_count_fallbacks_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_count_fallbacks_by_email TO anon;
