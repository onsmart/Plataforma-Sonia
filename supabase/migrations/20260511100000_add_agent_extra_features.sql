alter table public.tb_agents
  add column if not exists extra_features text null;

comment on column public.tb_agents.extra_features is
  'Funcionalidades extras e instrucoes complementares especificas do agente, usadas alem do template compartilhado.';
