-- Plano gratuito padrão para contas sem assinatura paga (MVP Receptivo).
-- Aplicar no Supabase após MIGRATION_TB_SUBSCRIPTIONS_PLAN_IDS.sql

BEGIN;

ALTER TABLE public.tb_subscriptions
  DROP CONSTRAINT IF EXISTS tb_subscriptions_plan_check;

-- Contas sem assinatura paga ativa → gratuito + inativo
UPDATE public.tb_subscriptions
SET
  plan = 'free',
  status = 'inactive',
  updated_at = now()
WHERE
  status IS NULL
  OR status NOT IN ('active', 'trialing');

-- Legado: enterprise/pro/plus ativos sem Stripe → gratuito (evita “Enterprise” de graça)
UPDATE public.tb_subscriptions
SET
  plan = 'free',
  status = 'inactive',
  updated_at = now()
WHERE
  stripe_subscription_id IS NULL
  AND status IN ('active', 'trialing')
  AND plan IN (
    'enterprise',
    'ENTERPRISE',
    'pro',
    'PRO',
    'plus',
    'PLUS',
    'rec_enterprise',
    'com_enterprise',
    'com_growth'
  );

UPDATE public.tb_subscriptions SET plan = 'free' WHERE lower(plan) = 'free';

UPDATE public.tb_subscriptions SET plan = 'rec_start' WHERE plan IN ('pro', 'PRO');
UPDATE public.tb_subscriptions SET plan = 'com_growth' WHERE plan IN ('plus', 'PLUS');
UPDATE public.tb_subscriptions SET plan = 'com_enterprise' WHERE plan IN ('enterprise', 'ENTERPRISE');

UPDATE public.tb_subscriptions
SET plan = 'free'
WHERE plan NOT IN (
  'free',
  'rec_start',
  'rec_growth',
  'rec_enterprise',
  'com_start',
  'com_growth',
  'com_enterprise'
);

-- Empresas sem linha em tb_subscriptions (backfill antes do trigger em novos INSERTs)
INSERT INTO public.tb_subscriptions (
  companies_id,
  plan,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  created_at,
  updated_at
)
SELECT
  c.id,
  'free',
  'inactive',
  'free_local_' || c.id::text,
  'free_local_' || c.id::text,
  now(),
  now()
FROM public.tb_companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.tb_subscriptions s WHERE s.companies_id = c.id
);

ALTER TABLE public.tb_subscriptions
  ADD CONSTRAINT tb_subscriptions_plan_check
  CHECK (
    plan IN (
      'free',
      'rec_start',
      'rec_growth',
      'rec_enterprise',
      'com_start',
      'com_growth',
      'com_enterprise'
    )
  );

-- Garante linha free para empresas novas (se o RPC de cadastro não inserir assinatura)
CREATE OR REPLACE FUNCTION public.trg_tb_companies_ensure_free_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tb_subscriptions s WHERE s.companies_id = NEW.id
  ) THEN
    INSERT INTO public.tb_subscriptions (
      companies_id,
      plan,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      'free',
      'inactive',
      'free_local_' || NEW.id::text,
      'free_local_' || NEW.id::text,
      now(),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tb_companies_ensure_free_subscription ON public.tb_companies;

CREATE TRIGGER trg_tb_companies_ensure_free_subscription
  AFTER INSERT ON public.tb_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_tb_companies_ensure_free_subscription();

COMMIT;
