# Prioridades de correções e atualizações — Plataforma Sonia

Documento vivo para alinhar o que já foi feito, o que está em andamento e o que falta implementar ou configurar. Atualize o status (`[ ]` / `[x]`) conforme cada item for concluído.

**Última revisão:** 2026-05-19

---

## Legenda de prioridade

| Nível | Significado |
|-------|-------------|
| **P0** | Segurança, bloqueio de uso ou perda de dados — tratar antes de novas features |
| **P1** | Funcionalidade principal degradada ou risco operacional relevante |
| **P2** | Melhoria, dívida técnica ou escala — importante, não bloqueia teste imediato |
| **P3** | Nice-to-have, UX ou documentação complementar |

## Legenda de status

- `[x]` Concluído (código e/ou config validados)
- `[~]` Parcial (implementado no repo; falta deploy/config em ambiente)
- `[ ]` Pendente

---

## Concluído recentemente

| Item | Prioridade | Notas |
|------|------------|--------|
| Fechar rotas WhatsApp sem auth (`requireAuth` + ownership) | P0 | Validado manualmente com JWT em `192.168.15.31:3333` |
| Validar assinatura Meta no `POST /whatsapp/webhook` (HMAC + raw body) | P0 | `WHATSAPP_META_APP_SECRET`; teste sem header → 403 |
| Amarrar `POST /flows/execute` ao JWT (anti cross-tenant) | P0 | `req.user.email`; testes `flows-execute-auth` |
| `GRANT EXECUTE` em `sp_create_user_with_company` | P0 | Corrige 42501 no cadastro (RPC) |
| Filtrar subfluxos nos seletores (`main_only` / módulos) | P1 | Playground, Integrações, Flows |
| Mitigação bounce SMTP / handoff e-mail demo | P1 | `FLOW_HANDOFF_EMAIL_ENABLED`, guards em envio |
| Catálogo dos 6 planos (REC_* + COM_*) e limite de conversas/mês | P1 | Código no repo; preços Stripe e enforcement de cobrança ainda pendentes |

---

## P0 — Crítico (pendente ou parcial)

| Status | Item | Ação esperada |
|--------|------|----------------|
| `[~]` | **Login e cadastro com confirmação de e-mail** | Ver seção dedicada abaixo |
| `[ ]` | SMTP custom no Supabase Auth (Resend ou equivalente) | Envio real de confirmação; fim do limite “só equipe” |
| `[ ]` | Deploy backend com `dist/` atualizado no servidor | `npm run build` + reinício em `192.168.15.31` após mudanças de auth/webhook/flows |
| `[ ]` | RLS / isolamento multi-tenant no Supabase (ADR + políticas) | Documentar e aplicar onde ainda depender só de RPC |
| `[ ]` | Revisar segredos expostos em chat/logs (rotacionar se necessário) | App Secret Meta, tokens JWT, service role |

---

## P1 — Alto

| Status | Item | Ação esperada |
|--------|------|----------------|
| `[ ]` | `GET /flows` e demais rotas que ainda aceitam `email` na query/body | Padronizar `req.user.email` como em `/flows/execute` |
| `[ ]` | Arquitetura subfluxos (módulo vs produto; execução e versionamento) | Alinhar com `SUPABASE_SCHEMA_REFERENCE.md` |
| `[ ]` | Rate limits Auth (429 no painel) | Ajustar após SMTP; evitar reenvios em loop no dashboard |
| `[ ]` | URL Configuration no Supabase (Site URL + Redirect URLs) | Links de confirmação voltando ao front correto |
| `[ ]` | Testes E2E cadastro → confirmação → login | Automatizar após SMTP estável |
| `[~]` | **Configurar Stripe para os 6 planos oficiais** | Ver seção dedicada abaixo; UI já exibe “A definir” / “Sob proposta” |

---

## P2 — Médio

| Status | Item | Ação esperada |
|--------|------|----------------|
| `[ ]` | Botão “Reenviar e-mail de confirmação” na `AuthPage` | `supabase.auth.resend({ type: 'signup', email })` |
| `[ ]` | CAPTCHA no signup (Supabase Auth) | Reduzir abuso e spikes de e-mail |
| `[ ]` | Escalabilidade fila WhatsApp / workers | Monitorar Redis e PM2 no servidor |
| `[ ]` | Atualizar `SUPABASE_SCHEMA_REFERENCE.md` após migrations de auth/RLS | Regra do repositório |
| `[ ]` | Consolidar IP/base URL do backend no front (localhost vs `192.168.15.31`) | `VITE_API_URL` por ambiente |

---

## P3 — Backlog

| Status | Item |
|--------|------|
| `[ ]` | Melhorar mensagens i18n para erros de auth (SMTP, 429, não confirmado) |
| `[ ]` | Auditoria completa de cards SONIA (demais itens da revisão técnica) |
| `[ ]` | Documentar proxy/nginx para webhook Meta (se houver validação na infra) |

---

## Planos comerciais e Stripe (detalhe)

**Objetivo:** substituir Pro / Plus / Enterprise pelos **6 planos oficiais** com checkout e webhook Stripe alinhados, mantendo compatibilidade com assinaturas legadas no banco.

### Planos no código (já implementados)

| ID interno (`tb_subscriptions.plan`) | Código comercial | Linha | Limite conversas/mês (contatos distintos) |
|--------------------------------------|------------------|-------|-------------------------------------------|
| `rec_start` | REC_START | Sonia Receptiva | 200 |
| `rec_growth` | REC_GROWTH | Sonia Receptiva | 1.500 |
| `rec_enterprise` | REC_ENTERPRISE | Sonia Receptiva | sob medida (`null` = sem teto no app) |
| `com_start` | COM_START | Sonia Completa (receptiva + SDR) | 200 |
| `com_growth` | COM_GROWTH | Sonia Completa | 1.500 |
| `com_enterprise` | COM_ENTERPRISE | Sonia Completa | sob medida |

**Legado (mapeamento automático):** `pro` → `rec_start`, `plus` → `com_growth`, `enterprise` → `com_enterprise`.

**Regra de uso já ativa no backend:** 1 conversa = 1 `whatsapp_contact_id` distinto com mensagem no mês (inbound ou outbound); contato já atendido no mês não consome nova cota; campanhas outbound exigem plano **COM_***.

### Situação atual

| Etapa | Status | Observação |
|-------|--------|------------|
| Catálogo e limites (`plans.catalog.ts`, `plan-helper`) | OK | Repo |
| UI Configurações → Assinaturas (6 cards, 2 linhas) | OK | Preços exibidos como “A definir” / “Sob proposta” |
| `GET /billing/plans` e `GET /billing/usage` | OK | Uso de conversas + agentes |
| Produtos/preços no painel Stripe | **Pendente** | Valores comerciais ainda não fechados |
| Variáveis `STRIPE_PRICE_*` no `.env` do backend | **Pendente** | Sem IDs reais, checkout falha ao contratar |
| Webhook Stripe em produção | Parcial | Handler grava `plan` normalizado; depende de `STRIPE_WEBHOOK_SECRET` + deploy |

### Correção — configurar Stripe (quando os preços estiverem definidos)

#### 1. Stripe Dashboard — Products & Prices

Criar **6 produtos** (ou 2 produtos com 3 tiers cada), cada um com preço **mensal** (e opcional **anual**):

- Sonia Receptiva — Start / Growth / Enterprise  
- Sonia Completa — Start / Growth / Enterprise  

Anotar cada **Price ID** (`price_1…`) retornado pelo Stripe.

#### 2. Backend — variáveis no `BackEnd/.env`

Chaves já suportadas em `BackEnd/src/api/routes/billing.routes.ts` (nomes amigáveis no checkout):

| Variável `.env` | Chave enviada no checkout (`priceId`) | Plano gravado |
|-----------------|----------------------------------------|---------------|
| `STRIPE_PRICE_REC_START_MONTHLY` | `price_rec_start_monthly` | `rec_start` |
| `STRIPE_PRICE_REC_START_YEARLY` | `price_rec_start_yearly` | `rec_start` |
| `STRIPE_PRICE_REC_GROWTH_MONTHLY` | `price_rec_growth_monthly` | `rec_growth` |
| `STRIPE_PRICE_REC_GROWTH_YEARLY` | `price_rec_growth_yearly` | `rec_growth` |
| `STRIPE_PRICE_REC_ENTERPRISE_MONTHLY` | `price_rec_enterprise_monthly` | `rec_enterprise` |
| `STRIPE_PRICE_REC_ENTERPRISE_YEARLY` | `price_rec_enterprise_yearly` | `rec_enterprise` |
| `STRIPE_PRICE_COM_START_MONTHLY` | `price_com_start_monthly` | `com_start` |
| `STRIPE_PRICE_COM_START_YEARLY` | `price_com_start_yearly` | `com_start` |
| `STRIPE_PRICE_COM_GROWTH_MONTHLY` | `price_com_growth_monthly` | `com_growth` |
| `STRIPE_PRICE_COM_GROWTH_YEARLY` | `price_com_growth_yearly` | `com_growth` |
| `STRIPE_PRICE_COM_ENTERPRISE_MONTHLY` | `price_com_enterprise_monthly` | `com_enterprise` |
| `STRIPE_PRICE_COM_ENTERPRISE_YEARLY` | `price_com_enterprise_yearly` | `com_enterprise` |

**Legado (opcional, se ainda houver links antigos):** `STRIPE_PRICE_PRO_*`, `STRIPE_PRICE_PLUS_*`, `STRIPE_PRICE_ENT_*`.

**Obrigatórias para cobrança funcionar:**

| Variável | Uso |
|----------|-----|
| `STRIPE_SECRET_KEY` | API checkout + portal |
| `STRIPE_WEBHOOK_SECRET` | `POST /billing/webhook` (registrado no `index.ts` com body bruto) |

**Não commitar** `.env` nem colar secrets em chat/documentação pública.

#### 3. Stripe — Webhook

No Dashboard → **Developers** → **Webhooks**, endpoint apontando para o backend (ex.: `https://<host>:3333/billing/webhook` ou rota exposta via proxy):

Eventos mínimos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Copiar **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

#### 4. Deploy

Após alterar `.env` ou código de billing:

```bash
cd BackEnd && npm run build && npm start   # ou reinício do PM2 no servidor
```

Servidor de testes referenciado no projeto: `192.168.15.31:3333`.

#### 5. Validar

- [ ] `GET /billing/plans` retorna os 6 planos.  
- [ ] Configurações → Assinaturas: botão “Contratar” abre checkout Stripe (plano Start/Growth com preço configurado).  
- [ ] Enterprise: fluxo “Sob proposta” (sem price ID ou processo manual).  
- [ ] Webhook de teste no Stripe → `tb_subscriptions.plan` atualizado (`rec_*` / `com_*`).  
- [ ] `GET /billing/usage` reflete limite de conversas do plano ativo.  
- [ ] Conta em plano REC não cria campanha outbound (403 `PLAN_ACTIVE_OUTBOUND_REQUIRED`).

### Código relacionado (repo)

| Arquivo | Papel |
|---------|--------|
| `BackEnd/src/config/plans.catalog.ts` | Catálogo oficial, limites, chaves Stripe amigáveis |
| `BackEnd/src/utils/plan-helper.ts` | Enforcement agentes, RAG, conversas, outbound |
| `BackEnd/src/api/routes/billing.routes.ts` | Checkout, portal, webhook, `/plans`, `/usage` |
| `FrontEnd/src/components/configuration/BillingPlansSection.tsx` | UI dos 6 planos |
| `FrontEnd/src/lib/plan-catalog.ts` | Normalização de IDs no front |

### Pendências de produto (após Stripe)

- [ ] Definir preços e franquias Start/Growth na tabela comercial.  
- [ ] Limites por agentes, templates, integrações e funcionalidades por tier (hoje só conversas + flags básicas).  
- [ ] Bloquear criação de agentes/fluxos SDR em planos REC (além de campanhas).  
- [ ] Atualizar RPC `sp_get_subscription_usage_by_email` no Supabase para alinhar com `/billing/usage` (opcional; front já usa API quando disponível).

---

## Login e cadastro com confirmação de e-mail (detalhe)

**Objetivo:** permitir cadastro de contas de teste e produção com fluxo correto: signup → e-mail de confirmação → login, sem depender de “Confirm user” manual no painel.

### Situação atual

| Etapa | Status | Observação |
|-------|--------|------------|
| `signUp` (Supabase Auth) | OK | Cria usuário em `auth.users` |
| `sp_create_user_with_company` | OK | `GRANT` para `anon` / `authenticated` aplicado |
| Envio e-mail confirmação | **Pendente** | SMTP padrão Supabase não serve produção; limite 429 ao reenviar no painel |
| Login após cadastro | **Bloqueado** | `Email not confirmed` até confirmar e-mail ou ação manual |
| Front (`AuthPage.tsx`) | Parcial | `emailRedirectTo`, mensagem quando não há sessão; não tenta login automático sem confirmação |

### Causa raiz (e-mail não chega)

1. **SMTP padrão do Supabase:** envia basicamente para e-mails da **equipe** do projeto; outros endereços falham ou não recebem ([Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
2. **Rate limit (429):** muitas tentativas de “magic link” / reenvio no dashboard.
3. **Confirmação obrigatória ligada** sem provedor SMTP configurado.

### Correção definitiva (produção e testes reais)

#### 1. Resend (ou SMTP compatível)

1. Conta [Resend](https://resend.com) → verificar domínio (ex.: `onsmart.ai`).
2. Criar API key (`re_...`).

#### 2. Supabase — SMTP custom

Projeto: `rmfbkyntvkpettjtgaws` → **Authentication** → **SMTP Settings**:

| Campo | Valor |
|--------|--------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | API key Resend |
| Sender email | `noreply@<dominio-verificado>` |
| Sender name | `Plataforma Sonia` |

Referência: [Resend + Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)

#### 3. Supabase — URLs

**Authentication** → **URL Configuration**:

- **Site URL:** URL do front (dev: `http://localhost:3000` ou porta do Vite).
- **Redirect URLs:** mesma origem + `/**` (e URL de produção quando existir).

#### 4. Supabase — Providers

**Authentication** → **Providers** → **Email**:

- Manter **Confirm email** = ON (fluxo correto após SMTP).

#### 5. Rate limits

**Authentication** → **Rate Limits** → aumentar envio de e-mail/hora após SMTP (ex.: 30–100 em dev).

#### 6. Validar

1. **Authentication** → **Logs** — envio `sent` ou erro explícito.
2. Cadastro com e-mail novo na plataforma.
3. Abrir link no e-mail → redirect para o front.
4. Login com senha.

### Atalho só para teste interno (não substitui correção)

- **Confirm user** manual em **Authentication** → **Users**, ou  
- Desligar **Confirm email** temporariamente em dev.

Usar apenas enquanto SMTP não estiver pronto.

### Código relacionado (repo)

| Arquivo | Papel |
|---------|--------|
| `FrontEnd/src/components/auth/AuthPage.tsx` | Signup, redirect, mensagens, login |
| `FrontEnd/src/contexts/AuthContext.tsx` | `sp_login_user` após sessão |
| RPC `sp_create_user_with_company` | Perfil app + empresa |
| `BackEnd/supabase/config.toml` | Referência local (`enable_confirmations` em dev local) |

### Critérios de aceite — “login corrigido com confirmação”

- [ ] E-mail de confirmação chega para qualquer e-mail válido de teste (não só equipe Supabase).
- [ ] Link do e-mail confirma o usuário e redireciona para o front.
- [ ] Login com e-mail/senha funciona após confirmação.
- [ ] Cadastro sem confirmação pendente mostra mensagem clara (sem erro genérico / refresh token quebrado).
- [ ] Reenvio de confirmação não estoura 429 em uso normal (limites ajustados).
- [ ] Documentado no runbook: remetente, domínio e variáveis (sem colar secrets no git).

---

## Ordem sugerida de execução

1. **P0** — SMTP Auth + URLs Supabase (desbloqueia cadastro de teste “de verdade”).
2. **P0** — Deploy `build` no servidor após cada lote de segurança.
3. **P1** — Configurar Stripe (6 preços + webhook + `.env`) quando valores comerciais estiverem fechados.
4. **P1** — Padronizar auth nas demais rotas com `email` no body/query.
5. **P1** — Subfluxos e RLS conforme roadmap da auditoria.
6. **P2/P3** — UX auth (reenviar e-mail), CAPTCHA, i18n; limites finos por plano (templates, integrações).

---

## Referências no repositório

- `docs/plataforma-sonia-documentacao-tecnica.md` — visão geral
- `docs/informacoes-cruciais-integracoes-webhooks.md` — webhooks
- `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md` — schema e RPCs
- Testes: `BackEnd/src/__test__/flows-execute-auth.test.ts`, `meta-webhook*.test.ts`, `whatsapp-routes-auth.test.ts`, `plan-helper.test.ts`, `plans-catalog.test.ts`
- Catálogo de planos: `BackEnd/src/config/plans.catalog.ts`

---

*Mantenha este arquivo atualizado ao fechar cards ou aplicar migrations no Supabase.*
