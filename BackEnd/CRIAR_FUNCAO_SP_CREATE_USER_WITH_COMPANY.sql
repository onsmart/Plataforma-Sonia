-- ============================================
-- FUNÇÃO: sp_create_user_with_company
-- ============================================
-- Cria um usuário, uma empresa e o relacionamento
-- Gera automaticamente um slug para a empresa
-- ============================================

CREATE OR REPLACE FUNCTION sp_create_user_with_company(
  p_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_company_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_slug TEXT;
  v_slug_suffix TEXT;
  v_final_slug TEXT;
  v_slug_exists BOOLEAN;
BEGIN
  -- 1. Validar campos obrigatórios
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;
  
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;
  
  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;

  -- 2. Verificar se o email já existe
  IF EXISTS (SELECT 1 FROM public.tb_users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'Email já cadastrado';
  END IF;

  -- 3. Criar usuário na tabela tb_users
  INSERT INTO public.tb_users (
    name,
    last_name,
    email,
    password
  )
  VALUES (
    trim(p_name),
    trim(p_last_name),
    lower(trim(p_email)),
    p_password
  )
  RETURNING id INTO v_user_id;

  -- 4. Gerar slug único para a empresa
  -- Formato: nome-empresa-abc123 (normalizado + sufixo aleatório)
  v_slug := lower(trim(p_company_name));
  -- Remove caracteres especiais e espaços, substitui por hífen
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  -- Remove hífens no início e fim
  v_slug := trim(both '-' from v_slug);
  -- Limita tamanho (deixa espaço para sufixo)
  IF length(v_slug) > 30 THEN
    v_slug := left(v_slug, 30);
  END IF;
  
  -- Tentar usar o slug base, se já existir, adiciona sufixo aleatório
  v_final_slug := v_slug;
  v_slug_exists := EXISTS (SELECT 1 FROM public.tb_companies WHERE slug = v_final_slug);
  
  -- Se o slug já existe, adiciona sufixo aleatório
  WHILE v_slug_exists LOOP
    v_slug_suffix := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    v_final_slug := v_slug || '-' || v_slug_suffix;
    v_slug_exists := EXISTS (SELECT 1 FROM public.tb_companies WHERE slug = v_final_slug);
  END LOOP;

  -- 5. Criar empresa na tabela tb_companies
  INSERT INTO public.tb_companies (
    name,
    slug,
    status
  )
  VALUES (
    trim(p_company_name),
    v_final_slug,
    'active'
  )
  RETURNING id INTO v_company_id;

  -- 6. Criar relacionamento na tabela tb_company_users com role 'owner'
  INSERT INTO public.tb_company_users (
    company_id,
    user_id,
    role
  )
  VALUES (
    v_company_id,
    v_user_id,
    'owner'
  );

  -- 7. Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'company_id', v_company_id,
    'company_slug', v_final_slug,
    'message', 'Usuário e empresa criados com sucesso'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email ou slug já cadastrado';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar usuário: %', SQLERRM;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_create_user_with_company TO authenticated;
GRANT EXECUTE ON FUNCTION sp_create_user_with_company TO anon;
