-- ============================================
-- FUNÇÃO: sp_activity_overview (ATUALIZADA)
-- ============================================
-- Retorna histórico de atividades do sistema com informações do usuário
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

  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 3️⃣ Retornar histórico de atividades com informações do usuário
  -- ✅ FILTRO CORRIGIDO: Apenas registros com companies_id igual ao do usuário
  -- ✅ EXPLICITAMENTE EXCLUI registros com companies_id IS NULL
  -- ✅ INCLUI logs de workflow de tb_system_logs
  RETURN QUERY
  SELECT
    tipo,
    data_evento,
    status,
    user_name,
    user_email
  FROM (
    -- Histórico de atividades (tb_activity_history)
    SELECT
      CASE
        WHEN h.activity_type = 'agent_updated' THEN 'Agents Alterado'
        WHEN h.activity_type = 'flow_updated' THEN 'Flows Alterado'
        WHEN h.activity_type = 'integration_updated' THEN 'Integration Alterada'
        WHEN h.activity_type = 'integration_expired' THEN 'Data expirada'
        WHEN h.activity_type = 'log_cleaned' THEN 'Logs Limpos'
        WHEN h.activity_type = 'fallback_cleaned' THEN 'Fallbacks Limpos'
        ELSE h.description
      END AS tipo,
      COALESCE(h.activity_date, h.created_at) AS data_evento,
      h.status,
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
      AND h.companies_id IS NOT NULL
    
    UNION ALL
    
    -- Logs de workflow e aprovações (tb_system_logs)
    SELECT
      CASE
        WHEN l.log_type = 'workflow_node_executed' THEN 'Workflow Node Executado'
        WHEN l.log_type = 'workflow_execution_completed' THEN 'Workflow Executado'
        WHEN l.log_type = 'decision_approved' THEN 'Decisão Aprovada'
        WHEN l.log_type = 'decision_rejected' THEN 'Decisão Rejeitada'
        ELSE l.log_type
      END AS tipo,
      l.created_at AS data_evento,
      CASE
        WHEN l.level = 'error' THEN 3
        WHEN l.level = 'warn' THEN 2
        ELSE 1
      END AS status,
      COALESCE(
        u2.name || CASE WHEN u2.last_name IS NOT NULL THEN ' ' || u2.last_name ELSE '' END,
        u2.name,
        u2.email,
        'Sistema'
      ) AS user_name,
      COALESCE(u2.email, 'sistema@interno') AS user_email
    FROM public.tb_system_logs l
    LEFT JOIN public.tb_users u2 ON u2.id = l.user_id
    WHERE l.companies_id = v_companies_id
      AND l.companies_id IS NOT NULL
      AND l.log_type IN ('workflow_node_executed', 'workflow_execution_completed', 'decision_approved', 'decision_rejected')
  ) combined_results
  ORDER BY status DESC, data_evento DESC
  LIMIT 100;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_activity_overview TO authenticated;
GRANT EXECUTE ON FUNCTION sp_activity_overview TO anon;
