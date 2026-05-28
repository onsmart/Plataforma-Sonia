-- =============================================================================
-- Inventário READ-ONLY do schema public (Supabase — projeto Sonia)
-- Execute no SQL Editor. Não altera dados.
-- Exporte os resultados (CSV ou texto) e cole no repositório/chat para atualizar
-- BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md
-- =============================================================================

-- === 1. Tabelas e views ===
SELECT table_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_type, table_name;

-- === 2. Colunas (BASE TABLE) ===
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.character_maximum_length,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
 AND t.table_type = 'BASE TABLE'
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;

-- === 3. Primary keys e foreign keys ===
SELECT
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- === 4. CHECK constraints ===
SELECT
  rel.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND con.contype = 'c'
ORDER BY rel.relname, con.conname;

-- === 5. Índices ===
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- === 6. RLS ligado por tabela ===
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_on,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- === 7. Políticas RLS ===
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- === 8. Triggers ===
SELECT
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_orientation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- === 9. Funções public (sp_*, fn_*, trg_*) ===
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS result_type,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (
    p.proname LIKE 'sp\_%'
    OR p.proname LIKE 'fn\_%'
    OR p.proname LIKE 'trg\_%'
    OR p.proname LIKE '%\_ensure\_%'
  )
ORDER BY p.proname;

-- === 10. Contagens rápidas (tabelas críticas) ===
SELECT 'tb_companies' AS table_name, count(*)::bigint AS row_count FROM public.tb_companies
UNION ALL SELECT 'tb_users', count(*) FROM public.tb_users
UNION ALL SELECT 'tb_company_users', count(*) FROM public.tb_company_users
UNION ALL SELECT 'tb_subscriptions', count(*) FROM public.tb_subscriptions
UNION ALL SELECT 'tb_agents', count(*) FROM public.tb_agents
UNION ALL SELECT 'tb_integrations', count(*) FROM public.tb_integrations
UNION ALL SELECT 'tb_whatsapp_contacts', count(*) FROM public.tb_whatsapp_contacts
UNION ALL SELECT 'tb_whatsapp_messages', count(*) FROM public.tb_whatsapp_messages
UNION ALL SELECT 'tb_service_sessions', count(*) FROM public.tb_service_sessions
UNION ALL SELECT 'tb_files', count(*) FROM public.tb_files
UNION ALL SELECT 'tb_flows', count(*) FROM public.tb_flows
ORDER BY table_name;

-- === 11. Go-live MVP Receptivo — auditoria de planos (read-only) ===
-- Executar antes e depois de MIGRATION_TB_SUBSCRIPTIONS_PLAN_IDS.sql + MIGRATION_FREE_PLAN_DEFAULT.sql

SELECT plan, status, count(*)::bigint AS n
FROM public.tb_subscriptions
GROUP BY plan, status
ORDER BY plan, status;

SELECT companies_id, plan, status, stripe_subscription_id IS NOT NULL AS has_stripe_sub
FROM public.tb_subscriptions
WHERE status IN ('active', 'trialing')
ORDER BY plan, companies_id;

SELECT DISTINCT plan
FROM public.tb_subscriptions
WHERE plan NOT IN (
  'free', 'rec_start', 'rec_growth', 'rec_enterprise',
  'com_start', 'com_growth', 'com_enterprise'
);

SELECT c.id AS companies_id_sem_assinatura
FROM public.tb_companies c
LEFT JOIN public.tb_subscriptions s ON s.companies_id = c.id
WHERE s.id IS NULL
LIMIT 50;
