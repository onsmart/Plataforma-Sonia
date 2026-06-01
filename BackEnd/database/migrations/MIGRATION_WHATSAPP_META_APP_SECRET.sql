-- App Secret da Meta por integração WhatsApp (multi-tenant / multi-app)
ALTER TABLE public.tb_integrations
  ADD COLUMN IF NOT EXISTS meta_app_secret text;

COMMENT ON COLUMN public.tb_integrations.meta_app_secret IS
  'App Secret da Meta (WhatsApp Cloud API) usado para validar X-Hub-Signature-256 do webhook. Fallback: WHATSAPP_META_APP_SECRET no backend.';
