-- ============================================
-- FUNÇÃO: sp_count_pending_decisions_by_email
-- ============================================
-- Retorna a contagem de decisões de IA pendentes de aprovação
-- Filtra por companies_id (multi-tenant)
-- ============================================

CREATE OR REPLACE FUNCTION sp_count_pending_decisions_by_email(
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

  -- 3️⃣ Conta decisões pendentes de aprovação por companies_id
  SELECT COUNT(*) INTO v_count
  FROM public.tb_agent_decisions d
  WHERE d.companies_id = v_companies_id
    AND d.status = 'pending_approval';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_count_pending_decisions_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_count_pending_decisions_by_email TO anon;
