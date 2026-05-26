# Permissões por plano — Plataforma Sonia

Documento de referência alinhado ao código em `BackEnd/src/config/plans.catalog.ts` e `BackEnd/src/utils/plan-helper.ts` (maio/2026).

## Por que apareceram os logs de Governança no terminal?

Você estava no plano **Enterprise** (`enterprise` no banco → `com_enterprise` no app) e passamos para **Start** (`pro` no banco → `rec_start`) para testar o limite de 200 atendimentos.

No **rec_start**, `hasGovernance: false`. A tela **Caixa de entrada** (e outras rotas) chama periodicamente o backend para carregar mensagens; em `getCurrentWhatsAppConversationMessages` o sistema tenta carregar a config de governança para mascarar dados (DLP). O serviço `governance.service.ts` valida o plano, registra **WARN** + **ERROR** e retorna `null` (usa fallback seguro).

Isso **não quebra** o WhatsApp nem a Inbox — é ruído de log esperado com plano Start aberto em telas que consultam governança. Os intervalos (~10s) vêm do polling da interface, não de um bug novo.

Para silenciar: feche a Inbox/Configurações ou volte temporariamente para Enterprise só se precisar testar a tela de Governança.

---

## IDs de plano no banco

| Valor legado em `tb_subscriptions.plan` | Interpretado pelo app (`normalizePlanId`) |
|----------------------------------------|-------------------------------------------|
| `pro` | `rec_start` |
| `plus` | `com_growth` |
| `enterprise` | `com_enterprise` |
| `rec_start`, `rec_growth`, `rec_enterprise` | iguais |
| `com_start`, `com_growth`, `com_enterprise` | iguais |

Fonte: `plans.catalog.ts` → `LEGACY_PLAN_MAP`.

---

## Tabela resumo (6 planos oficiais)

Legenda: **Sim** = incluído | **Não** = bloqueado no app | **∞** = sem teto no código (`null`).

| Recurso | rec_start | rec_growth | rec_enterprise | com_start | com_growth | com_enterprise |
|--------|:---------:|:----------:|:--------------:|:---------:|:----------:|:--------------:|
| **Linha** | Receptiva | Receptiva | Receptiva | Completa | Completa | Completa |
| **Atendimentos/mês** (sessões) | 200 | 1.500 | ∞ | 200 | 1.500 | ∞ |
| **Agentes ativos** | 1 | 3 | ∞ | 1 | 5 | ∞ |
| **RAG / Knowledge Base** | Não | Sim | Sim | Não | Sim | Sim |
| **SSO** | Não | Não | Sim | Não | Não | Sim |
| **Governança avançada** (tela + config DB) | Não | Não | Sim | Não | Não | Sim |
| **IA ativa / SDR / outbound** | Não | Não | Não | Sim | Sim | Sim |
| **Deploy customizado** | Não | Não | Sim | Não | Não | Sim |
| **Mensagens (limite separado)** | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ |

Critério de **atendimento**: 1 sessão em `tb_service_sessions` por novo atendimento no mês (encerra por fluxo completo, inatividade configurável, reinício “oi/menu”, etc.). Sessão já aberta pode continuar mesmo no limite.

---

## O que cada gate faz no backend

Funções em `plan-helper.ts` — usadas em webhooks, agentes, billing, governança, campanhas.

### Assinatura ativa

Quase todos os gates exigem `tb_subscriptions.status` ∈ `active` | `trialing`. Caso contrário: bloqueio com mensagem de upgrade.

### `canStartNewAtendimento` / limite mensal

- Compara contagem em `tb_service_sessions` (mês corrente) com `monthlyConversations` do plano.
- Ao atingir: bloqueia **novas** sessões no WhatsApp; notificação in-app + e-mail (Resend da plataforma).
- Mensagem travada na Inbox com `block_reason: plan_limit_atendimentos`.

### `canCreateAgent` / `canActivateAgent`

- Limite de agentes **ativos** (`status_id = 1`) conforme coluna **Agentes** na tabela acima.
- Upgrade sugerido: próximo tier da mesma linha (`rec_start` → `rec_growth` → `rec_enterprise`, ou `com_*` equivalente).

### `canUseRAG`

- Start (REC e COM): **negado** — KB/RAG só Growth+.
- Mensagem: upgrade para plano com RAG.

### `canUseActiveOutbound`

- Apenas planos **com_*** (Sonia Completa).
- Start/Growth/Enterprise **receptivos**: sem campanhas SDR/outbound ativo.

### `canUseSSO`

- Apenas **Enterprise** (REC ou COM).
- Mensagem: SSO só Enterprise da linha Receptiva ou Completa.

### `canUseGovernance`

- Apenas **rec_enterprise** e **com_enterprise** (`hasGovernance: true`).
- Start/Growth: mensagem *"Governança avançada está disponível apenas no plano Enterprise da linha Receptiva/Completa."*
- **Nota:** pré-processamento de mensagens do agente ainda usa `FALLBACK_GOVERNANCE_FOR_PREPROCESS` quando o plano não tem governança — proteções básicas continuam; a **configuração avançada** na UI fica indisponível.

---

## Detalhe por plano (catálogo comercial)

### Sonia Receptiva — Start (`rec_start`)

- 200 atendimentos/mês, 1 agente.
- Inbound/FAQ/triagem; sem outbound ativo, sem RAG, sem SSO, sem governança avançada.

### Sonia Receptiva — Growth (`rec_growth`)

- 1.500 atendimentos/mês, 3 agentes.
- RAG ligado; sem governança/SSO/outbound.

### Sonia Receptiva — Enterprise (`rec_enterprise`)

- Atendimentos e agentes ilimitados no app (`null`).
- RAG, SSO, governança, deploy custom; sem outbound ativo (linha receptiva).

### Sonia Completa — Start (`com_start`)

- Igual Start receptivo em volume (200) + **outbound/SDR** permitido.
- Sem RAG, SSO, governança.

### Sonia Completa — Growth (`com_growth`)

- 1.500 atendimentos, 5 agentes, outbound + RAG.

### Sonia Completa — Enterprise (`com_enterprise`)

- Ilimitado operacional + outbound + RAG + SSO + governança + deploy custom.

---

## Seu usuário de teste (contexto)

- E-mail: `mateus.mantovani@onsmart.com.br`
- Plano no banco (para teste de limite): `pro` → app trata como **`rec_start`**
- Empresa: `e95017dc-d649-4066-a795-fd047abe0000`
- Com esse plano: governança avançada **off** → logs WARN/ERROR ao abrir Inbox com polling; limite **200** atendimentos/mês ativo.

Para voltar a Enterprise no Supabase (exemplo):

```sql
UPDATE public.tb_subscriptions
SET plan = 'enterprise', status = 'active', updated_at = now()
WHERE companies_id = 'e95017dc-d649-4066-a795-fd047abe0000';
```

(App interpreta `enterprise` → `com_enterprise`.)

---

## Arquivos fonte no repositório

| Arquivo | Papel |
|---------|--------|
| `BackEnd/src/config/plans.catalog.ts` | Limites e flags `hasRAG`, `hasGovernance`, etc. |
| `BackEnd/src/utils/plan-helper.ts` | Gates runtime (`can*`) |
| `BackEnd/src/services/service-session.service.ts` | Contagem de atendimentos/sessões |
| `BackEnd/src/services/governance/governance.service.ts` | Bloqueio de config de governança por plano |
| `BackEnd/database/migrations/MIGRATION_TB_SUBSCRIPTIONS_PLAN_IDS.sql` | CHECK SQL para IDs novos de plano |

---

*Gerado para revisão interna. Se o comercial mudar limites, atualize primeiro `plans.catalog.ts` e depois este documento.*
