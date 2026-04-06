# Checklist de Testes - WhatsApp Oficial da Meta

## 1. Pré-requisitos

- [ ] Backend rodando e acessível
- [ ] Endpoint `GET/POST /whatsapp/webhook` publicado
- [ ] Integração cadastrada com `provider=whatsapp`
- [ ] Campos preenchidos na integração: `phone_number`, `app_key`, `access_token`, `auth_token`
- [ ] Agente vinculado à integração WhatsApp
- [ ] Agente com `status_id = 1`
- [ ] Webhook da Meta configurado com o mesmo `Verify Token`

## 2. Validação de configuração

- [ ] Abrir a tela de integrações e salvar o número oficial da Meta
- [ ] Confirmar que o `Phone Number ID` foi salvo
- [ ] Confirmar que o `Access Token` foi salvo
- [ ] Confirmar que o `Verify Token` foi salvo
- [ ] Confirmar que o agente correto está alocado ao número
- [ ] Validar `GET /whatsapp/status?integration_id=...`
- [ ] Resultado esperado: status `connected`

## 3. Teste de laboratório

- [ ] Criar ou selecionar um template
- [ ] Criar um agente a partir do template
- [ ] Abrir o laboratório/playground
- [ ] Enviar uma mensagem simples
- [ ] Validar que o agente responde
- [ ] Validar que o comportamento do template aparece na resposta
- [ ] Validar que o agente continua funcionando com RAG, se houver arquivos vinculados

## 4. Teste local de webhook sem Meta

- [ ] Rodar `node BackEnd/scripts/testar-whatsapp-meta-local.js 15558991881 5511999999999 "Teste oficial local"`
- [ ] Confirmar resposta HTTP 200 no webhook
- [ ] Validar que a mensagem inbound foi persistida
- [ ] Validar que um contato foi criado ou atualizado
- [ ] Validar que o agente vinculado foi acionado
- [ ] Validar que a resposta outbound foi persistida

## 5. Teste real no celular

- [ ] Enviar mensagem real do celular para o número oficial
- [ ] Confirmar recebimento no webhook
- [ ] Confirmar criação da mensagem em `tb_whatsapp_messages`
- [ ] Confirmar vínculo com o contato correto
- [ ] Confirmar que o agente respondeu no mesmo canal
- [ ] Confirmar entrega da resposta no celular

## 6. Teste de histórico e Inbox

- [ ] Abrir a listagem de conversas do WhatsApp
- [ ] Validar exibição da conversa atual
- [ ] Abrir a conversa e validar histórico inbound/outbound
- [ ] Validar atualização de status de mensagem quando a Meta enviar status
- [ ] Validar contagem de não lidas

## 7. Teste de falhas controladas

- [ ] Remover temporariamente o `Access Token` e validar erro de conexão
- [ ] Informar `Verify Token` incorreto e validar falha na verificação
- [ ] Desvincular o agente e validar que a mensagem entra sem automação
- [ ] Pausar o agente e validar que ele não responde automaticamente

## 8. Critérios de aceite

- [ ] Laboratório funcionando
- [ ] Webhook oficial funcionando
- [ ] Mensagens inbound persistidas
- [ ] Respostas outbound enviadas pela Meta
- [ ] Histórico da conversa consistente
- [ ] Nenhum fluxo não oficial necessário para operar
