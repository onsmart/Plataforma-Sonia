-- Evolução KB: file_purpose + readiness em sp_get_agent_files; is_ready em sp_list_files_by_email
BEGIN;

DROP FUNCTION IF EXISTS public.sp_get_agent_files(uuid, text);
DROP FUNCTION IF EXISTS public.sp_get_agent_files(text, uuid);

CREATE OR REPLACE FUNCTION public.sp_get_agent_files(
  p_email text,
  p_agent_id uuid
)
RETURNS TABLE (
  file_id uuid,
  original_name text,
  file_purpose text,
  is_ready boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT cu.companies_id
  INTO v_company_id
  FROM public.tb_users u
  JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tb_agents a
    WHERE a.id = p_agent_id AND a.companies_id = v_company_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id AS file_id,
    f.original_name,
    COALESCE(f.file_purpose, 'rag'::text) AS file_purpose,
    CASE
      WHEN COALESCE(f.file_purpose, 'rag') = 'skills' THEN
        EXISTS (
          SELECT 1 FROM public.tb_file_skills sk
          WHERE sk.file_id = f.id AND sk.companies_id = v_company_id
        )
      ELSE
        EXISTS (
          SELECT 1 FROM public.tb_file_sections sec
          WHERE sec.file_id = f.id AND sec.companies_id = v_company_id
        )
    END AS is_ready
  FROM public.tb_agent_files af
  JOIN public.tb_files f ON f.id = af.file_id
  WHERE af.agent_id = p_agent_id
    AND af.companies_id = v_company_id
    AND COALESCE(f.is_deleted, false) = false
  ORDER BY f.original_name ASC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.sp_get_agent_files(text, uuid) IS
  'Arquivos vinculados ao agente com file_purpose e flag is_ready (indexado/extraído).';

GRANT EXECUTE ON FUNCTION public.sp_get_agent_files(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_agent_files(text, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.sp_list_files_by_email(text);

CREATE OR REPLACE FUNCTION public.sp_list_files_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  original_name text,
  size_bytes bigint,
  mime_type text,
  is_deleted boolean,
  created_at timestamptz,
  file_purpose text,
  is_ready boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT cu.companies_id
  INTO v_company_id
  FROM public.tb_users u
  JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.original_name,
    f.size_bytes,
    f.mime_type,
    COALESCE(f.is_deleted, false),
    f.created_at,
    COALESCE(f.file_purpose, 'rag'::text),
    CASE
      WHEN COALESCE(f.file_purpose, 'rag') = 'skills' THEN
        EXISTS (
          SELECT 1 FROM public.tb_file_skills sk
          WHERE sk.file_id = f.id AND sk.companies_id = v_company_id
        )
      ELSE
        EXISTS (
          SELECT 1 FROM public.tb_file_sections sec
          WHERE sec.file_id = f.id AND sec.companies_id = v_company_id
        )
    END AS is_ready
  FROM public.tb_files f
  WHERE f.companies_id = v_company_id
  ORDER BY f.created_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.sp_list_files_by_email(text) IS
  'Lista arquivos da empresa; inclui file_purpose e is_ready (processado).';

GRANT EXECUTE ON FUNCTION public.sp_list_files_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_list_files_by_email(text) TO service_role;

COMMIT;
