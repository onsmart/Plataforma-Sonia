-- ============================================
-- SCRIPT: Atualizar procedure de criação de agente para incluir CRM
-- ============================================
-- 
-- Este script atualiza a procedure sp_create_agent_by_email
-- para aceitar o parâmetro p_crm_integration_id
--
-- ============================================

-- Verifica se a procedure existe e a recria com o novo parâmetro
-- (Ajuste conforme sua procedure atual)

-- Exemplo de procedure atualizada:
CREATE OR REPLACE FUNCTION sp_create_agent_by_email(
  p_email TEXT,
  p_nome TEXT,
  p_role_template_id UUID,
  p_primary_language TEXT DEFAULT 'EN',
  p_bio TEXT DEFAULT NULL,
  p_integrations_id UUID DEFAULT NULL,
  p_crm_integration_id UUID DEFAULT NULL  -- NOVO PARÂMETRO
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_agent_id UUID;
BEGIN
  -- Busca o user_id pelo email
  SELECT id INTO v_user_id
  FROM tb_users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', p_email;
  END IF;

  -- Cria o agente
  INSERT INTO tb_agents (
    user_id,
    nome,
    role_template_id,
    primary_language,
    bio,
    integrations_id,
    crm_integration_id,  -- NOVO CAMPO
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_nome,
    p_role_template_id,
    p_primary_language,
    p_bio,
    p_integrations_id,
    p_crm_integration_id,  -- NOVO CAMPO
    NOW(),
    NOW()
  )
  RETURNING id INTO v_agent_id;

  RETURN v_agent_id;
END;
$$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Teste a procedure:
-- SELECT sp_create_agent_by_email(
--   'seu-email@exemplo.com',
--   'Nome do Agente',
--   'ID_DO_TEMPLATE',
--   'PT',
--   'Descrição do agente',
--   NULL,  -- integrations_id
--   NULL   -- crm_integration_id
-- );
