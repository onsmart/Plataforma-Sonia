-- ============================================
-- FUNÇÃO: sp_create_company_for_user
-- ============================================
-- Cria uma empresa e vincula ao usuário existente como owner
-- Usado quando usuário não tem empresa e precisa criar uma
-- ============================================

CREATE OR REPLACE FUNCTION sp_create_company_for_user(
  p_user_email TEXT,
  p_company_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_slug TEXT;
  v_slug_suffix TEXT;
  v_final_slug TEXT;
BEGIN
  -- 1️⃣ Validações
  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;

  IF p_user_email IS NULL OR trim(p_user_email) = '' THEN
    RAISE EXCEPTION 'Email do usuário é obrigatório';
  END IF;

  -- 2️⃣ Buscar user_id pelo email
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(trim(p_user_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- 3️⃣ Verificar se usuário já tem empresa
  IF EXISTS (
    SELECT 1
    FROM public.tb_company_users cu
    WHERE cu.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário já possui uma empresa vinculada';
  END IF;

  -- 4️⃣ Gerar slug da empresa
  v_slug := lower(trim(p_company_name));
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  IF length(v_slug) > 30 THEN
    v_slug := left(v_slug, 30);
  END IF;

  v_final_slug := v_slug;

  -- 5️⃣ Garantir unicidade do slug
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.tb_companies WHERE slug = v_final_slug
    );

    v_slug_suffix := substring(
      md5(random()::text || clock_timestamp()::text)
      FROM 1 FOR 6
    );

    v_final_slug := v_slug || '-' || v_slug_suffix;
  END LOOP;

  -- 6️⃣ Criar empresa
  INSERT INTO public.tb_companies (
    name,
    slug,
    status,
    created_at,
    updated_at
  )
  VALUES (
    trim(p_company_name),
    v_final_slug,
    'active',
    now(),
    now()
  )
  RETURNING id INTO v_companies_id;

  -- 7️⃣ Vincular usuário à empresa (owner)
  INSERT INTO public.tb_company_users (
    companies_id,
    user_id,
    role,
    created_at
  )
  VALUES (
    v_companies_id,
    v_user_id,
    'owner',
    now()
  );

  -- 8️⃣ Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'companies_id', v_companies_id,
    'company_slug', v_final_slug,
    'message', 'Empresa criada e vinculada com sucesso'
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Slug já cadastrado';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar empresa: %', SQLERRM;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_create_company_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION sp_create_company_for_user TO anon;
