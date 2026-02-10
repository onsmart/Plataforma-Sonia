-- ============================================
-- SCRIPT: Corrigir todas as funções que usam cu.is_active
-- ============================================
-- Remove referências a cu.is_active que não existe
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- PASSO 1: Encontrar todas as funções com is_active
-- ============================================
-- Execute primeiro para ver quais funções precisam ser corrigidas:
SELECT 
    p.proname as function_name,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%cu.is_active%'
  AND n.nspname = 'public'
ORDER BY p.proname;

-- ============================================
-- PASSO 2: Para cada função encontrada, você precisa:
-- ============================================
-- 1. Ver a definição atual:
--    SELECT pg_get_functiondef(oid) 
--    FROM pg_proc 
--    WHERE proname = 'nome_da_funcao';
--
-- 2. Copiar o código
-- 3. Remover todas as linhas com:
--    - AND cu.is_active = true
--    - WHERE cu.is_active = true
--    - cu.is_active = true AND
--
-- 4. Executar CREATE OR REPLACE FUNCTION com o código corrigido

-- ============================================
-- EXEMPLO DE CORREÇÃO GENÉRICA
-- ============================================
-- ANTES:
--   WHERE lower(u.email) = lower(p_email)
--     AND cu.is_active = true
--
-- DEPOIS:
--   WHERE lower(u.email) = lower(p_email)

-- ANTES:
--   INNER JOIN tb_company_users cu ON cu.user_id = u.id AND cu.is_active = true
--
-- DEPOIS:
--   INNER JOIN tb_company_users cu ON cu.user_id = u.id

-- ============================================
-- FUNÇÕES QUE PRECISAM SER CORRIGIDAS (baseado nos erros):
-- ============================================
-- 1. sp_list_agents_by_email
-- 2. sp_activity_overview
-- 3. sp_cockpit_metrics_by_email
-- 4. sp_count_unassigned_whatsapp_conversations
-- 5. sp_get_fallbacks_by_email (já corrigida, mas verifique)
-- 6. sp_count_fallbacks_by_email (já corrigida, mas verifique)
-- 7. sp_count_pending_decisions_by_email (verifique se usa cu.is_active)

-- ============================================
-- SCRIPT DE CORREÇÃO AUTOMÁTICA (use com cuidado)
-- ============================================
-- Este script tenta corrigir automaticamente, mas pode não funcionar
-- para todas as funções. Use como referência:

DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    corrected_def TEXT;
BEGIN
    -- Loop através de todas as funções que contêm cu.is_active
    FOR func_record IN 
        SELECT p.oid, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE pg_get_functiondef(p.oid) LIKE '%cu.is_active%'
          AND n.nspname = 'public'
    LOOP
        -- Obter definição atual
        SELECT pg_get_functiondef(func_record.oid) INTO func_def;
        
        -- Remover referências a cu.is_active
        corrected_def := regexp_replace(func_def, 
            E'\\s+AND\\s+cu\\.is_active\\s*=\\s*true', 
            '', 
            'gi'
        );
        corrected_def := regexp_replace(corrected_def, 
            E'\\s+WHERE\\s+cu\\.is_active\\s*=\\s*true', 
            '', 
            'gi'
        );
        corrected_def := regexp_replace(corrected_def, 
            E'cu\\.is_active\\s*=\\s*true\\s+AND\\s+', 
            '', 
            'gi'
        );
        
        -- Se houve mudança, executar
        IF corrected_def != func_def THEN
            RAISE NOTICE 'Corrigindo função: %', func_record.proname;
            -- CUIDADO: Descomente apenas se tiver certeza
            -- EXECUTE corrected_def;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- RECOMENDAÇÃO
-- ============================================
-- É mais seguro corrigir manualmente cada função.
-- Use o script acima apenas para identificar quais funções precisam correção.
-- Depois, copie cada função, corrija manualmente e execute CREATE OR REPLACE FUNCTION.
