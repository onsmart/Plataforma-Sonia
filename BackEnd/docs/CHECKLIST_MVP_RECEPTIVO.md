# Checklist MVP — Sonia Receptiva

Checklist interno da equipe (não exibido na UI). Marque `[x]` conforme concluir.

**Última revisão:** maio/2026

---

## 1. Primeiros passos (por tenant / ambiente de teste)

| # | Item | Como validar |
|---|------|----------------|
| 1 | WhatsApp conectado | Integrações: número ativo; webhook Meta com HMAC OK |
| 2 | Agente ativo | Pelo menos 1 agente com `status_id = 1` |
| 3 | Teste no Playground | `POST /agents/chat` com JWT; resposta do agente |
| 4 | Assinatura ativa | `tb_subscriptions.status` = `active` ou `trialing`; `/billing/usage` reflete o plano |

---

## 2. Stripe — configuração no projeto

### 2.1 Conta e produtos (Dashboard Stripe)

1. Acesse [Stripe Dashboard](https://dashboard.stripe.com) (use **modo Test** até o GA).
2. **Products** → criar produtos (opcional) ou ir direto em **Prices** (recorrência **mensal**):
   - **Sonia Receptiva — Start**
   - **Sonia Receptiva — Growth**
3. Para cada preço, copie o ID (`price_xxxxxxxx`) — não confundir com `prod_`.
4. **REC Enterprise** e planos **Completa (`com_*`)**: não criar checkout self-serve; ativação manual no Supabase + CTA vendas na UI.

### 2.2 Variáveis no `BackEnd/.env` (servidor 192.168.15.31)

**Somente assinatura mensal** — não configure preços anuais no Stripe para este MVP.

```env
# Obrigatório
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Um price_... mensal por plano (Stripe → Products → Price → Recurring → Monthly)
STRIPE_PRICE_REC_START=price_...
STRIPE_PRICE_REC_GROWTH=price_...   # obrigatório para checkout Growth (npm run go-live:verify-stripe)

# Opcional: texto na UI (senão "A definir")
PLAN_DISPLAY_REC_START=R$ 299
PLAN_DISPLAY_REC_GROWTH=R$ 899
```

Aliases legados aceitos: `STRIPE_PRICE_REC_START_MONTHLY`, `PLAN_DISPLAY_REC_START_MONTHLY` (mesmo valor).

Checkout usa a chave interna `price_rec_start_monthly` / `price_rec_growth_monthly` → mapeadas para as variáveis acima.

### 2.3 Webhook Stripe → backend

URL pública (ajuste host/porta):

```text
https://SEU_DOMINIO_OU_IP:3333/billing/webhook
```

No Stripe: **Developers → Webhooks → Add endpoint**

- Eventos mínimos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (recomendado).
- Copie o **Signing secret** (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.

**Importante:** a rota `/billing/webhook` usa corpo **raw** (registrada antes do `express.json()` em `index.ts`). Não coloque proxy que altere o body.

Teste local (Stripe CLI):

```bash
stripe listen --forward-to localhost:3333/billing/webhook
```

### 2.4 Fluxo na aplicação

1. Usuário admin em **Configuração → Assinaturas** clica **Contratar** (só planos com `checkout_available`).
2. Front chama `POST /billing/checkout` com `priceId` = `price_rec_start_monthly` (ou growth).
3. Redirecionamento para Stripe Checkout; sucesso volta para `/configuration?status=success`.
4. Webhook atualiza `tb_subscriptions` e limpa cache de plano (`clearPlanInfoCache`).
5. Confirme em até 1 min: `GET /billing/usage` com o plano e limites corretos.

### 2.5 Portal do cliente (opcional)

`POST /billing/portal` — exige assinatura Stripe existente. Configure **Customer portal** no Stripe Dashboard.

### 2.6 Front (opcional)

```env
VITE_ONSMART_SALES_URL=https://www.onsmart.ai
```

Usado no botão **Falar com vendas** (Enterprise).

---

## 3. Banco de dados e planos

| # | Item | Comando / ação |
|---|------|----------------|
| 1 | Migration IDs de plano | Aplicar `BackEnd/database/migrations/MIGRATION_TB_SUBSCRIPTIONS_PLAN_IDS.sql` |
| 2 | Auditoria | `SELECT plan, status, count(*) FROM tb_subscriptions GROUP BY plan, status` |
| 3 | Legado | `pro` → `rec_start`, `plus` → `com_growth`, `enterprise` → `com_enterprise` |

---

## 4. Go-live (staging → produção)

Comandos úteis (pasta `BackEnd`):

```bash
npm run go-live:audit
npm run go-live:verify-stripe
npm run go-live:load    # requer JWT= e API_BASE=
npx supabase db query --linked -f database/migrations/MIGRATION_TB_SUBSCRIPTIONS_PLAN_IDS.sql --yes
npx supabase db query --linked -f database/migrations/MIGRATION_FREE_PLAN_DEFAULT.sql --yes
```

| # | Item | OK |
|---|------|-----|
| 1 | Migration planos aplicada | [x] staging (2026-05-28, projeto Sonia linked) |
| 2 | Stripe webhook teste → `tb_subscriptions` atualiza | [ ] configurar `STRIPE_PRICE_REC_GROWTH`; testar checkout |
| 3 | WhatsApp: inbound + resposta agente | [ ] manual (token Meta) |
| 4 | Limite mensal (ex. 1500 Growth): bloqueio + notificação + e-mail Resend | [x] validado em prod (Resend) |
| 5 | REC Start: upload KB retorna 403 | [x] código + testes; validar tenant Start em staging |
| 6 | Playground: chat só com JWT | [x] código + `mvp-go-live-smoke.test.ts` |
| 7 | Governança Growth: tela de upgrade; sem ERROR no log do Inbox | [x] código; validar log ao abrir Inbox |
| 8 | Inbox: conversas bloqueadas por plano listadas | [x] código; validar UI com limite atingido |
| 9 | Carga staging (`npm run go-live:load`) | [ ] rodar com JWT staging |
| 10 | Resend: domínio verificado, `RESEND_*` no servidor | [x] prod |

---

## 5. Referências no código

| Tópico | Arquivo |
|--------|---------|
| Catálogo de planos | `BackEnd/src/config/plans.catalog.ts` |
| Checkout / webhook | `BackEnd/src/api/routes/billing.routes.ts` |
| Limites por plano | `BackEnd/src/utils/plan-helper.ts` |
| UI de planos | `FrontEnd/src/components/configuration/BillingPlansSection.tsx` |
| Permissões detalhadas | `BackEnd/docs/PLANOS_E_PERMISSOES.md` |
