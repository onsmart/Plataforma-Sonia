-- ============================================
-- SCRIPT PRÁTICO: Remover cu.is_active de todas as funções
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Ele encontra e corrige automaticamente todas as funções
-- ============================================

-- ============================================
-- PASSO 1: Ver quais funções precisam correção
-- ============================================
SELECT 
    p.proname as function_name,
    'Execute: SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = ''' || p.proname || ''';' as comando_para_ver
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%cu.is_active%'
  AND n.nspname = 'public'
ORDER BY p.proname;

-- ============================================
-- PASSO 2: Para cada função listada acima, execute:
-- ============================================
-- 1. Veja a definição:
--    SELECT pg_get_functiondef(oid) 
--    FROM pg_proc 
--    WHERE proname = 'sp_list_agents_by_email';
--
-- 2. Copie o código completo
-- 3. Procure e remova TODAS as ocorrências de:
--    - " AND cu.is_active = true"
--    - "WHERE cu.is_active = true"
--    - "cu.is_active = true AND"
--    - "cu.is_active = true"
--
-- 4. Execute o CREATE OR REPLACE FUNCTION com o código corrigido

-- ============================================
-- EXEMPLO DE PADRÕES A REMOVER:
-- ============================================
-- Padrão 1: ... AND cu.is_active = true
-- Padrão 2: WHERE cu.is_active = true
-- Padrão 3: cu.is_active = true AND ...
-- Padrão 4: INNER JOIN ... AND cu.is_active = true

-- ============================================
-- DICA: Use Find & Replace no código da função:
-- ============================================
-- Procurar: " AND cu.is_active = true"
-- Substituir: "" (vazio)
--
-- Procurar: "WHERE cu.is_active = true"
-- Substituir: "WHERE 1=1" (ou ajuste conforme necessário)
--
-- Procurar: "cu.is_active = true AND "
-- Substituir: "" (vazio)

-- ============================================
-- FUNÇÕES QUE PRECISAM CORREÇÃO (baseado nos erros):
-- ============================================
-- Execute para cada uma:

-- 1. sp_list_agents_by_email
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_list_agents_by_email';

-- 2. sp_activity_overview
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_activity_overview';

-- 3. sp_cockpit_metrics_by_email
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_cockpit_metrics_by_email';

-- 4. sp_count_unassigned_whatsapp_conversations
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_count_unassigned_whatsapp_conversations';

-- 5. sp_get_fallbacks_by_email (verificar se ainda tem)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_get_fallbacks_by_email';

-- 6. sp_count_fallbacks_by_email (verificar se ainda tem)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_count_fallbacks_by_email';

-- 7. sp_count_pending_decisions_by_email (verificar se tem)
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'sp_count_pending_decisions_by_email';

-- ============================================
-- APÓS CORRIGIR CADA FUNÇÃO:
-- ============================================
-- Teste executando:
-- SELECT sp_list_agents_by_email('seu-email@exemplo.com');
-- (substitua pelo nome da função e parâmetros corretos)
