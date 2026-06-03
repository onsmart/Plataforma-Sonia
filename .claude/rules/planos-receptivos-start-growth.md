# Planos Receptivos — Start e Growth (MVP comercial)

Aplicar quando trabalhar em: `BackEnd/src/config/plans.catalog.ts`, `BackEnd/src/utils/plan-helper.ts`, `BackEnd/src/api/controllers/flows.controller.ts`, `BackEnd/src/api/controllers/crm.controller.ts`, `BackEnd/src/api/routes/billing.routes.ts`, `FrontEnd/src/components/configuration/BillingPlansSection.tsx`, `FrontEnd/src/hooks/usePlanCapabilities.ts`, `FrontEnd/src/lib/plan-catalog.ts`, `FrontEnd/src/lib/plan-features.ts`

Somente **REC Start** (`rec_start`) e **REC Growth** (`rec_growth`) estão disponíveis para contratação self-serve. Demais planos (`rec_enterprise`, linha `com_*`) permanecem na vitrine com **`coming_soon: true`** e botão **"Em breve"** (desabilitado).

## Diferença funcional

| Plano | ID | Inclui | Não inclui |
|-------|-----|--------|------------|
| **Receptivo Start** | `rec_start` | FAQ receptiva, triagem, handoff humano, WhatsApp/Inbox/Playground, 1 agente, até 200 atendimentos/mês | RAG, fluxos visuais, CRM/API |
| **Receptivo Growth** | `rec_growth` | Tudo do Start + fluxos visuais, integrações CRM/API, RAG, 3 agentes, até 1.500 atendimentos/mês | Operação SDR/outbound, SSO, governança Enterprise |

Flags no catálogo (`BackEnd/src/config/plans.catalog.ts`):

- Start: `hasRAG: false`, `hasFlows: false`, `hasCrmApi: false`
- Growth: `hasRAG: true`, `hasFlows: true`, `hasCrmApi: true`

## Onde aplicar gates (backend)

Use `getPlanInfo` + helpers em `BackEnd/src/utils/plan-helper.ts`:

- `canUseRAG` — upload/base de conhecimento (já existente)
- `canUseFlows` — criar/editar/publicar/gerar fluxos (`flows.controller.ts`)
- `canUseCrmApi` — salvar/testar/excluir integrações CRM (`crm.controller.ts`)

Resposta padrão quando bloqueado: HTTP **403**, `code` (`PLAN_FLOWS` / `PLAN_CRM_API`) e `upgradePlan: 'rec_growth'` quando o cliente está no Start.

## Checkout e API de planos

- `isStripeCheckoutAvailable` / `SELF_SERVE_PLAN_IDS`: apenas `rec_start` e `rec_growth`
- `isPlanComingSoon`: todo plano pago que não está em `SELF_SERVE_PLAN_IDS`
- `getPlanForApi` expõe `coming_soon`, `hasFlows`, `hasCrmApi`
- `GET /billing/usage` expõe `has_flows` e `has_crm_api`

## UI de billing

Em `BillingPlansSection.tsx`:

- `checkout_available && !coming_soon` → botão **Contratar**
- `coming_soon` → botão **Em breve** (disabled)
- Detalhes do Start destacam FAQ, triagem e handoff; Growth destaca fluxos e CRM/API

## Ao adicionar novos recursos

Antes de liberar uma feature para todos os planos, decida:

1. Qual flag de catálogo controla (`hasFlows`, `hasCrmApi`, `hasRAG`, etc.)
2. Se o gate backend existe (obrigatório para mutações)
3. Se a vitrine e `plan-features` refletem a diferença Start vs Growth

Não habilite checkout self-serve para outros planos sem atualizar `SELF_SERVE_PLAN_IDS` e alinhar com produto/comercial.
