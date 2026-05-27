-- Planos oficiais Sonia (2026): somente rec_* e com_* em tb_subscriptions.plan
-- Tabela comercial: REC_START, REC_GROWTH, REC_ENTERPRISE, COM_START, COM_GROWTH, COM_ENTERPRISE

BEGIN;

ALTER TABLE public.tb_subscriptions
  DROP CONSTRAINT IF EXISTS tb_subscriptions_plan_check;

-- Normaliza valores legados antes do novo CHECK
UPDATE public.tb_subscriptions SET plan = 'rec_start' WHERE plan IN ('pro', 'PRO');
UPDATE public.tb_subscriptions SET plan = 'com_growth' WHERE plan IN ('plus', 'PLUS');
UPDATE public.tb_subscriptions SET plan = 'com_enterprise' WHERE plan IN ('enterprise', 'ENTERPRISE');

-- Códigos comerciais em maiúsculas (se existirem)
UPDATE public.tb_subscriptions SET plan = 'rec_start' WHERE lower(plan) = 'rec_start';
UPDATE public.tb_subscriptions SET plan = 'rec_growth' WHERE lower(plan) = 'rec_growth';
UPDATE public.tb_subscriptions SET plan = 'rec_enterprise' WHERE lower(plan) = 'rec_enterprise';
UPDATE public.tb_subscriptions SET plan = 'com_start' WHERE lower(plan) = 'com_start';
UPDATE public.tb_subscriptions SET plan = 'com_growth' WHERE lower(plan) = 'com_growth';
UPDATE public.tb_subscriptions SET plan = 'com_enterprise' WHERE lower(plan) = 'com_enterprise';

-- Qualquer valor desconhecido: Start receptivo (evita violar CHECK)
UPDATE public.tb_subscriptions
SET plan = 'rec_start'
WHERE plan NOT IN (
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise'
);

ALTER TABLE public.tb_subscriptions
  ADD CONSTRAINT tb_subscriptions_plan_check
  CHECK (
    plan IN (
      'rec_start',
      'rec_growth',
      'rec_enterprise',
      'com_start',
      'com_growth',
      'com_enterprise'
    )
  );

COMMIT;
