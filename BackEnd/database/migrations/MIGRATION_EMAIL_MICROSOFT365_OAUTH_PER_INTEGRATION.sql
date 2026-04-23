-- Armazena credenciais OAuth do Microsoft 365 por integracao de email.
-- Execute apos MIGRATION_EMAIL_MULTI_PROVIDER.sql e MIGRATION_EMAIL_INTEGRATION_DEFAULTS.sql.

ALTER TABLE public.tb_email_integration_settings
  ADD COLUMN IF NOT EXISTS oauth_client_id text NULL,
  ADD COLUMN IF NOT EXISTS oauth_client_secret text NULL,
  ADD COLUMN IF NOT EXISTS oauth_redirect_uri text NULL,
  ADD COLUMN IF NOT EXISTS oauth_tenant_id text NULL;

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_oauth_client_id
  ON public.tb_email_integration_settings (oauth_client_id);
