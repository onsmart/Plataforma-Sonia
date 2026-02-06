-- ============================================
-- FUNÇÃO: sp_get_fallbacks_by_email
-- ============================================
-- Retorna TODOS os eventos da tabela tb_system_events do usuário
-- (sem filtrar por tipo de evento)
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
BEGIN
  -- 1. Busca o user_id pelo email
  SELECT u.id INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Retorna os eventos de fallback do usuário
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
  WHERE e.user_id = v_user_id
  ORDER BY e.created_at DESC
  LIMIT 100;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_count_fallbacks_by_email
-- ============================================
-- Retorna a contagem total de TODOS os eventos do usuário
-- (sem filtrar por tipo de evento)
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
  v_count BIGINT;
BEGIN
  -- 1. Busca o user_id pelo email
  SELECT u.id INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- 2. Conta os eventos de fallback do usuário
  SELECT COUNT(*) INTO v_count
  FROM public.tb_system_events e
  WHERE e.user_id = v_user_id;

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
