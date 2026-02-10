-- ============================================
-- FUNÇÃO: sp_create_user_with_company
-- ============================================
-- Cria um usuário e opcionalmente uma empresa
-- Se p_company_name for NULL ou vazio, cria apenas o usuário
-- Gera automaticamente um slug para a empresa se fornecida
-- ============================================

CREATE OR REPLACE FUNCTION sp_create_user_with_company(
  p_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_password TEXT,
  p_company_name TEXT DEFAULT NULL -- ✅ Agora é opcional
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
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;

  -- ✅ Empresa agora é opcional, não precisa validar

  -- 2️⃣ Verificar email duplicado
  IF EXISTS (
    SELECT 1
    FROM public.tb_users
    WHERE lower(email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Email já cadastrado';
  END IF;

  -- 3️⃣ Criar usuário
  INSERT INTO public.tb_users (
    name,
    last_name,
    email,
    password,
    created_at
  )
  VALUES (
    trim(p_name),
    trim(p_last_name),
    lower(trim(p_email)),
    p_password,
    now()
  )
  RETURNING id INTO v_user_id;

  -- 4️⃣ Criar empresa APENAS se p_company_name foi fornecido
  IF p_company_name IS NOT NULL AND trim(p_company_name) != '' THEN
    -- 4.1. Gerar slug da empresa
    v_slug := lower(trim(p_company_name));
    v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);

    IF length(v_slug) > 30 THEN
      v_slug := left(v_slug, 30);
    END IF;

    v_final_slug := v_slug;

    -- 4.2. Garantir unicidade do slug
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

    -- 4.3. Criar empresa
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

    -- 4.4. Vincular usuário à empresa (owner)
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

    -- 4.5. Retornar resultado COM empresa
    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'companies_id', v_companies_id,
      'company_slug', v_final_slug,
      'message', 'Usuário e empresa criados com sucesso'
    );
  ELSE
    -- 5️⃣ Retornar resultado SEM empresa
    RETURN jsonb_build_object(
      'success', true,
      'user_id', v_user_id,
      'companies_id', NULL,
      'company_slug', NULL,
      'message', 'Usuário criado com sucesso (sem empresa)'
    );
  END IF;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Email ou slug já cadastrado';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar usuário e empresa: %', SQLERRM;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_create_user_with_company TO authenticated;
GRANT EXECUTE ON FUNCTION sp_create_user_with_company TO anon;
