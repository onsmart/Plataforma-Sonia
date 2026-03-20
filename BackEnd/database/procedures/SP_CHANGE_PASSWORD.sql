-- ============================================
-- STORED PROCEDURE: Alterar Senha do Usuário
-- ============================================
-- Valida a senha atual (bcrypt) e atualiza para a nova senha
-- A senha atual deve vir em texto plano do frontend
-- A nova senha será criptografada com bcrypt no banco
-- ============================================
-- REQUER: CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================

CREATE OR REPLACE FUNCTION sp_change_password(
    p_email TEXT,
    p_current_password TEXT,
    p_new_password TEXT
)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_stored_password TEXT;
    v_password_valid BOOLEAN;
    v_crypted_password TEXT;
BEGIN
    -- 1. Buscar usuário pelo email
    SELECT id, password INTO v_user_id, v_stored_password
    FROM tb_users
    WHERE email = LOWER(TRIM(p_email))
    LIMIT 1;

    -- 2. Verificar se usuário existe
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Usuário não encontrado'
        );
    END IF;

    -- 3. Validar senha atual usando bcrypt
    -- IMPORTANTE: Se a stored procedure sp_create_user_with_company recebe SHA-256 e faz bcrypt desse hash,
    -- precisamos primeiro fazer SHA-256 da senha atual e depois bcrypt desse hash
    -- Mas se recebe texto plano direto, fazemos bcrypt direto
    
    -- Tentar primeiro: bcrypt direto da senha (caso a criação tenha usado texto plano)
    v_crypted_password := crypt(p_current_password, v_stored_password);
    v_password_valid := (v_stored_password = v_crypted_password);
    
    -- Se não funcionar, tentar: SHA-256 primeiro, depois bcrypt (caso a criação tenha usado SHA-256 -> bcrypt)
    IF NOT v_password_valid THEN
        -- Calcular SHA-256 da senha atual
        DECLARE
            v_sha256_hash TEXT;
        BEGIN
            -- SHA-256 usando digest do pgcrypto
            v_sha256_hash := encode(digest(p_current_password, 'sha256'), 'hex');
            -- Fazer bcrypt do hash SHA-256
            v_crypted_password := crypt(v_sha256_hash, v_stored_password);
            v_password_valid := (v_stored_password = v_crypted_password);
        END;
    END IF;
    
    IF NOT v_password_valid THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Senha atual incorreta'
        );
    END IF;

    -- 4. Criptografar nova senha com bcrypt (usando o mesmo formato da criação: gen_salt('bf'))
    UPDATE tb_users
    SET password = crypt(p_new_password, gen_salt('bf'))
    WHERE id = v_user_id;

    -- 5. Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'message', 'Senha alterada com sucesso'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao alterar senha: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON FUNCTION sp_change_password IS 
'Altera a senha do usuário após validar a senha atual usando bcrypt. As senhas devem vir em texto plano do frontend.';
