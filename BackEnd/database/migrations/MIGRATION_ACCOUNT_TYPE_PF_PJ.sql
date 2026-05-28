-- Tipo de conta (pessoa física / jurídica) no tenant.
-- Aplicar antes de SP_CREATE_USER_WITH_COMPANY.sql e SP_CREATE_COMPANY_FOR_USER.sql

BEGIN;

ALTER TABLE public.tb_companies
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual';

ALTER TABLE public.tb_companies
  ADD COLUMN IF NOT EXISTS document text;

ALTER TABLE public.tb_companies
  DROP CONSTRAINT IF EXISTS tb_companies_account_type_check;

ALTER TABLE public.tb_companies
  ADD CONSTRAINT tb_companies_account_type_check
  CHECK (account_type IN ('individual', 'company'));

COMMENT ON COLUMN public.tb_companies.account_type IS 'individual = PF (uso pessoal); company = PJ (empresa)';
COMMENT ON COLUMN public.tb_companies.document IS 'CPF (PF) ou CNPJ (PJ), somente dígitos — obrigatório no cadastro';

COMMIT;
