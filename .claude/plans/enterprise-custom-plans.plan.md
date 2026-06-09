# Plano: Configuração de Planos Enterprise Personalizados

Status: **rascunho** — não executado

---

## Objetivo

Permitir que a equipe comercial da Onsmart configure planos enterprise com limites, capacidades e preços personalizados por empresa cliente, sem depender de código novo a cada contrato.

---

## Como funciona hoje

Os planos são estáticos: definidos em `BackEnd/src/config/plans.catalog.ts` e lidos via `plan-helper.ts`. Cada empresa (`tb_companies`) recebe um `plan_id` string, e o backend busca os limites no catálogo. Não há override por empresa — todos com `rec_enterprise` teriam os mesmos limites.

---

## Como funcionaria enterprise personalizado

### Fase 1 — Banco: tabela de overrides por empresa

Nova tabela `tb_plan_overrides` no Supabase:

```sql
CREATE TABLE tb_plan_overrides (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companies_id    uuid NOT NULL REFERENCES tb_companies(id) ON DELETE CASCADE,
  max_agents      integer,          -- null = ilimitado
  max_attendances integer,          -- null = ilimitado
  has_rag         boolean,
  has_flows       boolean,
  has_crm_api     boolean,
  has_outbound    boolean,
  has_sso         boolean,
  has_governance  boolean,
  custom_label    text,             -- nome exibido na UI, ex: "Enterprise Clínica Saúde+"
  notes           text,             -- uso interno comercial
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz,      -- null = indefinido
  created_by      text,             -- email do admin que configurou
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Apenas 1 override ativo por empresa
CREATE UNIQUE INDEX ON tb_plan_overrides (companies_id)
  WHERE valid_until IS NULL OR valid_until > now();
```

### Fase 2 — Backend: plan-helper lê overrides

Em `plan-helper.ts`, ao chamar `getPlanInfo(companiesId)`:

1. Buscar em `tb_plan_overrides` se existe registro ativo para o `companiesId`.
2. Se existir, mesclar com o catálogo base: override tem prioridade sobre o catálogo.
3. Fallback para catálogo padrão se não houver override.

```typescript
// lógica em plan-helper.ts
const override = await getActivePlanOverride(companiesId)
if (override) {
  return mergeWithCatalog(basePlan, override)
}
```

Cache recomendado: TTL de 5 minutos por `companiesId` (evitar query a cada request).

### Fase 3 — API admin: endpoint para configurar override

Rota: `POST /admin/plan-overrides` (requer `requireAdmin`)

Payload:
```json
{
  "companies_id": "uuid",
  "max_agents": 10,
  "max_attendances": 5000,
  "has_rag": true,
  "has_flows": true,
  "has_crm_api": true,
  "has_outbound": true,
  "has_sso": true,
  "has_governance": true,
  "custom_label": "Enterprise Saúde Plus",
  "notes": "Contrato #123 — vigência 12 meses",
  "valid_until": "2027-06-01T00:00:00Z"
}
```

Também: `GET /admin/plan-overrides?companies_id=uuid` e `DELETE /admin/plan-overrides/:id`.

### Fase 4 — UI admin (painel interno)

Tela em `/admin/enterprise` (acessível apenas `isPlatformAdmin`):

- Lista de empresas com override ativo (tabela: empresa, label, limites, validade)
- Formulário para criar/editar override de uma empresa
- Destaque visual quando override expira em < 30 dias

### Fase 5 — UI cliente: exibir label personalizado

Em `BillingPlansSection.tsx` e `Home.tsx`:
- Se `custom_label` existir no retorno de `GET /billing/usage`, exibir esse label no lugar de "Enterprise"
- Badge "Personalizado" ao lado do nome do plano

### Fase 6 — Auditoria e alertas

- Todo `POST/DELETE /admin/plan-overrides` → `recordSecurityAuditEvent`
- Alerta automático (e-mail via Resend) quando override expira em 30 dias
- Log no Grafana/Loki: queries ao override por empresa

---

## Sequência de execução

| Fase | Esforço estimado | Dependências |
|------|-----------------|--------------|
| 1 — Migration `tb_plan_overrides` | 1h | `SUPABASE_SCHEMA_REFERENCE.md` atualizado |
| 2 — plan-helper lê overrides | 2h | Fase 1 concluída |
| 3 — API admin `/admin/plan-overrides` | 3h | Fase 2 + `requireAdmin` middleware |
| 4 — UI admin `/admin/enterprise` | 4h | Fase 3 |
| 5 — UI cliente exibe custom_label | 1h | Fase 2 |
| 6 — Auditoria e alertas | 2h | Resend configurado (P1 pendente) |

**Total estimado: ~13h de desenvolvimento**

---

## Fluxo operacional (como a equipe comercial usa)

```
1. Comercial fecha contrato enterprise → informa: empresa, limites, validade
2. Admin técnico acessa /admin/enterprise
3. Preenche formulário de override (ou usa endpoint via curl/Postman)
4. Override ativo imediatamente — sem deploy necessário
5. Cliente vê plano "Enterprise [Label]" na tela de billing
6. 30 dias antes do vencimento → alerta automático para comercial renovar
7. Se não renovar → override expira → empresa cai para plan_id base (ex: rec_growth)
```

---

## Arquivos que serão tocados

| Arquivo | Mudança |
|---------|---------|
| `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md` | Nova tabela `tb_plan_overrides` |
| `BackEnd/src/utils/plan-helper.ts` | Lógica de merge com override |
| `BackEnd/src/api/routes/admin.routes.ts` | Novas rotas `/admin/plan-overrides` |
| `BackEnd/src/api/controllers/admin.controller.ts` | CRUD de overrides |
| `FrontEnd/src/components/configuration/BillingPlansSection.tsx` | Exibir `custom_label` |
| `FrontEnd/src/pages/Home.tsx` | Exibir `custom_label` |
| `FrontEnd/src/pages/Admin.tsx` (novo ou existente) | Tela admin de overrides |
| `BackEnd/database/migrations/` | Migration SQL da tabela |

---

## Não inclui neste plano

- Integração Stripe para enterprise (billing manual ou PO — definir com comercial)
- SSO/SAML (plano separado)
- Multi-workspace (escopo futuro)
