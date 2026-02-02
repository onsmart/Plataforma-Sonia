-- ============================================
-- SCRIPT: Atualizar função de agentes para incluir CRM
-- ============================================
-- 
-- Este script garante que a função fn_get_agents_with_api_key
-- retorne o campo crm_integration_id
--
-- ============================================

-- Verifica se a função existe e a recria incluindo crm_integration_id
-- (Ajuste conforme sua função atual)

-- Exemplo de função que retorna agentes com CRM:
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
  crm_integration_id UUID,  -- NOVO CAMPO
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
    a.crm_integration_id,  -- NOVO CAMPO
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
