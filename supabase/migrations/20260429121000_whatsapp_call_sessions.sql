BEGIN;

CREATE TABLE IF NOT EXISTS public.tb_whatsapp_call_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id text NOT NULL,
    integrations_id uuid NOT NULL REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    agent_id uuid NULL REFERENCES public.tb_agents(id) ON DELETE SET NULL,
    companies_id uuid NULL REFERENCES public.tb_companies(id) ON DELETE SET NULL,
    caller text NULL,
    phone_number_id text NULL,
    status text NOT NULL DEFAULT 'received',
    reason text NULL,
    sdp_offer text NULL,
    sdp_answer text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_event_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tb_whatsapp_call_sessions_call_id_unique UNIQUE (call_id),
    CONSTRAINT tb_whatsapp_call_sessions_status_check CHECK (
      status IN ('received', 'rejected', 'pre_accepted', 'accepted', 'active', 'terminated', 'failed')
    )
);

CREATE INDEX IF NOT EXISTS idx_tb_whatsapp_call_sessions_integrations_id
  ON public.tb_whatsapp_call_sessions (integrations_id);

CREATE INDEX IF NOT EXISTS idx_tb_whatsapp_call_sessions_agent_id
  ON public.tb_whatsapp_call_sessions (agent_id);

CREATE INDEX IF NOT EXISTS idx_tb_whatsapp_call_sessions_status
  ON public.tb_whatsapp_call_sessions (status);

CREATE OR REPLACE FUNCTION public.update_tb_whatsapp_call_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tb_whatsapp_call_sessions_updated_at ON public.tb_whatsapp_call_sessions;
CREATE TRIGGER trigger_update_tb_whatsapp_call_sessions_updated_at
  BEFORE UPDATE ON public.tb_whatsapp_call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tb_whatsapp_call_sessions_updated_at();

ALTER TABLE public.tb_whatsapp_call_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tb_whatsapp_call_sessions'
      AND policyname = 'tb_whatsapp_call_sessions_company_access'
  ) THEN
    CREATE POLICY tb_whatsapp_call_sessions_company_access
      ON public.tb_whatsapp_call_sessions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_whatsapp_call_sessions.companies_id
            AND cu.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_whatsapp_call_sessions.companies_id
            AND cu.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_whatsapp_call_sessions TO authenticated;
GRANT ALL ON public.tb_whatsapp_call_sessions TO service_role;

COMMENT ON TABLE public.tb_whatsapp_call_sessions IS
  'Registro operacional das chamadas WhatsApp recebidas pelo motor de voz.';

COMMIT;
