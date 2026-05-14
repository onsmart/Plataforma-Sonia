-- Evolução incremental da arquitetura de email.
-- Não remove colunas antigas de tb_integrations e não quebra integrações Microsoft 365 existentes.

CREATE TABLE IF NOT EXISTS public.tb_email_integration_settings (
    integration_id uuid PRIMARY KEY REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    provider_family text NULL,
    auth_type text NULL,
    read_method text NULL,
    send_method text NULL,
    email_address text NULL,
    username text NULL,
    smtp_host text NULL,
    smtp_port integer NULL,
    smtp_secure boolean NULL,
    imap_host text NULL,
    imap_port integer NULL,
    imap_secure boolean NULL,
    scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NULL,
    last_sync_at timestamptz NULL,
    sync_cursor text NULL,
    sync_checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_provider_family
  ON public.tb_email_integration_settings (provider_family);

CREATE INDEX IF NOT EXISTS idx_tb_email_integration_settings_status
  ON public.tb_email_integration_settings (status);

COMMENT ON TABLE public.tb_email_integration_settings IS
  'Configuração incremental para arquitetura multi-provider de email (Graph, IMAP, SMTP), preservando tb_integrations.';

ALTER TABLE public.tb_email_integration_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tb_email_integration_settings FROM anon, authenticated;
GRANT ALL ON public.tb_email_integration_settings TO service_role;
