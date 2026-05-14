# Informacoes cruciais de integracoes e webhooks

Atualizado em: 2026-05-14

Este arquivo registra endpoints e configuracoes operacionais importantes sem expor tokens, secrets ou chaves privadas.

## Backend

- Porta local padrao: `3333`
- URL local do backend: `http://localhost:3333`
- O frontend usa `VITE_API_URL` quando existir; se nao existir, ele reaproveita o host atual na porta `3333`.
- O projeto possui scripts e configuracoes de tunel apontando para o dominio publico `https://webhook.onsmart.ai`.

## Webhooks publicos

Use estes endpoints quando o backend estiver exposto publicamente pelo tunel/dominio:

- WhatsApp Meta callback URL: `https://webhook.onsmart.ai/whatsapp/webhook`
- Calendly webhook base URL na plataforma: `https://webhook.onsmart.ai`
- Calendly callback registrado pela plataforma: `https://webhook.onsmart.ai/calendar/webhook/:integrationId`
- Stripe billing webhook: `https://webhook.onsmart.ai/billing/webhook`, se o Stripe tambem estiver apontando para o mesmo backend publico.

Para ambiente local sem tunel:

- WhatsApp local: `http://localhost:3333/whatsapp/webhook`
- Calendly local teorico: `http://localhost:3333/calendar/webhook/:integrationId`
- Observacao: Calendly e Meta precisam acessar uma URL publica. Localhost so serve para testes manuais ou com tunel como Cloudflare/ngrok.

## Calendly

Rotas do backend:

- `GET /calendar/integrations`: lista integracoes Calendly do usuario autenticado.
- `POST /calendar/integrations`: cria integracao Calendly.
- `PUT /calendar/integrations/:id`: atualiza integracao Calendly.
- `POST /calendar/integrations/:id/test`: testa token e carrega usuario/event types.
- `GET /calendar/integrations/:id/event-types`: lista event types reais.
- `POST /calendar/integrations/:id/mappings`: salva mapeamentos entre categoria/recurso e event type.
- `POST /calendar/integrations/:id/webhook/sync`: registra o webhook no Calendly.
- `POST /calendar/webhook/:id`: recebe eventos do Calendly.

Campos importantes na configuracao:

- Personal Access Token do Calendly.
- Email da conta Calendly.
- Timezone padrao, normalmente `America/Sao_Paulo`.
- Webhook base URL: `https://webhook.onsmart.ai`.
- Escopo do webhook: `organization` por padrao.
- Mapeamentos de event types para o bloco de agenda.

Observacao importante: o endpoint final do Calendly nao deve ser digitado inteiro na tela. Informe apenas a base `https://webhook.onsmart.ai`; a plataforma monta `/calendar/webhook/:integrationId` automaticamente.

## WhatsApp Meta

Rotas do backend:

- `GET /whatsapp/webhook`: verificacao inicial da Meta.
- `POST /whatsapp/webhook`: recebimento de mensagens/eventos.
- `GET /whatsapp/status`: status da integracao.
- `POST /whatsapp/integration/current`: salva/atualiza integracao do numero atual.
- `POST /whatsapp/integration/:integrationId/templates/sync`: sincroniza templates da Meta.
- `GET /whatsapp/integration/:integrationId/templates`: lista templates sincronizados.

Configuracao na Meta:

- Callback URL: `https://webhook.onsmart.ai/whatsapp/webhook`
- Verify token: usar o valor de `WHATSAPP_META_VERIFY_TOKEN` configurado no `.env` do backend.

Nao registrar o verify token neste arquivo.

## HubSpot

O HubSpot usado pelo fluxo da clinica nao depende de webhook para o happy path inicial.

O projeto ja possui suporte backend para:

- Buscar contatos.
- Criar contato.
- Atualizar contato.
- Buscar por email, CPF ou telefone em operacoes do bloco `crm_contact`.

Pontos ainda pendentes para uso clinico mais completo:

- Criar notas reais no contato.
- Criar ticket/deal real para agendamento, urgencia, cancelamento e lista de espera.
- Sincronizar alteracoes vindas do Calendly de volta para o HubSpot.

## Fluxo da clinica

Para executar o fluxo da clinica com integracoes reais, a ordem recomendada e:

1. Validar HubSpot ja conectado.
2. Criar integracao Calendly com Personal Access Token.
3. Testar Calendly pela tela da plataforma.
4. Sincronizar event types.
5. Salvar mapeamentos de event types.
6. Registrar webhook Calendly usando `https://webhook.onsmart.ai` como base.
7. Configurar WhatsApp Meta com callback `https://webhook.onsmart.ai/whatsapp/webhook`.
8. Sincronizar templates WhatsApp aprovados.
9. Ajustar blocos do fluxo para usar os IDs reais das integracoes.

## Seguranca

- Nunca versionar `STRIPE_WEBHOOK_SECRET`, `WHATSAPP_META_VERIFY_TOKEN`, tokens do Calendly, tokens do HubSpot ou tokens da Meta.
- Este arquivo deve conter apenas endpoints, rotas e orientacoes operacionais.
- Caso o dominio publico mude, atualizar todos os exemplos `https://webhook.onsmart.ai`.
