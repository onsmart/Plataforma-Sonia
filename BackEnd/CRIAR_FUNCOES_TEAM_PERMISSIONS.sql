-- ============================================
-- FUNÇÕES: Sistema de Team e Permissões
-- ============================================
-- Integração com tb_permissions e tb_user_permissions
-- Remove mecânica de "aceitar convite" - apenas vincula se usuário existe
-- ============================================

-- ============================================
-- FUNÇÃO: sp_get_team_members_by_email
-- ============================================
-- Retorna todos os membros do time da empresa do usuário
-- com suas permissões e informações
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_team_members_by_email(
  p_email TEXT
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  email TEXT,
  permission_key TEXT,
  permission_name TEXT,
  permission_category TEXT,
  created_at TIMESTAMPTZ,
  granted_by UUID,
  granted_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
BEGIN
  -- 1. Buscar user_id e company_id
  SELECT u.id, cu.company_id
  INTO v_user_id, v_company_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Retorna todos os membros da empresa com suas permissões
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    COALESCE(u.name || ' ' || u.last_name, u.name, u.email) AS name,
    u.email,
    p.key AS permission_key,
    p.name AS permission_name,
    p.category AS permission_category,
    up.created_at,
    up.granted_by,
    COALESCE(grantor.name || ' ' || grantor.last_name, grantor.name, grantor.email) AS granted_by_name
  FROM public.tb_company_users cu
  INNER JOIN public.tb_users u ON u.id = cu.user_id
  LEFT JOIN public.tb_user_permissions up ON up.user_id = u.id AND up.companies_id = v_company_id
  LEFT JOIN public.tb_permissions p ON p.id = up.permission_id
  LEFT JOIN public.tb_users grantor ON grantor.id = up.granted_by
  WHERE cu.company_id = v_company_id
  ORDER BY u.name, u.email, p.category, p.name;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_add_team_member_by_email
-- ============================================
-- Adiciona um membro ao time vinculando uma permissão
-- Se o usuário não existe, retorna erro
-- Se já tem a permissão, retorna sucesso (idempotente)
-- ============================================

CREATE OR REPLACE FUNCTION sp_add_team_member_by_email(
  p_admin_email TEXT,
  p_member_email TEXT,
  p_permission_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_user_id UUID;
  v_admin_company_id UUID;
  v_member_user_id UUID;
  v_permission_id UUID;
  v_existing_permission_id UUID;
BEGIN
  -- 1. Validar campos
  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RAISE EXCEPTION 'Email do administrador é obrigatório';
  END IF;
  
  IF p_member_email IS NULL OR trim(p_member_email) = '' THEN
    RAISE EXCEPTION 'Email do membro é obrigatório';
  END IF;
  
  IF p_permission_key IS NULL OR trim(p_permission_key) = '' THEN
    RAISE EXCEPTION 'Chave da permissão é obrigatória';
  END IF;

  -- 2. Buscar admin e company_id
  SELECT u.id, cu.company_id
  INTO v_admin_user_id, v_admin_company_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_admin_email)
  LIMIT 1;

  IF v_admin_company_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não encontrado ou não pertence a uma empresa';
  END IF;

  -- 3. Buscar membro (deve existir na base)
  SELECT id INTO v_member_user_id
  FROM public.tb_users
  WHERE lower(email) = lower(p_member_email)
  LIMIT 1;

  IF v_member_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado. O usuário deve estar cadastrado na plataforma primeiro.', p_member_email;
  END IF;

  -- 4. Buscar permission_id pela chave
  SELECT id INTO v_permission_id
  FROM public.tb_permissions
  WHERE key = p_permission_key
  LIMIT 1;

  IF v_permission_id IS NULL THEN
    RAISE EXCEPTION 'Permissão com chave % não encontrada', p_permission_key;
  END IF;

  -- 5. Verificar se membro já pertence à empresa
  -- Se não pertence, adiciona como member
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_company_users
    WHERE company_id = v_admin_company_id
      AND user_id = v_member_user_id
  ) THEN
    INSERT INTO public.tb_company_users (company_id, user_id, role)
    VALUES (v_admin_company_id, v_member_user_id, 'member')
    ON CONFLICT (company_id, user_id) DO UPDATE
    SET role = 'member';
  END IF;

  -- 6. Verificar se já tem a permissão (idempotente)
  SELECT id INTO v_existing_permission_id
  FROM public.tb_user_permissions
  WHERE companies_id = v_admin_company_id
    AND user_id = v_member_user_id
    AND permission_id = v_permission_id;

  IF v_existing_permission_id IS NOT NULL THEN
    -- Já tem a permissão, retorna sucesso
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Membro já possui esta permissão',
      'user_id', v_member_user_id,
      'permission_id', v_permission_id
    );
  END IF;

  -- 7. Adicionar permissão
  INSERT INTO public.tb_user_permissions (
    companies_id,
    user_id,
    permission_id,
    granted_by
  )
  VALUES (
    v_admin_company_id,
    v_member_user_id,
    v_permission_id,
    v_admin_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro adicionado ao time com sucesso',
    'user_id', v_member_user_id,
    'permission_id', v_permission_id,
    'company_id', v_admin_company_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Permissão já concedida a este usuário';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao adicionar membro: %', SQLERRM;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_update_team_member_permission
-- ============================================
-- Atualiza a permissão de um membro do time
-- ============================================

CREATE OR REPLACE FUNCTION sp_update_team_member_permission(
  p_admin_email TEXT,
  p_member_email TEXT,
  p_old_permission_key TEXT,
  p_new_permission_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_user_id UUID;
  v_admin_company_id UUID;
  v_member_user_id UUID;
  v_old_permission_id UUID;
  v_new_permission_id UUID;
BEGIN
  -- 1. Validar campos
  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RAISE EXCEPTION 'Email do administrador é obrigatório';
  END IF;
  
  IF p_member_email IS NULL OR trim(p_member_email) = '' THEN
    RAISE EXCEPTION 'Email do membro é obrigatório';
  END IF;
  
  IF p_old_permission_key IS NULL OR trim(p_old_permission_key) = '' THEN
    RAISE EXCEPTION 'Chave da permissão antiga é obrigatória';
  END IF;
  
  IF p_new_permission_key IS NULL OR trim(p_new_permission_key) = '' THEN
    RAISE EXCEPTION 'Chave da permissão nova é obrigatória';
  END IF;

  -- 2. Buscar admin e company_id
  SELECT u.id, cu.company_id
  INTO v_admin_user_id, v_admin_company_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_admin_email)
  LIMIT 1;

  IF v_admin_company_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não encontrado ou não pertence a uma empresa';
  END IF;

  -- 3. Buscar membro
  SELECT id INTO v_member_user_id
  FROM public.tb_users
  WHERE lower(email) = lower(p_member_email)
  LIMIT 1;

  IF v_member_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  -- 4. Buscar permission_ids
  SELECT id INTO v_old_permission_id
  FROM public.tb_permissions
  WHERE key = p_old_permission_key
  LIMIT 1;

  IF v_old_permission_id IS NULL THEN
    RAISE EXCEPTION 'Permissão antiga não encontrada';
  END IF;

  SELECT id INTO v_new_permission_id
  FROM public.tb_permissions
  WHERE key = p_new_permission_key
  LIMIT 1;

  IF v_new_permission_id IS NULL THEN
    RAISE EXCEPTION 'Permissão nova não encontrada';
  END IF;

  -- 5. Remover permissão antiga
  DELETE FROM public.tb_user_permissions
  WHERE companies_id = v_admin_company_id
    AND user_id = v_member_user_id
    AND permission_id = v_old_permission_id;

  -- 6. Adicionar permissão nova (se não existir)
  INSERT INTO public.tb_user_permissions (
    companies_id,
    user_id,
    permission_id,
    granted_by
  )
  VALUES (
    v_admin_company_id,
    v_member_user_id,
    v_new_permission_id,
    v_admin_user_id
  )
  ON CONFLICT (companies_id, user_id, permission_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Permissão atualizada com sucesso',
    'user_id', v_member_user_id,
    'old_permission_id', v_old_permission_id,
    'new_permission_id', v_new_permission_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao atualizar permissão: %', SQLERRM;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_remove_team_member
-- ============================================
-- Remove um membro do time (remove todas as permissões)
-- ============================================

CREATE OR REPLACE FUNCTION sp_remove_team_member(
  p_admin_email TEXT,
  p_member_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_company_id UUID;
  v_member_user_id UUID;
BEGIN
  -- 1. Validar campos
  IF p_admin_email IS NULL OR trim(p_admin_email) = '' THEN
    RAISE EXCEPTION 'Email do administrador é obrigatório';
  END IF;
  
  IF p_member_email IS NULL OR trim(p_member_email) = '' THEN
    RAISE EXCEPTION 'Email do membro é obrigatório';
  END IF;

  -- 2. Buscar admin e company_id
  SELECT cu.company_id
  INTO v_admin_company_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_admin_email)
  LIMIT 1;

  IF v_admin_company_id IS NULL THEN
    RAISE EXCEPTION 'Administrador não encontrado ou não pertence a uma empresa';
  END IF;

  -- 3. Buscar membro
  SELECT id INTO v_member_user_id
  FROM public.tb_users
  WHERE lower(email) = lower(p_member_email)
  LIMIT 1;

  IF v_member_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  -- 4. Remover todas as permissões do membro na empresa
  DELETE FROM public.tb_user_permissions
  WHERE companies_id = v_admin_company_id
    AND user_id = v_member_user_id;

  -- 5. Remover membro da empresa (cascade remove permissões também)
  DELETE FROM public.tb_company_users
  WHERE company_id = v_admin_company_id
    AND user_id = v_member_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro removido do time com sucesso',
    'user_id', v_member_user_id,
    'company_id', v_admin_company_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao remover membro: %', SQLERRM;
END;
$$;

-- ============================================
-- FUNÇÃO: sp_get_available_permissions
-- ============================================
-- Retorna todas as permissões disponíveis
-- ============================================

CREATE OR REPLACE FUNCTION sp_get_available_permissions()
RETURNS TABLE (
  id UUID,
  key TEXT,
  name TEXT,
  description TEXT,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.key,
    p.name,
    p.description,
    p.category
  FROM public.tb_permissions p
  ORDER BY p.category, p.name;
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_get_team_members_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_team_members_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_add_team_member_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION sp_add_team_member_by_email TO anon;
GRANT EXECUTE ON FUNCTION sp_update_team_member_permission TO authenticated;
GRANT EXECUTE ON FUNCTION sp_update_team_member_permission TO anon;
GRANT EXECUTE ON FUNCTION sp_remove_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION sp_remove_team_member TO anon;
GRANT EXECUTE ON FUNCTION sp_get_available_permissions TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_available_permissions TO anon;
