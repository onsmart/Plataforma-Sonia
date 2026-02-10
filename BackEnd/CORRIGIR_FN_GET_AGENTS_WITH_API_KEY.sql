-- ============================================
-- CORREÇÃO: fn_get_agents_with_api_key
-- ============================================
-- Remove referência a coluna 'channels' que não existe
-- Atualiza para usar companies_id em vez de user_id
-- Corrige tipo de temperature para NUMERIC
-- ============================================

-- Remover todas as versões antigas da função
DROP FUNCTION IF EXISTS public.fn_get_agents_with_api_key(TEXT);
DROP FUNCTION IF EXISTS public.fn_get_agents_with_api_key(text);
DROP FUNCTION IF EXISTS public.fn_get_agents_with_api_key(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.fn_get_agents_with_api_key(text, integer);

-- Criar função corrigida
CREATE OR REPLACE FUNCTION public.fn_get_agents_with_api_key(
  p_user_email TEXT
)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  bio TEXT,
  system_instructions TEXT,
  primary_language TEXT,
  provider TEXT,
  provider_model TEXT,
  temperature NUMERIC, -- ✅ Corrigido: REAL → NUMERIC
  max_tokens BIGINT,
  api_key TEXT,
  integrations_id UUID,
  crm_integration_id UUID,
  role_template_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
BEGIN
  -- 1️⃣ email → user_id
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_user_email)
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

  -- 3️⃣ Retornar agentes da empresa com API keys
  RETURN QUERY
  SELECT 
    a.id,
    a.nome,
    a.bio,
    a.system_instructions,
    a.primary_language,
    a.provider,
    a.provider_model,
    a.temperature::NUMERIC, -- ✅ Cast explícito
    a.max_tokens,
    COALESCE(ak.api_key, '')::TEXT AS api_key,
    a.integrations_id,
    a.crm_integration_id,
    a.role_template_id,
    COALESCE(a.created_at, NOW())::TIMESTAMPTZ AS created_at, -- ✅ Cast explícito para TIMESTAMPTZ
    COALESCE(a.updated_at, NOW())::TIMESTAMPTZ AS updated_at  -- ✅ Cast explícito para TIMESTAMPTZ
  FROM public.tb_agents a
  LEFT JOIN public.tb_api_keys ak 
    ON ak.companies_id = v_companies_id 
    AND ak.provider = a.provider
  WHERE a.companies_id = v_companies_id -- ✅ Filtro por companies_id
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION public.fn_get_agents_with_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_agents_with_api_key(TEXT) TO anon;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Teste a função:
-- SELECT * FROM fn_get_agents_with_api_key('seu-email@exemplo.com');
