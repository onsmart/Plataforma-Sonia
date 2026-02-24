-- ============================================
-- FUNÇÕES: Gerenciamento de Arquivos (RAG/Knowledge Base)
-- ============================================
-- Sistema de arquivos multi-tenant com soft delete
-- ============================================

-- 1️⃣ Listar arquivos da empresa
CREATE OR REPLACE FUNCTION sp_list_files_by_email(
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  companies_id UUID,
  uploader_id UUID,
  bucket TEXT,
  path TEXT,
  original_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  is_system BOOLEAN,
  is_deleted BOOLEAN,
  created_at TIMESTAMPTZ,
  uploader_name TEXT
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

  -- 3️⃣ Retornar arquivos da empresa (não deletados)
  RETURN QUERY
  SELECT 
    f.id,
    f.companies_id,
    f.uploader_id,
    f.bucket,
    f.path,
    f.original_name,
    f.mime_type,
    f.size_bytes,
    f.is_system,
    f.is_deleted,
    f.created_at,
    COALESCE(u.name || ' ' || u.last_name, u.name, u.email) AS uploader_name
  FROM public.tb_files f
  INNER JOIN public.tb_users u ON u.id = f.uploader_id
  WHERE f.companies_id = v_companies_id
    AND f.is_deleted = false
  ORDER BY f.created_at DESC;
END;
$$;

-- 2️⃣ Criar registro de arquivo
CREATE OR REPLACE FUNCTION sp_create_file(
  p_email TEXT,
  p_bucket TEXT,
  p_path TEXT,
  p_original_name TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_file_id UUID;
BEGIN
  -- 1️⃣ email → user_id
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- 2️⃣ user_id → companies_id
  SELECT cu.companies_id
  INTO v_companies_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;

  -- 3️⃣ Criar registro do arquivo
  INSERT INTO public.tb_files (
    companies_id,
    uploader_id,
    bucket,
    path,
    original_name,
    mime_type,
    size_bytes,
    is_system,
    is_deleted
  )
  VALUES (
    v_companies_id,
    v_user_id,
    p_bucket,
    p_path,
    p_original_name,
    p_mime_type,
    p_size_bytes,
    false,
    false
  )
  ON CONFLICT (companies_id, path) DO UPDATE
  SET 
    original_name = EXCLUDED.original_name,
    mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    is_deleted = false
  RETURNING id INTO v_file_id;

  RETURN v_file_id;
END;
$$;

-- 3️⃣ Soft delete de arquivo
CREATE OR REPLACE FUNCTION sp_delete_file(
  p_email TEXT,
  p_file_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_file_record RECORD;
BEGIN
  -- 1️⃣ email → user_id → companies_id
  SELECT u.id, cu.companies_id
  INTO v_user_id, v_companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RAISE EXCEPTION 'Usuário ou empresa não encontrados';
  END IF;

  -- 2️⃣ Buscar arquivo
  SELECT * INTO v_file_record
  FROM public.tb_files
  WHERE id = p_file_id
    AND companies_id = v_companies_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arquivo não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Verificar se é arquivo do sistema
  IF v_file_record.is_system = true THEN
    RAISE EXCEPTION 'Arquivos do sistema não podem ser deletados';
  END IF;

  -- 4️⃣ Verificar se está em uso
  IF EXISTS (
    SELECT 1 FROM public.tb_agent_files
    WHERE file_id = p_file_id
  ) OR EXISTS (
    SELECT 1 FROM public.tb_file_usage
    WHERE file_id = p_file_id
  ) THEN
    -- Soft delete apenas
    UPDATE public.tb_files
    SET is_deleted = true
    WHERE id = p_file_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Arquivo marcado como deletado (soft delete)',
      'can_delete_physically', false
    );
  ELSE
    -- Pode deletar fisicamente (soft delete primeiro)
    UPDATE public.tb_files
    SET is_deleted = true
    WHERE id = p_file_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Arquivo marcado para exclusão física',
      'can_delete_physically', true,
      'path', v_file_record.path,
      'bucket', v_file_record.bucket
    );
  END IF;
END;
$$;

-- 4️⃣ Estatísticas de uso (quota)
CREATE OR REPLACE FUNCTION sp_get_file_usage_stats_by_email(
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_total_size BIGINT;
  v_file_count BIGINT;
  v_deleted_count BIGINT;
BEGIN
  -- 1️⃣ email → user_id → companies_id
  SELECT u.id, cu.companies_id
  INTO v_user_id, v_companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_size_bytes', 0,
      'total_files', 0,
      'deleted_files', 0,
      'storage_used_mb', 0,
      'storage_limit_mb', 1024
    );
  END IF;

  -- 2️⃣ Calcular estatísticas
  SELECT 
    COALESCE(SUM(size_bytes), 0),
    COUNT(*) FILTER (WHERE is_deleted = false),
    COUNT(*) FILTER (WHERE is_deleted = true)
  INTO v_total_size, v_file_count, v_deleted_count
  FROM public.tb_files
  WHERE companies_id = v_companies_id;

  RETURN jsonb_build_object(
    'total_size_bytes', v_total_size,
    'total_files', v_file_count,
    'deleted_files', v_deleted_count,
    'storage_used_mb', ROUND(v_total_size::NUMERIC / 1024 / 1024, 2),
    'storage_limit_mb', 1024, -- 1GB limite
    'storage_used_percent', ROUND((v_total_size::NUMERIC / 1024 / 1024 / 1024 * 100)::NUMERIC, 1)
  );
END;
$$;

-- 5️⃣ Atualizar configurações do arquivo
CREATE OR REPLACE FUNCTION sp_update_file_config(
  p_email TEXT,
  p_file_id UUID,
  p_is_deleted BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
BEGIN
  -- 1️⃣ email → user_id → companies_id
  SELECT u.id, cu.companies_id
  INTO v_user_id, v_companies_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RAISE EXCEPTION 'Usuário ou empresa não encontrados';
  END IF;

  -- 2️⃣ Verificar se arquivo pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_files
    WHERE id = p_file_id
      AND companies_id = v_companies_id
  ) THEN
    RAISE EXCEPTION 'Arquivo não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Atualizar configurações
  UPDATE public.tb_files
  SET 
    is_deleted = COALESCE(p_is_deleted, is_deleted)
  WHERE id = p_file_id
    AND companies_id = v_companies_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Configurações atualizadas com sucesso'
  );
END;
$$;

-- 6️⃣ Listar arquivos deletados que podem ser removidos fisicamente (apenas admin)
CREATE OR REPLACE FUNCTION sp_list_deleted_files_for_cleanup(
  p_email TEXT
)
RETURNS TABLE (
  id UUID,
  bucket TEXT,
  path TEXT,
  original_name TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_user_role TEXT;
  v_has_admin_permission BOOLEAN := false;
BEGIN
  -- 1️⃣ email → user_id → companies_id + role
  SELECT u.id, cu.companies_id, cu.role
  INTO v_user_id, v_companies_id, v_user_role
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RETURN;
  END IF;

  -- 2️⃣ Verificar se é admin ou owner pelo role
  IF v_user_role IN ('owner', 'admin') THEN
    -- Já é admin pelo role, pode continuar
  ELSE
    -- 3️⃣ Verificar se tem permissão basic.admin
    SELECT EXISTS (
      SELECT 1
      FROM public.tb_user_permissions up
      INNER JOIN public.tb_permissions p ON p.id = up.permission_id
      WHERE up.user_id = v_user_id
        AND up.companies_id = v_companies_id
        AND p.key = 'basic.admin'
    ) INTO v_has_admin_permission;

    IF NOT v_has_admin_permission THEN
      RAISE EXCEPTION 'Apenas administradores podem executar esta ação';
    END IF;
  END IF;

  -- 3️⃣ Retornar TODOS os arquivos deletados que não são do sistema
  RETURN QUERY
  SELECT 
    f.id,
    f.bucket,
    f.path,
    f.original_name,
    f.size_bytes,
    f.created_at
  FROM public.tb_files f
  WHERE f.companies_id = v_companies_id
    AND f.is_deleted = true
    AND f.is_system = false
  ORDER BY f.created_at DESC;
END;
$$;

-- 7️⃣ Deletar fisicamente arquivos deletados (apenas admin)
CREATE OR REPLACE FUNCTION sp_permanently_delete_files(
  p_email TEXT,
  p_file_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_user_role TEXT;
  v_has_admin_permission BOOLEAN := false;
  v_deleted_count INTEGER := 0;
  v_file_record RECORD;
  v_files_to_delete TEXT[];
BEGIN
  -- 1️⃣ email → user_id → companies_id + role
  SELECT u.id, cu.companies_id, cu.role
  INTO v_user_id, v_companies_id, v_user_role
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_companies_id IS NULL THEN
    RAISE EXCEPTION 'Usuário ou empresa não encontrados';
  END IF;

  -- 2️⃣ Verificar se é admin ou owner pelo role
  IF v_user_role IN ('owner', 'admin') THEN
    -- Já é admin pelo role, pode continuar
  ELSE
    -- 3️⃣ Verificar se tem permissão basic.admin
    SELECT EXISTS (
      SELECT 1
      FROM public.tb_user_permissions up
      INNER JOIN public.tb_permissions p ON p.id = up.permission_id
      WHERE up.user_id = v_user_id
        AND up.companies_id = v_companies_id
        AND p.key = 'basic.admin'
    ) INTO v_has_admin_permission;

    IF NOT v_has_admin_permission THEN
      RAISE EXCEPTION 'Apenas administradores podem executar esta ação';
    END IF;
  END IF;

  -- 3️⃣ Verificar e coletar TODOS os arquivos deletados que não são do sistema
  FOR v_file_record IN
    SELECT f.id, f.bucket, f.path
    FROM public.tb_files f
    WHERE f.id = ANY(p_file_ids)
      AND f.companies_id = v_companies_id
      AND f.is_deleted = true
      AND f.is_system = false
  LOOP
    -- Adicionar path à lista para deletar do storage
    v_files_to_delete := array_append(v_files_to_delete, v_file_record.path);
    
    -- Deletar do banco
    DELETE FROM public.tb_files
    WHERE id = v_file_record.id;
    
    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  -- 4️⃣ Retornar resultado com paths para deletar do storage
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'files_to_delete_from_storage', v_files_to_delete,
    'bucket', 'sonia-kb',
    'message', format('%s arquivo(s) deletado(s) permanentemente', v_deleted_count)
  );
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_list_files_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_list_files_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sp_create_file(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_create_file(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION sp_delete_file(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_delete_file(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION sp_get_file_usage_stats_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_file_usage_stats_by_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sp_update_file_config(TEXT, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_update_file_config(TEXT, UUID, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION sp_list_deleted_files_for_cleanup(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_list_deleted_files_for_cleanup(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION sp_permanently_delete_files(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_permanently_delete_files(TEXT, UUID[]) TO anon;