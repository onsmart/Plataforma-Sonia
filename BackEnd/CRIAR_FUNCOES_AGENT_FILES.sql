-- ============================================
-- FUNÇÕES: Gerenciamento de Arquivos por Agente
-- ============================================
-- Sistema para vincular arquivos da Knowledge Base aos agentes
-- ============================================

-- 1️⃣ Listar arquivos vinculados a um agente
CREATE OR REPLACE FUNCTION sp_get_agent_files(
  p_email TEXT,
  p_agent_id UUID
)
RETURNS TABLE (
  file_id UUID,
  original_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ
)
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
    RETURN;
  END IF;

  -- 2️⃣ Verificar se o agente pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_agents
    WHERE id = p_agent_id
      AND companies_id = v_companies_id
  ) THEN
    RAISE EXCEPTION 'Agente não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Retornar arquivos vinculados ao agente
  RETURN QUERY
  SELECT 
    f.id AS file_id,
    f.original_name,
    f.mime_type,
    f.size_bytes,
    f.created_at
  FROM public.tb_agent_files af
  INNER JOIN public.tb_files f ON f.id = af.file_id
  WHERE af.agent_id = p_agent_id
    AND f.companies_id = v_companies_id
    AND f.is_deleted = false
  ORDER BY f.original_name;
END;
$$;

-- 2️⃣ Vincular arquivos a um agente
CREATE OR REPLACE FUNCTION sp_link_agent_files(
  p_email TEXT,
  p_agent_id UUID,
  p_file_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_file_id UUID;
  v_linked_count INTEGER := 0;
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

  -- 2️⃣ Verificar se o agente pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_agents
    WHERE id = p_agent_id
      AND companies_id = v_companies_id
  ) THEN
    RAISE EXCEPTION 'Agente não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Vincular cada arquivo (ignorar duplicatas)
  FOREACH v_file_id IN ARRAY p_file_ids
  LOOP
    -- Verificar se arquivo pertence à empresa e não está deletado
    IF EXISTS (
      SELECT 1 FROM public.tb_files
      WHERE id = v_file_id
        AND companies_id = v_companies_id
        AND is_deleted = false
    ) THEN
      -- Verificar se já existe antes de inserir
      IF NOT EXISTS (
        SELECT 1 FROM public.tb_agent_files
        WHERE agent_id = p_agent_id AND file_id = v_file_id
      ) THEN
        -- Inserir vínculo
        INSERT INTO public.tb_agent_files (agent_id, file_id, companies_id)
        VALUES (p_agent_id, v_file_id, v_companies_id);
        
        v_linked_count := v_linked_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'linked_count', v_linked_count,
    'message', format('%s arquivo(s) vinculado(s) ao agente', v_linked_count)
  );
END;
$$;

-- 3️⃣ Desvincular arquivos de um agente
CREATE OR REPLACE FUNCTION sp_unlink_agent_files(
  p_email TEXT,
  p_agent_id UUID,
  p_file_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_unlinked_count INTEGER;
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

  -- 2️⃣ Verificar se o agente pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_agents
    WHERE id = p_agent_id
      AND companies_id = v_companies_id
  ) THEN
    RAISE EXCEPTION 'Agente não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Desvincular arquivos
  DELETE FROM public.tb_agent_files
  WHERE agent_id = p_agent_id
    AND file_id = ANY(p_file_ids)
    AND companies_id = v_companies_id;

  GET DIAGNOSTICS v_unlinked_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'unlinked_count', v_unlinked_count,
    'message', format('%s arquivo(s) desvinculado(s) do agente', v_unlinked_count)
  );
END;
$$;

-- 4️⃣ Substituir todos os arquivos de um agente (remove antigos e adiciona novos)
CREATE OR REPLACE FUNCTION sp_replace_agent_files(
  p_email TEXT,
  p_agent_id UUID,
  p_file_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_companies_id UUID;
  v_removed_count INTEGER;
  v_added_count INTEGER := 0;
  v_file_id UUID;
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

  -- 2️⃣ Verificar se o agente pertence à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_agents
    WHERE id = p_agent_id
      AND companies_id = v_companies_id
  ) THEN
    RAISE EXCEPTION 'Agente não encontrado ou não pertence à empresa';
  END IF;

  -- 3️⃣ Remover todos os vínculos antigos
  DELETE FROM public.tb_agent_files
  WHERE agent_id = p_agent_id
    AND companies_id = v_companies_id;

  GET DIAGNOSTICS v_removed_count = ROW_COUNT;

  -- 4️⃣ Adicionar novos vínculos
  IF p_file_ids IS NOT NULL AND array_length(p_file_ids, 1) > 0 THEN
    FOREACH v_file_id IN ARRAY p_file_ids
    LOOP
      -- Verificar se arquivo pertence à empresa e não está deletado
      IF EXISTS (
        SELECT 1 FROM public.tb_files
        WHERE id = v_file_id
          AND companies_id = v_companies_id
          AND is_deleted = false
      ) THEN
        INSERT INTO public.tb_agent_files (agent_id, file_id, companies_id)
        VALUES (p_agent_id, v_file_id, v_companies_id)
        ON CONFLICT (agent_id, file_id) DO NOTHING;
        
        v_added_count := v_added_count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'removed_count', v_removed_count,
    'added_count', v_added_count,
    'message', format('%s arquivo(s) removido(s), %s arquivo(s) adicionado(s)', v_removed_count, v_added_count)
  );
END;
$$;

-- ============================================
-- PERMISSÕES
-- ============================================
GRANT EXECUTE ON FUNCTION sp_get_agent_files(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_get_agent_files(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION sp_link_agent_files(TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_link_agent_files(TEXT, UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION sp_unlink_agent_files(TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_unlink_agent_files(TEXT, UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION sp_replace_agent_files(TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION sp_replace_agent_files(TEXT, UUID, UUID[]) TO anon;
