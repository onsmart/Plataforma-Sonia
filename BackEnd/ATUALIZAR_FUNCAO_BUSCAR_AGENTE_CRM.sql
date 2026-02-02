-- ============================================
-- SCRIPT: Atualizar função de buscar agente para incluir CRM
-- ============================================
-- 
-- Este script atualiza a função sp_get_agent_config_by_email
-- para retornar o campo crm_integration_id
--
-- ============================================

-- Exemplo de função atualizada (ajuste conforme sua função atual):
CREATE OR REPLACE FUNCTION sp_get_agent_config_by_email(
  p_user_email TEXT,
  p_agent_id UUID
)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  provider TEXT,
  provider_model TEXT,
  temperature REAL,
  max_tokens BIGINT,
  system_instructions TEXT,
  crm_integration_id UUID  -- NOVO CAMPO
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.nome,
    a.provider,
    a.provider_model,
    a.temperature,
    a.max_tokens,
    a.system_instructions,
    a.crm_integration_id  -- NOVO CAMPO
  FROM tb_agents a
  INNER JOIN tb_users u ON a.user_id = u.id
  WHERE u.email = p_user_email
    AND a.id = p_agent_id;
END;
$$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Teste a função:
-- SELECT * FROM sp_get_agent_config_by_email('seu-email@exemplo.com', 'ID_DO_AGENTE');
