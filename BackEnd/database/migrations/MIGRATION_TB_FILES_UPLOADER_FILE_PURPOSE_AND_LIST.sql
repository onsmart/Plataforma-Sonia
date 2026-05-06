-- =============================================================================
-- Correção: uploader_id NOT NULL em tb_files + finalidade RAG vs Skills
-- =============================================================================
-- Rode no SQL Editor do Supabase (produção/staging) uma vez.
--
-- 1) sp_create_file passa a gravar uploader_id (= usuário do email) e file_purpose.
-- 2) Coluna file_purpose: 'rag' | 'skills' (default 'rag' para linhas antigas).
-- 3) sp_list_files_by_email retorna file_purpose para a UI separar listas.
--
-- Se sp_list_files_by_email já existir com outra assinatura, ajuste ou remova
-- o DROP abaixo antes de rodar.
-- =============================================================================

BEGIN;

ALTER TABLE public.tb_files
  ADD COLUMN IF NOT EXISTS file_purpose text NOT NULL DEFAULT 'rag'
  CONSTRAINT tb_files_file_purpose_check CHECK (file_purpose IN ('rag', 'skills'));

COMMENT ON COLUMN public.tb_files.file_purpose IS 'rag: chunks/embeddings; skills: extração para tb_file_skills';

UPDATE public.tb_files SET file_purpose = 'rag' WHERE file_purpose IS NULL;

DROP FUNCTION IF EXISTS public.sp_create_file(text, text, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.sp_create_file(text, text, text, text, text, bigint, text);

CREATE OR REPLACE FUNCTION public.sp_create_file(
  p_email text,
  p_bucket text,
  p_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_file_purpose text DEFAULT 'rag'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_file_id uuid;
  v_purpose text;
BEGIN
  v_purpose := lower(trim(COALESCE(p_file_purpose, 'rag')));
  IF v_purpose NOT IN ('rag', 'skills') THEN
    v_purpose := 'rag';
  END IF;

  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado para o email informado';
  END IF;

  SELECT cu.companies_id
  INTO v_company_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;

  INSERT INTO public.tb_files (
    id,
    companies_id,
    uploader_id,
    bucket,
    path,
    original_name,
    mime_type,
    size_bytes,
    is_deleted,
    file_purpose
  )
  VALUES (
    gen_random_uuid(),
    v_company_id,
    v_user_id,
    p_bucket,
    p_path,
    p_original_name,
    p_mime_type,
    COALESCE(p_size_bytes, 0),
    false,
    v_purpose::text
  )
  RETURNING id INTO v_file_id;

  RETURN v_file_id;
END;
$$;

COMMENT ON FUNCTION public.sp_create_file(text, text, text, text, text, bigint, text) IS
  'Cria tb_files após upload; define uploader_id e file_purpose (rag/skills).';

GRANT EXECUTE ON FUNCTION public.sp_create_file(text, text, text, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_create_file(text, text, text, text, text, bigint, text) TO service_role;

-- Lista arquivos da empresa do usuário (inclui file_purpose)
DROP FUNCTION IF EXISTS public.sp_list_files_by_email(text);

CREATE OR REPLACE FUNCTION public.sp_list_files_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  original_name text,
  size_bytes bigint,
  mime_type text,
  is_deleted boolean,
  created_at timestamptz,
  file_purpose text
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
    COALESCE(f.file_purpose, 'rag'::text)
  FROM public.tb_files f
  WHERE f.companies_id = v_company_id
  ORDER BY f.created_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.sp_list_files_by_email(text) IS
  'Lista arquivos da empresa do usuário; inclui file_purpose para RAG vs Skills.';

GRANT EXECUTE ON FUNCTION public.sp_list_files_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_list_files_by_email(text) TO service_role;

COMMIT;
