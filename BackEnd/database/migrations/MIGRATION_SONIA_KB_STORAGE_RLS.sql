-- Políticas RLS do bucket sonia-kb (storage.objects)
-- Permite upload/list/delete na pasta {companies_id}/ do usuário autenticado.
-- Aplicar no Supabase SQL Editor se uploads diretos do browser forem necessários.

CREATE OR REPLACE FUNCTION public.storage_company_id_for_auth_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.companies_id
  FROM public.tb_users u
  JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(trim(u.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  ORDER BY cu.created_at ASC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.storage_company_id_for_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_company_id_for_auth_user() TO service_role;

DROP POLICY IF EXISTS "sonia_kb_insert_own_company" ON storage.objects;
DROP POLICY IF EXISTS "sonia_kb_select_own_company" ON storage.objects;
DROP POLICY IF EXISTS "sonia_kb_update_own_company" ON storage.objects;
DROP POLICY IF EXISTS "sonia_kb_delete_own_company" ON storage.objects;

CREATE POLICY "sonia_kb_insert_own_company"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sonia-kb'
  AND (storage.foldername(name))[1] = public.storage_company_id_for_auth_user()::text
);

CREATE POLICY "sonia_kb_select_own_company"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'sonia-kb'
  AND (storage.foldername(name))[1] = public.storage_company_id_for_auth_user()::text
);

CREATE POLICY "sonia_kb_update_own_company"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'sonia-kb'
  AND (storage.foldername(name))[1] = public.storage_company_id_for_auth_user()::text
)
WITH CHECK (
  bucket_id = 'sonia-kb'
  AND (storage.foldername(name))[1] = public.storage_company_id_for_auth_user()::text
);

CREATE POLICY "sonia_kb_delete_own_company"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sonia-kb'
  AND (storage.foldername(name))[1] = public.storage_company_id_for_auth_user()::text
);
