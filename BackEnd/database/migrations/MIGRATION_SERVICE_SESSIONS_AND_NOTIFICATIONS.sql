BEGIN;

-- Sessões de atendimento (1 sessão = 1 atendimento faturável no mês)
CREATE TABLE IF NOT EXISTS public.tb_service_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    companies_id uuid NOT NULL REFERENCES public.tb_companies(id) ON DELETE CASCADE,
    integrations_id uuid NOT NULL REFERENCES public.tb_integrations(id) ON DELETE CASCADE,
    whatsapp_contact_id uuid NOT NULL REFERENCES public.tb_whatsapp_contacts(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'open',
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz NULL,
    last_inbound_at timestamptz NOT NULL DEFAULT now(),
    end_reason text NULL,
    billing_month date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tb_service_sessions_status_check CHECK (status IN ('open', 'closed')),
    CONSTRAINT tb_service_sessions_end_reason_check CHECK (
      end_reason IS NULL OR end_reason IN ('flow_completed', 'inactivity', 'restart', 'manual')
    )
);

CREATE INDEX IF NOT EXISTS idx_tb_service_sessions_company_month
  ON public.tb_service_sessions (companies_id, billing_month);

CREATE INDEX IF NOT EXISTS idx_tb_service_sessions_open_contact
  ON public.tb_service_sessions (integrations_id, whatsapp_contact_id)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tb_service_sessions_one_open_per_contact
  ON public.tb_service_sessions (integrations_id, whatsapp_contact_id)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.update_tb_service_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tb_service_sessions_updated_at ON public.tb_service_sessions;
CREATE TRIGGER trigger_update_tb_service_sessions_updated_at
  BEFORE UPDATE ON public.tb_service_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tb_service_sessions_updated_at();

ALTER TABLE public.tb_service_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tb_service_sessions'
      AND policyname = 'tb_service_sessions_company_access'
  ) THEN
    CREATE POLICY tb_service_sessions_company_access
      ON public.tb_service_sessions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_service_sessions.companies_id
            AND cu.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_service_sessions.companies_id
            AND cu.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Notificações in-app
CREATE TABLE IF NOT EXISTS public.tb_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    companies_id uuid NOT NULL REFERENCES public.tb_companies(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    read boolean NOT NULL DEFAULT false,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tb_notifications_company_created
  ON public.tb_notifications (companies_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tb_notifications_company_unread
  ON public.tb_notifications (companies_id, read)
  WHERE read = false;

ALTER TABLE public.tb_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tb_notifications'
      AND policyname = 'tb_notifications_company_access'
  ) THEN
    CREATE POLICY tb_notifications_company_access
      ON public.tb_notifications
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_notifications.companies_id
            AND cu.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.tb_company_users cu
          WHERE cu.companies_id = tb_notifications.companies_id
            AND cu.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;
