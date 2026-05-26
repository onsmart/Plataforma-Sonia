-- Amplia CHECK de plan em tb_subscriptions para os 6 planos oficiais + legado Stripe.
-- Necessário para gravar rec_start, com_growth, etc. diretamente (sem só pro/plus/enterprise).

ALTER TABLE public.tb_subscriptions
  DROP CONSTRAINT IF EXISTS tb_subscriptions_plan_check;

ALTER TABLE public.tb_subscriptions
  ADD CONSTRAINT tb_subscriptions_plan_check
  CHECK (
    plan IN (
      'rec_start',
      'rec_growth',
      'rec_enterprise',
      'com_start',
      'com_growth',
      'com_enterprise',
      'pro',
      'plus',
      'enterprise'
    )
  );

-- Opcional: normalizar legado já gravado (descomente se quiser IDs novos no banco)
-- UPDATE public.tb_subscriptions SET plan = 'rec_start' WHERE plan = 'pro';
-- UPDATE public.tb_subscriptions SET plan = 'com_growth' WHERE plan = 'plus';
-- UPDATE public.tb_subscriptions SET plan = 'com_enterprise' WHERE plan = 'enterprise';
