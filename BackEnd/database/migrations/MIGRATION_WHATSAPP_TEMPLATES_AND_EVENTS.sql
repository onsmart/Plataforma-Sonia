-- ============================================
-- WhatsApp: eventos, catálogo de templates, preços parametrizáveis, flags por integração
-- ============================================
-- Evolução incremental: NÃO altera tb_integrations nem remove dados existentes.
-- Execute no SQL Editor do Supabase (ou pipeline de migrations).
-- ============================================

BEGIN;

-- Flags por integração (opcional; se não usar, manter WHATSAPP_TEMPLATES_ENABLED no .env)
CREATE TABLE IF NOT EXISTS public.tb_whatsapp_integration_feature_flags (
    integrations_id uuid PRIMARY KEY REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    templates_enabled boolean NOT NULL DEFAULT false,
    campaigns_enabled boolean NOT NULL DEFAULT false,
    enforce_session_window boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tb_whatsapp_integration_feature_flags IS
  'Feature flags por integração WhatsApp; convive com flags globais em variável de ambiente.';

-- Eventos append-only (analytics, janela 24h, auditoria)
CREATE TABLE IF NOT EXISTS public.tb_whatsapp_message_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integrations_id uuid NOT NULL REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    companies_id uuid NULL,
    whatsapp_contact_id uuid NULL REFERENCES public.tb_whatsapp_contacts(id) ON DELETE SET NULL,
    wamid text NULL,
    event_type text NOT NULL,
    message_kind text NOT NULL DEFAULT 'unknown',
    template_name text NULL,
    template_language text NULL,
    template_category text NULL,
    meta_status text NULL,
    flow_id uuid NULL,
    campaign_id uuid NULL,
    error_code integer NULL,
    error_message text NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_events_integration_created
  ON public.tb_whatsapp_message_events (integrations_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_events_contact_created
  ON public.tb_whatsapp_message_events (whatsapp_contact_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_events_wamid
  ON public.tb_whatsapp_message_events (wamid)
  WHERE wamid IS NOT NULL;

COMMENT ON TABLE public.tb_whatsapp_message_events IS
  'Eventos de mensageria WhatsApp (inbound, outbound, status); base para janela 24h e dashboards.';

-- Catálogo de templates (separado do runtime de envio)
CREATE TABLE IF NOT EXISTS public.tb_whatsapp_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integrations_id uuid NOT NULL REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    name text NOT NULL,
    language text NOT NULL,
    category text NULL,
    status text NULL,
    components_json jsonb NOT NULL DEFAULT '[]'::jsonb,
    meta_raw jsonb NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_whatsapp_templates_integration_name_lang UNIQUE (integrations_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_integration
  ON public.tb_whatsapp_templates (integrations_id);

COMMENT ON TABLE public.tb_whatsapp_templates IS
  'Snapshot de templates aprovados sincronizados da Meta (Graph API message_templates).';

-- Preços parametrizáveis (sem valores fixos de produto no código)
CREATE TABLE IF NOT EXISTS public.tb_whatsapp_pricing_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code text NULL,
    conversation_category text NULL,
    template_category text NULL,
    currency text NOT NULL DEFAULT 'USD',
    unit_amount numeric(18, 8) NOT NULL,
    valid_from date NOT NULL,
    valid_to date NULL,
    source text NOT NULL DEFAULT 'manual',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_pricing_valid
  ON public.tb_whatsapp_pricing_schedule (valid_from, valid_to);

COMMENT ON TABLE public.tb_whatsapp_pricing_schedule IS
  'Tabela versionada de preços estimados; atualizar via admin/import sem redeploy.';

ALTER TABLE public.tb_whatsapp_integration_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_whatsapp_message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tb_whatsapp_pricing_schedule ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tb_whatsapp_integration_feature_flags FROM anon, authenticated;
REVOKE ALL ON public.tb_whatsapp_message_events FROM anon, authenticated;
REVOKE ALL ON public.tb_whatsapp_templates FROM anon, authenticated;
REVOKE ALL ON public.tb_whatsapp_pricing_schedule FROM anon, authenticated;

GRANT ALL ON public.tb_whatsapp_integration_feature_flags TO service_role;
GRANT ALL ON public.tb_whatsapp_message_events TO service_role;
GRANT ALL ON public.tb_whatsapp_templates TO service_role;
GRANT ALL ON public.tb_whatsapp_pricing_schedule TO service_role;

COMMIT;
