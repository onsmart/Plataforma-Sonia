# Planos da Plataforma Sonia — permissões por plano

Documento de referência alinhado ao catálogo oficial em `BackEnd/src/config/plans.catalog.ts` e às regras em `BackEnd/src/utils/plan-helper.ts`.

**Última revisão:** maio/2026

---

## Visão geral das linhas

| Linha | ID interno | Foco |
|-------|------------|------|
| **Sonia Receptiva** | `rec_*` | IA **inbound** — WhatsApp, FAQ, triagem, fluxos. **Sem** SDR/campanhas ativas. |
| **Sonia Completa** | `com_*` | IA **receptiva + ativa** — cadências, prospecção, outbound/SDR. |

Cada linha tem três níveis: **Start**, **Growth**, **Enterprise**.

---

## Tabela comparativa (limites e recursos)

| Recurso | REC Start | REC Growth | REC Enterprise | COM Start | COM Growth | COM Enterprise |
|---------|-----------|------------|----------------|-----------|------------|----------------|
| **Atendimentos/mês** | 200 | 1.500 | Sob medida (∞ operacional) | 200 | 1.500 | Sob medida |
| **Agentes ativos** | 1 | 3 | Ilimitado | 1 | 5 | Ilimitado |
| **Mensagens/mês** | Ilimitado* | Ilimitado* | Ilimitado* | Ilimitado* | Ilimitado* | Ilimitado* |
| **Base de conhecimento (RAG)** | Não | Sim | Sim | Não | Sim | Sim |
| **IA ativa / SDR / outbound** | Não | Não | Não | Sim | Sim | Sim |
| **Governança avançada (AI Guardrails)** | Não | Não | Sim | Não | Não | Sim |
| **SSO** | Não | Não | Sim | Não | Não | Sim |
| **Implantação dedicada** | Não | Não | Sim | Não | Não | Sim |

\* No catálogo, `messages` está como `null` (sem teto mensal separado); o controle comercial principal é por **atendimentos** (sessões em `tb_service_sessions`).

### IDs internos e títulos

| ID | Código | Título |
|----|--------|--------|
| `rec_start` | REC_START | Sonia Receptiva — Start |
| `rec_growth` | REC_GROWTH | Sonia Receptiva — Growth |
| `rec_enterprise` | REC_ENTERPRISE | Sonia Receptiva — Enterprise |
| `com_start` | COM_START | Sonia Completa — Start |
| `com_growth` | COM_GROWTH | Sonia Completa — Growth |
| `com_enterprise` | COM_ENTERPRISE | Sonia Completa — Enterprise |

---

## O que cada plano **pode** fazer

### Sonia Receptiva — Start (`rec_start`)

- Até **200 atendimentos/mês** (novas sessões; conversa já aberta pode continuar conforme regras de sessão).
- **1 agente** ativo.
- Atendimento **inbound** (WhatsApp, fluxos receptivos).
- Proteções básicas de runtime do agente (defaults de segurança no chat — ver seção Governança).

### Sonia Receptiva — Growth (`rec_growth`)

- Tudo do Start, com:
- Até **1.500 atendimentos/mês**.
- Até **3 agentes** ativos.
- **RAG** (base de conhecimento / skills com documentos).

### Sonia Receptiva — Enterprise (`rec_enterprise`)

- Tudo do Growth, com:
- Volume de atendimentos **sob medida** (sem teto fixo no catálogo).
- **Agentes ilimitados**.
- **Governança avançada** configurável (tela AI Guardrails, `tb_governance_configs`).
- **SSO**.
- **Implantação dedicada** (flag comercial; integrações sob proposta).

### Sonia Completa — Start (`com_start`)

- Mesmos limites de volume/agentes do REC Start (200 atendimentos, 1 agente).
- Inclui **IA ativa**: cadências SDR leves, campanhas outbound (gate `canUseActiveOutbound`).
- **Sem RAG** no Start.

### Sonia Completa — Growth (`com_growth`)

- Até **1.500 atendimentos/mês**, **5 agentes**, **RAG**, **IA ativa**.

### Sonia Completa — Enterprise (`com_enterprise`)

- Mesmos benefícios Enterprise da linha Receptiva + **IA ativa** em escala.

---

## O que cada plano **não** tem acesso

| Restrição | Planos afetados | Mensagem típica no sistema |
|-----------|-----------------|---------------------------|
| Mais atendimentos no mês | Quem atingiu o teto (ex.: Growth 1500/1500) | *"Atualize seu plano..."* — bloqueio no webhook WhatsApp |
| Mais agentes ativos | Start/Growth ao exceder limite | Sugestão de upgrade (`canCreateAgent` / `canActivateAgent`) |
| **RAG** | REC Start, COM Start | *"Base de conhecimento (RAG) não está incluída no plano..."* |
| **IA ativa / SDR** | Toda linha **Receptiva** (`rec_*`) | *"Operação ativa está disponível apenas nos planos Sonia Completa..."* |
| **Governança avançada** | Todos exceto **Enterprise** | *"Governança avançada está disponível apenas no plano Enterprise da linha Receptiva/Completa."* |
| **SSO** | Todos exceto **Enterprise** | *"SSO está disponível apenas no plano Enterprise..."* |
| Assinatura inativa | Qualquer plano sem `active`/`trialing` | Bloqueios gerais de uso até regularizar billing |

---

## Governança — o que significam os logs

### Exemplo visto no servidor

```
[WARN] [getGovernanceConfig] 🚫 Governance não permitido para este plano
[ERROR] [getGovernanceConfig] Erro: Governança avançada está disponível apenas no plano Enterprise da linha Receptiva.
```

### O que aconteceu

1. A empresa está no plano **Sonia Receptiva — Growth** (`rec_growth`) — plano com `hasGovernance: false`.
2. Algo no backend chamou `getGovernanceConfig(companiesId)` da **camada de serviço** (`governance.service.ts`), que valida o plano com `canUseGovernance()` **antes** de ler `tb_governance_configs`.
3. A validação **bloqueou** corretamente e registrou WARN + ERROR.

Isso **não é falha de infraestrutura**: é o **gate de plano** funcionando.

### Onde isso é disparado

- Carregamento da tela **Governança** / **Configurações** (quando chama o serviço com checagem de plano).
- Runtime do **agente** (`chatwithAgent`) ao montar o bundle de governança.
- Outros fluxos que importam `getGovernanceConfig` do módulo `services/governance`.

### Importante: chat continua com proteção básica

Mesmo sem plano Enterprise, o agente usa **`FALLBACK_GOVERNANCE_FOR_PREPROCESS`** (anti-jailbreak, anti-alucinação recomendados, DLP de cartão/e-mail/telefone, etc.). O que o Growth **não** tem é:

- Tela para **editar** guardrails avançados.
- Persistência personalizada em `tb_governance_configs` via API de governança (serviço bloqueado por plano).

A rota HTTP `GET /governance` (controller) hoje **não** aplica o mesmo gate — pode retornar defaults; o log que você viu vem do **serviço** usado em runtime e em fluxos internos.

### Como parar os logs (opções)

1. **Esperado:** usar plano **Enterprise** se precisar de governança configurável.
2. **Produto:** esconder menu Governança no front para planos sem `hasGovernance` (evita chamadas repetidas).
3. **Código:** trocar ERROR por WARN e retornar `null` sem `throw` no serviço (menos ruído no log; comportamento igual).

---

## Outro aviso nos logs: `[inbox-stuck]`

```
Could not find a relationship between 'tb_whatsapp_messages' and 'tb_whatsapp_contacts' in the schema cache
```

Isso é **independente** da governança: a query do inbox usa join/embed Supabase sem FK reconhecida no PostgREST. Corrigir com migration/FK ou ajustar a query — não está relacionado ao plano.

---

## Funções de verificação no código

| Função | Arquivo | Uso |
|--------|---------|-----|
| `getPlanInfo` | `plan-helper.ts` | Plano + limites da empresa |
| `canStartNewAtendimento` | `plan-helper.ts` | Limite mensal de sessões |
| `canCreateAgent` / `canActivateAgent` | `plan-helper.ts` | Limite de agentes |
| `canUseRAG` | `plan-helper.ts` | Base de conhecimento |
| `canUseActiveOutbound` | `plan-helper.ts` | SDR / campanhas ativas |
| `canUseGovernance` | `plan-helper.ts` | Governança avançada |
| `canUseSSO` | `plan-helper.ts` | Single sign-on |

Catálogo estático: `BackEnd/src/config/plans.catalog.ts` → `SONIA_PLANS`.

---

## Assinatura inativa

Se `tb_subscriptions.status` não for `active` ou `trialing`, as funções `can*` retornam `allowed: false` mesmo que o plano no papel seja Growth/Enterprise — é necessário billing ativo.

---

## Referência rápida — seu caso (Growth Receptivo)

Empresa `e95017dc-...` nos logs:

| Item | Status no REC Growth |
|------|----------------------|
| Atendimentos | 1.500/mês (você atingiu 1500/1500) |
| Agentes | até 3 |
| RAG | Sim |
| Outbound/SDR | Não (linha Receptiva) |
| Governança avançada | **Não** → gera os WARN/ERROR ao abrir config de governança |
| SSO / Enterprise | Não |

Para governança configurável: upgrade para **Sonia Receptiva — Enterprise** (`rec_enterprise`).
