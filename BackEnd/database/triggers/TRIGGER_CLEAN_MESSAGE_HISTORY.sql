-- ============================================
-- TRIGGER: Limpeza Automática de Histórico de Mensagens
-- ============================================
-- Antes de inserir uma nova mensagem, verifica se já existem
-- 20 mensagens para aquele contato/conversa. Se sim, deleta 80%
-- (ou todas, dependendo da configuração)
-- ============================================

-- Função que será executada ANTES do INSERT
CREATE OR REPLACE FUNCTION clean_message_history_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_message_count INTEGER;
  v_messages_to_keep INTEGER := 4; -- Manter 20% (4 de 20)
  v_messages_to_delete INTEGER;
  v_oldest_messages RECORD;
BEGIN
  -- Verificar quantas mensagens já existem para este contato/conversa
  -- Assumindo que a tabela tem um campo que identifica a conversa (ex: whatsapp_contact_id, conversation_id, etc)
  -- Ajuste o nome da tabela e campos conforme sua estrutura
  
  -- Exemplo para tb_whatsapp_messages:
  IF TG_TABLE_NAME = 'tb_whatsapp_messages' THEN
    SELECT COUNT(*) INTO v_message_count
    FROM tb_whatsapp_messages
    WHERE whatsapp_contact_id = NEW.whatsapp_contact_id;
    
    -- Se já tem 20 ou mais mensagens, deleta 80% (mantém apenas 4)
    IF v_message_count >= 20 THEN
      -- Buscar IDs das mensagens mais antigas (exceto as 4 mais recentes)
      FOR v_oldest_messages IN
        SELECT id
        FROM tb_whatsapp_messages
        WHERE whatsapp_contact_id = NEW.whatsapp_contact_id
        ORDER BY created_at ASC
        LIMIT (v_message_count - v_messages_to_keep)
      LOOP
        DELETE FROM tb_whatsapp_messages
        WHERE id = v_oldest_messages.id;
      END LOOP;
      
      RAISE NOTICE 'Limpeza automática: % mensagens deletadas, % mantidas para contato %', 
        (v_message_count - v_messages_to_keep), 
        v_messages_to_keep, 
        NEW.whatsapp_contact_id;
    END IF;
  END IF;
  
  -- Retorna o registro para permitir o INSERT
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger na tabela tb_whatsapp_messages
DROP TRIGGER IF EXISTS trigger_clean_whatsapp_message_history ON tb_whatsapp_messages;
CREATE TRIGGER trigger_clean_whatsapp_message_history
  BEFORE INSERT ON tb_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION clean_message_history_before_insert();

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON FUNCTION clean_message_history_before_insert() IS 
'Limpa automaticamente o histórico de mensagens antes de inserir nova mensagem. Mantém apenas as 4 mensagens mais recentes quando há 20 ou mais mensagens.';

-- ============================================
-- NOTA: Se você tiver outras tabelas de mensagens
-- (ex: tb_messages, tb_conversations, etc),
-- pode criar triggers similares para cada uma
-- ============================================
