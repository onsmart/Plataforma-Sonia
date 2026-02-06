-- ============================================
-- FUNÇÃO: sp_create_agent_by_email
-- ============================================
-- Cria um agente baseado em um template (role_template)
-- Busca as configurações do template e cria o agente completo
-- ============================================

CREATE OR REPLACE FUNCTION public.sp_create_agent_by_email(
  p_email TEXT,
  p_nome TEXT,
  p_role_template_id UUID,
  p_primary_language TEXT DEFAULT 'EN',
  p_bio TEXT DEFAULT NULL,
  p_integrations_id UUID DEFAULT NULL,
  p_crm_integration_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_agent_id UUID;
  v_template RECORD;
  v_api_key TEXT;
  v_system_instructions TEXT;
  v_provider TEXT;
  v_provider_model TEXT;
  v_temperature NUMERIC;
  v_max_tokens INTEGER;
BEGIN
  -- 1. Busca o user_id pelo email
  SELECT id INTO v_user_id
  FROM public.tb_users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', p_email;
  END IF;

  -- 2. Busca o template para pegar as configurações padrão
  SELECT 
    rt.id,
    rt.system_instructions,
    rt.provider,
    rt.provider_model,
    rt.temperature,
    rt.max_tokens,
    rt.api_key
  INTO v_template
  FROM public.tb_role_templates rt
  WHERE rt.id = p_role_template_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template com ID % não encontrado', p_role_template_id;
  END IF;

  -- 3. Define valores padrão a partir do template
  v_system_instructions := COALESCE(v_template.system_instructions, 'Você é um assistente útil e prestativo.');
  v_provider := COALESCE(v_template.provider, 'openai');
  v_provider_model := COALESCE(v_template.provider_model, 'gpt-4o-mini');
  v_temperature := COALESCE(v_template.temperature, 0.7);
  v_max_tokens := COALESCE(v_template.max_tokens, 1000);

  -- 4. Busca API key do usuário se não tiver no template
  IF v_template.api_key IS NULL OR v_template.api_key = '' THEN
    SELECT api_key INTO v_api_key
    FROM public.tb_users
    WHERE id = v_user_id;
  ELSE
    v_api_key := v_template.api_key;
  END IF;

  -- 5. Cria o agente com todas as configurações
  INSERT INTO public.tb_agents (
    user_id,
    nome,
    role_template_id,
    primary_language,
    bio,
    system_instructions,
    provider,
    provider_model,
    temperature,
    max_tokens,
    api_key,
    integrations_id,
    crm_integration_id,
    status_id,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_nome,
    p_role_template_id,
    p_primary_language,
    COALESCE(p_bio, ''),
    v_system_instructions,
    v_provider,
    v_provider_model,
    v_temperature,
    v_max_tokens,
    v_api_key,
    p_integrations_id,
    p_crm_integration_id,
    1, -- status_id = 1 (ativo)
    NOW(),
    NOW()
  )
  RETURNING id INTO v_agent_id;

  RETURN v_agent_id;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
-- Garantir que usuários autenticados possam executar
GRANT EXECUTE ON FUNCTION public.sp_create_agent_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_create_agent_by_email TO anon;

-- ============================================
-- COMENTÁRIO DA FUNÇÃO
-- ============================================
COMMENT ON FUNCTION public.sp_create_agent_by_email IS 
'Cria um novo agente baseado em um template. Busca as configurações do template (system_instructions, provider, model, etc) e cria o agente com status_id = 1 (ativo).';
