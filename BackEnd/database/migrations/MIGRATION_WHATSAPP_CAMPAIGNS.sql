-- Campanhas de disparo em massa (templates Meta) — fila com dedupe e throttle por campanha
BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_whatsapp_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integrations_id uuid NOT NULL REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    companies_id uuid NULL,
    name text NOT NULL,
    template_name text NOT NULL,
    template_language text NOT NULL,
    components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'draft',
    rate_limit_per_minute integer NOT NULL DEFAULT 30,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_integration
  ON public.tb_whatsapp_campaigns (integrations_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.tb_whatsapp_campaign_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES public.tb_whatsapp_campaigns(id) ON DELETE CASCADE,
    whatsapp_contact_id uuid NULL REFERENCES public.tb_whatsapp_contacts(id) ON DELETE SET NULL,
    dedupe_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz NULL,
    last_error text NULL,
    CONSTRAINT uq_whatsapp_campaign_job_dedupe UNIQUE (campaign_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_jobs_pending
  ON public.tb_whatsapp_campaign_jobs (campaign_id, status, scheduled_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.tb_whatsapp_campaigns IS 'Campanha de envio (ex.: template Meta) com limite de taxa configurável.';
COMMENT ON TABLE public.tb_whatsapp_campaign_jobs IS 'Fila por contato; dedupe por campanha + contato.';

COMMIT;
