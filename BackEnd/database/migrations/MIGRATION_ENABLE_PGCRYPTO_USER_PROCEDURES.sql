-- Cadastro e troca de senha usam bcrypt (crypt/gen_salt) via pgcrypto.
-- No Supabase, a extensão fica no schema extensions.
-- Aplicado em produção via supabase db query (2026-05-28).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Ver SP_CREATE_USER_WITH_COMPANY.sql (search_path = public, extensions)
