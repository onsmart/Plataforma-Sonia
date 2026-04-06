ALTER TABLE public.tb_integrations
ADD COLUMN IF NOT EXISTS automation_mode text;

UPDATE public.tb_integrations
SET automation_mode = 'agent'
WHERE automation_mode IS NULL;

ALTER TABLE public.tb_integrations
ALTER COLUMN automation_mode SET DEFAULT 'agent';

ALTER TABLE public.tb_integrations
ADD COLUMN IF NOT EXISTS linked_flow_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tb_integrations_linked_flow_id_fkey'
  ) THEN
    ALTER TABLE public.tb_integrations
    ADD CONSTRAINT tb_integrations_linked_flow_id_fkey
    FOREIGN KEY (linked_flow_id)
    REFERENCES public.tb_flows(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tb_integrations_automation_mode
ON public.tb_integrations (automation_mode);

CREATE INDEX IF NOT EXISTS idx_tb_integrations_linked_flow_id
ON public.tb_integrations (linked_flow_id);
