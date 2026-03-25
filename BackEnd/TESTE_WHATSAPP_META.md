# Teste do WhatsApp Oficial da Meta

Este fluxo usa a Cloud API oficial da Meta no mesmo endpoint `/whatsapp/webhook` jÃ¡ usado pelo backend.

## ConfiguraÃ§Ã£o mÃ­nima

No `.env` do backend:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_META_API_VERSION=v23.0
WHATSAPP_META_VERIFY_TOKEN=troque-este-token
WHATSAPP_META_ACCESS_TOKEN=cole-o-token-permanente-da-meta
WHATSAPP_META_PHONE_NUMBER_ID=cole-o-phone-number-id-da-meta
WHATSAPP_META_BUSINESS_NUMBER=15558991881
```

## Regras importantes no banco

Na `tb_integrations` usada pelo agente:

- `phone_number` deve bater com o nÃºmero oficial da Meta em formato sÃ³ com dÃ­gitos: `15558991881`
- Se quiser atrelar o `phone_number_id` por integraÃ§Ã£o, salve esse valor em `app_key`
- Se quiser atrelar o token por integraÃ§Ã£o, salve esse valor em `access_token`

## Webhook da Meta

No painel da Meta:

1. URL de callback: `https://SEU-DOMINIO/whatsapp/webhook`
2. Verify token: o mesmo valor de `WHATSAPP_META_VERIFY_TOKEN`
3. Assine o campo `messages`

## Teste real pelo celular

1. Garanta que o agente certo esteja vinculado Ã  integraÃ§Ã£o WhatsApp.
2. Suba o backend atualizado.
3. Envie uma mensagem do seu celular para o nÃºmero oficial `+1 555-899-1881`.
4. Verifique se o webhook salva a mensagem e se o agente responde pelo mesmo canal.

## Teste local sem depender da Meta

Com o backend rodando localmente:

```bash
cd BackEnd
node scripts/testar-whatsapp-meta-local.js 15558991881 5511999999999 "Teste oficial local"
```

ParÃ¢metros:

- 1Âº: nÃºmero oficial da Meta
- 2Âº: nÃºmero do remetente
- 3Âº em diante: texto da mensagem
