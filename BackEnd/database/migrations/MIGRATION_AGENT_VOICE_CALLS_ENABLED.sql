BEGIN;

ALTER TABLE public.tb_agent_voice_profiles
  ADD COLUMN IF NOT EXISTS calls_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tb_agent_voice_profiles.calls_enabled IS
  'Controla se o agente pode atender chamadas de voz recebidas via WhatsApp Calling.';

COMMIT;
