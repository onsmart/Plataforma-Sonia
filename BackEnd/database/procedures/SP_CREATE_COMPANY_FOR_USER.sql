-- Cria workspace para usuário já existente em tb_users (ex.: login sem empresa).
CREATE OR REPLACE FUNCTION public.sp_create_company_for_user(
  p_user_email text,
  p_company_name text,
  p_account_type text DEFAULT 'company',
  p_document text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_email text;
  v_company_name text;
  v_slug_base text;
  v_slug text;
  v_account_type text;
  v_document text;
BEGIN
  v_email := lower(trim(p_user_email));
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'E-mail obrigatório');
  END IF;

  v_account_type := lower(trim(coalesce(p_account_type, 'company')));
  IF v_account_type NOT IN ('individual', 'company') THEN
    v_account_type := 'company';
  END IF;

  SELECT id INTO v_user_id
  FROM public.tb_users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado na plataforma. Faça o cadastro completo ou contate o suporte.'
    );
  END IF;

  SELECT cu.companies_id INTO v_company_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'companies_id', v_company_id,
      'message', 'Workspace já configurado'
    );
  END IF;

  IF v_account_type = 'company' AND coalesce(trim(p_company_name), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome da empresa é obrigatório para pessoa jurídica');
  END IF;

  IF v_account_type = 'individual' THEN
    SELECT trim(coalesce(u.name, '') || ' ' || coalesce(u.last_name, ''))
    INTO v_company_name
    FROM public.tb_users u
    WHERE u.id = v_user_id;
    v_company_name := coalesce(nullif(trim(v_company_name), ''), nullif(trim(p_company_name), ''), 'Minha conta');
  ELSE
    v_company_name := trim(p_company_name);
  END IF;

  v_document := regexp_replace(coalesce(p_document, ''), '\D', '', 'g');

  IF v_account_type = 'individual' THEN
    IF length(v_document) <> 11 THEN
      RETURN jsonb_build_object('success', false, 'error', 'CPF é obrigatório e deve ter 11 dígitos');
    END IF;
  ELSE
    IF length(v_document) <> 14 THEN
      RETURN jsonb_build_object('success', false, 'error', 'CNPJ é obrigatório e deve ter 14 dígitos');
    END IF;
  END IF;

  v_slug_base := lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := trim(both '-' from v_slug_base);
  IF length(v_slug_base) < 2 THEN
    v_slug_base := 'conta';
  END IF;
  v_slug := v_slug_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.tb_companies (id, name, slug, account_type, document)
  VALUES (gen_random_uuid(), v_company_name, v_slug, v_account_type, v_document)
  RETURNING id INTO v_company_id;

  INSERT INTO public.tb_company_users (user_id, companies_id, role, status)
  VALUES (v_user_id, v_company_id, 'owner', 'active');

  RETURN jsonb_build_object(
    'success', true,
    'companies_id', v_company_id,
    'account_type', v_account_type,
    'company_name', v_company_name,
    'message', 'Workspace criado com sucesso'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sp_create_company_for_user(text, text, text, text) TO anon, authenticated, service_role;
