-- ============================================
-- FUNÇÃO: sp_get_subscription_usage_by_email
-- Retorna uso atual vs limites do plano
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_subscription_usage_by_email(
  p_email TEXT
)
RETURNS TABLE (
  messages_used INTEGER,
  messages_limit INTEGER,
  agents_used INTEGER,
  agents_limit INTEGER,
  plan_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_companies_id UUID;
  v_plan TEXT := 'starter'; -- Default
  v_messages_used INTEGER := 0;
  v_agents_used INTEGER := 0;
  v_messages_limit INTEGER := 50; -- Starter default
  v_agents_limit INTEGER := 1; -- Starter default
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- 1️⃣ email → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RETURN QUERY SELECT 0, 50, 0, 1, 'starter'::TEXT;
    RETURN;
  END IF;

  -- 2️⃣ Calcular início e fim do mês atual
  v_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_month_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;

  -- 3️⃣ Contar mensagens/interações do mês atual
  -- Usa tb_agent_token_usage que rastreia TODAS as interações (não apenas as de baixa confiança)
  -- Cada registro = 1 interação/mensagem do agente (cada chamada ao LLM gera 1 registro)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_messages_used
  FROM public.tb_agent_token_usage tu
  WHERE tu.companies_id = v_companies_id
    AND DATE(tu.created_at) >= v_month_start
    AND DATE(tu.created_at) <= v_month_end;

  -- 4️⃣ Contar agentes ativos
  -- status_id: 1 = ativo (verde), 2 = cancelado (vermelho), 3 = pausado (amarelo)
  SELECT COALESCE(COUNT(*), 0)
  INTO v_agents_used
  FROM public.tb_agents a
  WHERE a.companies_id = v_companies_id
    AND (a.status_id = 1 OR a.status_id IS NULL); -- Ativo ou sem status definido (considera ativo)

  -- 5️⃣ Determinar limites baseado no plano
  -- TODO: Quando tiver tabela de subscription, buscar de lá
  -- Por enquanto, usar valores padrão baseado no plano
  -- Starter: 50 mensagens, 1 agente
  -- Pro: Ilimitado (ou 999999)
  -- Enterprise: Ilimitado (ou 999999)
  
  -- Por enquanto, sempre retornar Starter como padrão
  -- Quando tiver integração com Stripe/Subscription, buscar de lá
  v_plan := 'starter';
  v_messages_limit := 50;
  v_agents_limit := 1;

  -- 6️⃣ Retornar resultado
  RETURN QUERY SELECT 
    v_messages_used,
    v_messages_limit,
    v_agents_used,
    v_agents_limit,
    v_plan;
END;
$$;

-- Permissões
GRANT EXECUTE ON FUNCTION sp_get_subscription_usage_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_subscription_usage_by_email(TEXT) TO anon;

-- Testar
-- SELECT * FROM sp_get_subscription_usage_by_email('carlos.dias@onsmart.com.br');
