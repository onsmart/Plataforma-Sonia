-- ============================================
-- Knowledge Base: quota RPC + file size persistence
-- ============================================
-- A UI da Base de Conhecimento chama:
--   sp_get_file_usage_stats_by_email(p_email)
--   sp_create_file(..., p_size_bytes, p_file_purpose) — p_file_purpose: 'rag' | 'skills'
-- (ver FrontEnd/src/services/api.ts)
--
-- Execute no SQL Editor do Supabase (ou via migration pipeline).
-- Se algum ALTER/CREATE falhar, compare com o DDL real de public.tb_files.
-- ============================================

BEGIN;

-- Colunas usadas pelo app e pelas RPCs abaixo
ALTER TABLE public.tb_files
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

ALTER TABLE public.tb_files
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.tb_files
  ADD COLUMN IF NOT EXISTS file_purpose text NOT NULL DEFAULT 'rag'
  CONSTRAINT tb_files_file_purpose_check CHECK (file_purpose IN ('rag', 'skills'));

COMMENT ON COLUMN public.tb_files.file_purpose IS 'rag: embeddings; skills: tb_file_skills';

-- Opcional: registros antigos permanecem rag por DEFAULT.

-- Opcional: registros antigos sem tamanho permanecem NULL; a cota trata com COALESCE.
-- Não há como inferir bytes só pelo SQL sem metadados do Storage.

-- Se a função já existir com outro tipo de retorno (ex.: jsonb vs json), CREATE OR REPLACE falha (42P13).
-- Remover antes de recriar:
DROP FUNCTION IF EXISTS public.sp_get_file_usage_stats_by_email(text);
DROP FUNCTION IF EXISTS public.sp_create_file(text, text, text, text, text, bigint);
DROP FUNCTION IF EXISTS public.sp_create_file(text, text, text, text, text, bigint, text);

-- ---------------------------------------------------------------------------
-- sp_get_file_usage_stats_by_email
-- Retorno alinhado ao fallback em AgentService.getFileUsageStats()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_get_file_usage_stats_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_total_active integer;
  v_deleted integer;
  v_total_bytes bigint;
  v_limit_mb integer := 1024;
  v_used_mb numeric;
  v_percent numeric;
BEGIN
  SELECT u.id
  INTO v_user_id
  FROM public.tb_users u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'total_size_bytes', 0,
      'total_files', 0,
      'deleted_files', 0,
      'storage_used_mb', 0,
      'storage_limit_mb', v_limit_mb,
      'storage_used_percent', 0
    );
  END IF;

  SELECT cu.companies_id
  INTO v_company_id
  FROM public.tb_company_users cu
  WHERE cu.user_id = v_user_id
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object(
      'total_size_bytes', 0,
      'total_files', 0,
      'deleted_files', 0,
      'storage_used_mb', 0,
      'storage_limit_mb', v_limit_mb,
      'storage_used_percent', 0
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE COALESCE(f.is_deleted, false) = false),
    COUNT(*) FILTER (WHERE COALESCE(f.is_deleted, false) = true),
    COALESCE(
      SUM(COALESCE(f.size_bytes, 0)) FILTER (WHERE COALESCE(f.is_deleted, false) = false),
      0
    )::bigint
  INTO v_total_active, v_deleted, v_total_bytes
  FROM public.tb_files f
  WHERE f.companies_id = v_company_id;

  v_used_mb := round((v_total_bytes::numeric / (1024 * 1024)), 2);

  IF v_limit_mb > 0 THEN
    v_percent := round(
      (v_total_bytes::numeric / (v_limit_mb::numeric * 1024 * 1024)) * 100,
      2
    );
  ELSE
    v_percent := 0;
  END IF;

  IF v_percent > 100 THEN
    v_percent := 100;
  END IF;

  RETURN json_build_object(
    'total_size_bytes', v_total_bytes,
    'total_files', COALESCE(v_total_active, 0),
    'deleted_files', COALESCE(v_deleted, 0),
    'storage_used_mb', v_used_mb,
    'storage_limit_mb', v_limit_mb,
    'storage_used_percent', v_percent
  );
END;
$$;

COMMENT ON FUNCTION public.sp_get_file_usage_stats_by_email(text) IS
  'Agrega tb_files por empresa do usuário: contagem, bytes usados e percentual vs limite (1 GB default).';

-- ---------------------------------------------------------------------------
-- sp_create_file
-- Persiste size_bytes e demais metadados após upload ao bucket sonia-kb.
-- ---------------------------------------------------------------------------
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
  'Cria linha em tb_files após upload no Storage; uploader_id e file_purpose.';

GRANT EXECUTE ON FUNCTION public.sp_get_file_usage_stats_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_get_file_usage_stats_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sp_create_file(text, text, text, text, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sp_create_file(text, text, text, text, text, bigint, text) TO service_role;

-- Texto da cota (DB i18n) alinhado ao fluxo atual (delete permanente + métricas no Postgres)
UPDATE public.tb_i18n_translations
SET value = 'Os arquivos ficam no bucket na pasta da sua empresa. A cota usa o tamanho registrado no banco ao enviar cada arquivo; a exclusão na tela remove o arquivo do storage e do banco.'
WHERE companies_id IS NULL AND namespace = 'knowledgeBase' AND key = 'quota.info' AND language = 'pt-BR';

UPDATE public.tb_i18n_translations
SET value = 'Files live in your company folder in the bucket. Quota uses each file size stored when you upload; deleting from this screen removes the file from storage and the database.'
WHERE companies_id IS NULL AND namespace = 'knowledgeBase' AND key = 'quota.info' AND language = 'en-US';

UPDATE public.tb_i18n_translations
SET value = 'Los archivos están en el bucket en la carpeta de su empresa. La cuota usa el tamaño guardado al subir cada archivo; borrar desde esta pantalla elimina el archivo del storage y de la base.'
WHERE companies_id IS NULL AND namespace = 'knowledgeBase' AND key = 'quota.info' AND language = 'es-ES';

COMMIT;
