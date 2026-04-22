-- ============================================
-- MIGRATION: Billing Pro / Plus / Enterprise
-- ============================================
-- Objetivo:
-- 1. Substituir a semântica antiga de Starter pelo novo plano base Pro
-- 2. Inserir/atualizar o plano Plus nas traduções do namespace configuration
-- 3. Manter a operação idempotente via ON CONFLICT
--
-- Como usar:
-- - Abra o SQL Editor do Supabase
-- - Cole este arquivo inteiro
-- - Execute uma vez
--
-- Observação:
-- - Este script não remove chaves antigas de starter; ele apenas garante
--   que as chaves novas de Pro/Plus estejam corretas no banco.
-- ============================================

INSERT INTO public.tb_i18n_translations (companies_id, language, namespace, key, value, description)
VALUES
  -- pt-BR
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.title', 'Pro', 'Título plano Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.badge', 'Plano base', 'Badge plano Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.description', 'Para operações iniciais', 'Descrição Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.price.monthly', '$0', 'Preço Pro mensal'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.price.yearly', '$0', 'Preço Pro anual'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.period.monthly', '/mês', 'Período mensal Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.period.yearly', '/ano', 'Período anual Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.economy', 'Plano incluído na plataforma', 'Economia Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.agents', 'Agente', 'Label agentes Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.messages', 'Mensagens', 'Mensagens Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.rag', 'RAG Knowledge Base', 'RAG Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.support', 'Suporte Comunitário', 'Suporte Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.pro.upgrade', 'Fazer Upgrade para Pro', 'Botão upgrade Pro'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.title', 'Plus', 'Título plano Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.badge', 'POPULAR', 'Badge popular Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.description', 'Para times em crescimento', 'Descrição Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.price.monthly', '$49', 'Preço Plus mensal'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.price.yearly', '$39', 'Preço Plus anual'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.period.monthly', '/mês', 'Período mensal Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.period.yearly', '/ano', 'Período anual Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.economy', 'Economize $120/ano', 'Economia Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.agents', 'Agentes', 'Label agentes Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.messages', 'Mensagens Ilimitadas', 'Mensagens Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.rag', 'RAG Knowledge Base', 'RAG Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.support', 'Prioridade no Suporte', 'Suporte Plus'),
  (NULL, 'pt-BR', 'configuration', 'billing.plans.plus.upgrade', 'Fazer Upgrade para Plus', 'Botão upgrade Plus'),

  -- en-US
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.title', 'Pro', 'Pro plan title'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.badge', 'Base plan', 'Pro badge'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.description', 'For initial operations', 'Pro description'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.price.monthly', '$0', 'Pro monthly price'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.price.yearly', '$0', 'Pro yearly price'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.period.monthly', '/month', 'Pro monthly period'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.period.yearly', '/year', 'Pro yearly period'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.economy', 'Included with the platform', 'Pro economy'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.agents', 'Agent', 'Pro agents label'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.messages', 'Messages', 'Pro messages'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.rag', 'RAG Knowledge Base', 'Pro RAG'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.support', 'Community Support', 'Pro support'),
  (NULL, 'en-US', 'configuration', 'billing.plans.pro.upgrade', 'Upgrade to Pro', 'Pro upgrade button'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.title', 'Plus', 'Plus plan title'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.badge', 'POPULAR', 'Popular Plus badge'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.description', 'For growing teams', 'Plus description'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.price.monthly', '$49', 'Plus monthly price'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.price.yearly', '$39', 'Plus yearly price'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.period.monthly', '/month', 'Plus monthly period'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.period.yearly', '/year', 'Plus yearly period'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.economy', 'Save $120/year', 'Plus economy'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.agents', 'Agents', 'Plus agents label'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.messages', 'Unlimited Messages', 'Plus messages'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.rag', 'RAG Knowledge Base', 'Plus RAG'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.support', 'Priority Support', 'Plus support'),
  (NULL, 'en-US', 'configuration', 'billing.plans.plus.upgrade', 'Upgrade to Plus', 'Plus upgrade button'),

  -- es-ES
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.title', 'Pro', 'Título plan Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.badge', 'Plan base', 'Badge Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.description', 'Para operaciones iniciales', 'Descripción Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.price.monthly', '$0', 'Precio Pro mensual'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.price.yearly', '$0', 'Precio Pro anual'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.period.monthly', '/mes', 'Período mensual Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.period.yearly', '/año', 'Período anual Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.economy', 'Incluido en la plataforma', 'Ahorro Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.agents', 'Agente', 'Etiqueta agentes Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.messages', 'Mensajes', 'Mensajes Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.rag', 'RAG Knowledge Base', 'RAG Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.support', 'Soporte Comunitario', 'Soporte Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.pro.upgrade', 'Hacer Upgrade a Pro', 'Botón upgrade Pro'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.title', 'Plus', 'Título plan Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.badge', 'POPULAR', 'Badge popular Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.description', 'Para equipos en crecimiento', 'Descripción Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.price.monthly', '$49', 'Precio Plus mensual'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.price.yearly', '$39', 'Precio Plus anual'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.period.monthly', '/mes', 'Período mensual Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.period.yearly', '/año', 'Período anual Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.economy', 'Ahorra $120/año', 'Ahorro Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.agents', 'Agentes', 'Etiqueta agentes Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.messages', 'Mensajes Ilimitados', 'Mensajes Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.rag', 'RAG Knowledge Base', 'RAG Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.support', 'Prioridad en el Soporte', 'Soporte Plus'),
  (NULL, 'es-ES', 'configuration', 'billing.plans.plus.upgrade', 'Hacer Upgrade a Plus', 'Botón upgrade Plus')

ON CONFLICT (companies_id, language, namespace, key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
