-- ============================================
-- SCRIPT: Remover referências a cu.is_active
-- ============================================
-- Remove todas as referências a cu.is_active que não existe
-- na tabela tb_company_users
-- ============================================

-- NOTA: Este script precisa ser executado no Supabase SQL Editor
-- As funções mencionadas nos erros precisam ser atualizadas manualmente
-- ou você pode executar este script que tenta atualizar as principais

-- ============================================
-- 1. sp_list_agents_by_email
-- ============================================
-- Se esta função existir, remova qualquer referência a cu.is_active
-- Exemplo de correção (ajuste conforme sua função atual):

/*
CREATE OR REPLACE FUNCTION sp_list_agents_by_email(
  p_email TEXT
)
RETURNS TABLE (
  -- seus campos aqui
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Buscar company_id SEM usar is_active
  SELECT cu.company_id INTO v_company_id
  FROM public.tb_users u
  INNER JOIN public.tb_company_users cu ON cu.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  -- Resto da função...
END;
$$;
*/

-- ============================================
-- 2. sp_activity_overview
-- ============================================
-- Remova referências a cu.is_active

-- ============================================
-- 3. sp_cockpit_metrics_by_email
-- ============================================
-- Remova referências a cu.is_active

-- ============================================
-- 4. sp_count_unassigned_whatsapp_conversations
-- ============================================
-- Remova referências a cu.is_active

-- ============================================
-- 5. sp_get_fallbacks_by_email
-- ============================================
-- Já corrigido anteriormente, mas verifique se não há mais referências

-- ============================================
-- 6. sp_count_fallbacks_by_email
-- ============================================
-- Já corrigido anteriormente, mas verifique se não há mais referências

-- ============================================
-- 7. sp_count_pending_decisions_by_email
-- ============================================
-- Remova referências a cu.is_active

-- ============================================
-- INSTRUÇÕES
-- ============================================
-- 1. Acesse o Supabase SQL Editor
-- 2. Para cada função que está dando erro, execute:
--    SELECT pg_get_functiondef(oid) 
--    FROM pg_proc 
--    WHERE proname = 'nome_da_funcao';
--
-- 3. Copie o código da função
-- 4. Remova todas as linhas que contêm:
--    - cu.is_active = true
--    - AND cu.is_active = true
--    - WHERE cu.is_active = true
--
-- 5. Execute a função atualizada com CREATE OR REPLACE FUNCTION

-- ============================================
-- EXEMPLO DE PADRÃO A PROCURAR E REMOVER
-- ============================================
-- Procure por estes padrões e remova:
-- 
-- ... AND cu.is_active = true
-- ... WHERE cu.is_active = true
-- ... cu.is_active = true AND ...
-- ... INNER JOIN ... AND cu.is_active = true

-- ============================================
-- VERIFICAÇÃO RÁPIDA
-- ============================================
-- Execute para encontrar todas as funções que podem ter is_active:
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%is_active%'
  AND n.nspname = 'public'
ORDER BY p.proname;
