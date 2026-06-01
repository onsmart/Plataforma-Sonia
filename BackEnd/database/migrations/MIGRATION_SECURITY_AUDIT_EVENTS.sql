-- Audit log de segurança (append-only)
CREATE TABLE IF NOT EXISTS public.tb_security_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companies_id uuid REFERENCES public.tb_companies(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.tb_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tb_security_audit_events_company_created
  ON public.tb_security_audit_events (companies_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tb_security_audit_events_action_created
  ON public.tb_security_audit_events (action, created_at DESC);

ALTER TABLE public.tb_security_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tb_security_audit_events'
      AND policyname = 'tb_security_audit_events_deny_all'
  ) THEN
    CREATE POLICY tb_security_audit_events_deny_all
      ON public.tb_security_audit_events
      FOR ALL
      TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
