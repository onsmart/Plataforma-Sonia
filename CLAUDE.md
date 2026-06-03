# CLAUDE.md — Plataforma de Atendimento Sonia

Regras obrigatórias para este repositório. Leia integralmente antes de qualquer tarefa.

---

## 1. Schema Supabase — fonte de verdade

Antes de **propor, escrever, revisar ou colar migrations SQL**:

1. Abrir e usar como referência: `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md`
2. Alinhar colunas, nomes de RPCs, tipos de retorno e escopo com esse documento.
3. Após aplicar uma migration, **atualizar** o mesmo `.md` no mesmo PR ou commit imediato.

Se o documento estiver desatualizado, corrija-o ou peça um inventário SQL read-only antes de assumir colunas.

---

## 2. README como mapa de arquitetura

Quando a tarefa envolver **auth**, **multi-tenant**, **billing/Stripe**, **planos**, **equipe**, **WhatsApp**, **RAG**, **fluxos**, **governança** ou **novas rotas API**:

1. Leia as seções relevantes do `README.md` antes de implementar.
2. Não reinvente fluxos documentados sem checar o código atual.

**Atualizar o README no mesmo esforço** quando houver:

| Gatilho | O que atualizar |
|---------|-----------------|
| Nova rota / prefixo HTTP | Tabela de API + diagrama de rotas |
| Fluxo novo ou alterado | Seção de fluxos + Mermaid |
| Auth, cadastro, tenant, equipe | Seções correspondentes |
| Billing, planos, gates | Planos e billing |
| Novo módulo no BackEnd | Mapa de módulos |

**Não** atualizar para: CSS/UI, copy, bugfix interno sem mudar contrato, refactor sem mudança observável.

Ao encerrar a tarefa: informar **"README atualizado (seções X)"** ou **"README não alterado (motivo)"**.

---

## 3. Segurança — tenant isolation

Aplicar em: `BackEnd/src/api/controllers/**`, `BackEnd/src/api/routes/**`, `BackEnd/src/utils/request-auth.ts`, `BackEnd/src/utils/tenant-ownership.ts`, `BackEnd/src/middleware/auth.middleware.ts`

**Regras obrigatórias:**

1. **Identidade:** após `requireAuth`, usar somente `req.user.email` / `req.user.companiesId`. **Proibido** `req.query.email`, `req.body.email`, `x-user-email`.

2. **Service role:** o backend usa Supabase service role — **RLS não protege a API**. Toda query/mutação sensível deve filtrar por `companies_id` ou usar helpers em `tenant-ownership.ts`.

3. **IDOR:** endpoints com `:id` devem validar propriedade antes de ler/atualizar/deletar. Usar:
   - `assertResourceOwnedByCompany`
   - `assertAgentDecisionOwnedByCompany`
   - `assertWhatsAppMessageOwnedByCompany`
   - `assertCalendlyIntegrationOwnedByUser`
   - `assertCRMIntegrationOwnedByUser`

4. **Rotas públicas:** webhooks exigem assinatura (Stripe, Meta, Calendly) + rate limit.

5. **RBAC:** mutações → `requirePermission('basic.write')` ou `requireAdmin`. Leituras sensíveis → `requirePermission('basic.read')`.

6. **Auditoria:** eventos críticos via `recordSecurityAuditEvent` — nunca logar tokens/senhas.

```typescript
// ❌ NUNCA
const email = req.body.email || req.headers['x-user-email']
await supabase.from('tb_agents').update(payload).eq('id', agentId)

// ✅ SEMPRE
const email = getAuthenticatedEmail(req)
const companiesId = getAuthenticatedCompaniesId(req)
await assertResourceOwnedByCompany('tb_agents', agentId, companiesId)
```

---

## 4. Planos comerciais — Start e Growth

Aplicar em: `plans.catalog.ts`, `plan-helper.ts`, `flows.controller.ts`, `crm.controller.ts`, `billing.routes.ts`, `BillingPlansSection.tsx`, `usePlanCapabilities.ts`, `plan-catalog.ts`, `plan-features.ts`

Somente **`rec_start`** e **`rec_growth`** disponíveis para self-serve. Demais planos: `coming_soon: true`, botão "Em breve".

| Plano | Inclui | Não inclui |
|-------|--------|------------|
| `rec_start` | FAQ, triagem, handoff, WhatsApp/Inbox/Playground, 1 agente, 200 atend/mês | RAG, fluxos visuais, CRM/API |
| `rec_growth` | Start + fluxos visuais, CRM/API, RAG, 3 agentes, 1.500 atend/mês | SDR/outbound, SSO, Governança Enterprise |

**Gates backend** via `plan-helper.ts`: `canUseRAG`, `canUseFlows`, `canUseCrmApi`. Bloqueio: HTTP 403 com `upgradePlan: 'rec_growth'`.

Ao adicionar recursos: definir flag de catálogo, confirmar gate backend, atualizar vitrine.

---

## 5. Dependências pendentes — não assumir que estão prontas

Consultar `.claude/rules/dependencias-producao-pendentes.md` antes de implementar infra ou assumir que algo já existe.

**Resumo do que NÃO está pronto:**
- SMTP Auth no Supabase (Resend) — confirmação de e-mail não funciona para todos
- URLs de redirect Supabase Auth para produção
- Stripe live (produtos/preços/webhook)
- OAuth Google e Microsoft
- "Criar agente com IA" (wizard — pendente)
- PM2 boot automático no servidor
- Testes E2E e suíte de integração completa

**Instrução:**
1. Não assumir que itens P0/P1 já existem — consultar a rule.
2. Não implementar infra P0/P1 sem o usuário pedir/fornecer credenciais.
3. Ao gerar fluxos/agentes com IA: nunca inventar blocos ou integrações — validar contra catálogo.
4. Ao concluir um item: atualizar `.claude/rules/dependencias-producao-pendentes.md`.

---

## 6. Planos ativos

- **BETA Deploy:** `.claude/plans/beta-sonia-deploy.plan.md` — PM2 + Cloudflare Tunnel + Vercel (rascunho, não executado).

---

## 7. Arquivos de referência rápida

| Arquivo | Uso |
|---------|-----|
| `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md` | Schema, RPCs, histórico de migrations |
| `README.md` | Arquitetura, fluxos, diagramas Mermaid, rotas |
| `BackEnd/docs/PLANOS_E_PERMISSOES.md` | Matriz completa de permissões por plano |
| `BackEnd/docs/CHECKLIST_MVP_RECEPTIVO.md` | Checklist de go-live |
| `docs/prioridades-correcoes-atualizacoes.md` | Detalhe operacional de pendências |
| `.claude/rules/` | Regras detalhadas por domínio |
| `.claude/plans/` | Planos de execução |
