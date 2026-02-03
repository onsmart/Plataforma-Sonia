-- ============================================
-- SCRIPT: Verificar e atualizar função de agentes para incluir CRM
-- ============================================
-- 
-- Este script verifica se a função fn_get_agents_with_api_key
-- está retornando o campo crm_integration_id
--
-- ============================================

-- Verifica a estrutura atual da função
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'fn_get_agents_with_api_key'
AND n.nspname = 'public';

-- Se a função não retornar crm_integration_id, execute o script abaixo:

CREATE OR REPLACE FUNCTION fn_get_agents_with_api_key(p_user_email TEXT)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  bio TEXT,
  system_instructions TEXT,
  primary_language TEXT,
  provider TEXT,
  provider_model TEXT,
  temperature REAL,
  max_tokens BIGINT,
  api_key TEXT,
  integrations_id UUID,
  crm_integration_id UUID,  -- GARANTE QUE ESTE CAMPO ESTÁ AQUI
  role_template_id UUID,
  channels JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.nome,
    a.bio,
    a.system_instructions,
    a.primary_language,
    a.provider,
    a.provider_model,
    a.temperature,
    a.max_tokens,
    COALESCE(uk.api_key, '')::TEXT as api_key,
    a.integrations_id,
    a.crm_integration_id,  -- GARANTE QUE ESTE CAMPO ESTÁ AQUI
    a.role_template_id,
    a.channels,
    a.created_at,
    a.updated_at
  FROM tb_agents a
  INNER JOIN tb_users u ON a.user_id = u.id
  LEFT JOIN tb_user_api_keys uk ON uk.user_id = u.id AND uk.provider = a.provider
  WHERE u.email = p_user_email
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Teste a função:
-- SELECT * FROM fn_get_agents_with_api_key('seu-email@exemplo.com');
-- 
-- Verifique se o campo crm_integration_id está presente nos resultados
