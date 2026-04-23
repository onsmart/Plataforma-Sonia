-- Complemento incremental para o modelo multi-integracao de email.
-- Execute apos MIGRATION_EMAIL_MULTI_PROVIDER.sql.

ALTER TABLE public.tb_email_integration_settings
  ADD COLUMN IF NOT EXISTS provider_preset text NULL,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_provider_preset
  ON public.tb_email_integration_settings (provider_preset);

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_is_default
  ON public.tb_email_integration_settings (is_default);

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_is_active
  ON public.tb_email_integration_settings (is_active);

UPDATE public.tb_email_integration_settings
SET provider_preset = CASE
    WHEN provider_family = 'microsoft365' THEN 'microsoft365'
    WHEN smtp_host = 'smtp.gmail.com' AND imap_host = 'imap.gmail.com' THEN 'gmail'
    WHEN smtp_host = 'smtp.mail.yahoo.com' AND imap_host = 'imap.mail.yahoo.com' THEN 'yahoo'
    WHEN smtp_host = 'smtp-mail.outlook.com' AND imap_host = 'outlook.office365.com'
      AND lower(coalesce(email_address, username, '')) LIKE '%@hotmail.com' THEN 'hotmail'
    WHEN smtp_host = 'smtp-mail.outlook.com' AND imap_host = 'outlook.office365.com' THEN 'outlook_personal'
    ELSE 'custom'
  END,
  is_active = coalesce(is_active, true),
  updated_at = now()
WHERE provider_preset IS NULL;
