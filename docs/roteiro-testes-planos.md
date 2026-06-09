# Roteiro de Testes — Planos Start e Growth Receptivo

**Data de criação:** 2026-06-09  
**Ambiente:** Staging / Produção (Supabase `rmfbkyntvkpettjtgaws`)

---

## Contas de teste

| Conta | Email | Senha | Plano | Empresa |
|-------|-------|-------|-------|---------|
| **A — Start** | `test.start@sonia.test` | `Sonia@2026Test` | `rec_start` — active | Teste Plano Start |
| **B — Growth** | `test.growth@sonia.test` | `Sonia@2026Test` | `rec_growth` — active | Teste Plano Growth |

> **Nota de cache:** o backend cacheia o plano ativo por 5 minutos. Se alterar o plano via SQL durante os testes, aguarde 5 min antes de testar o gate.

---

## Como registrar resultados

Use a legenda abaixo nas colunas de resultado:

| Símbolo | Significado |
|---------|-------------|
| ✅ | Passou — comportamento correto |
| ❌ | Falhou — comportamento incorreto |
| ⚠️ | Parcial — funcionou com ressalvas |
| ⏭️ | Pulado |

---

## Bloco 1 — Plano Start (`test.start@sonia.test`)

### 1.1 Login e workspace

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 1 | Logar com `test.start@sonia.test` / `Sonia@2026Test` | Login com sucesso, workspace "Teste Plano Start" | | |
| 2 | Acessar **Configurações → Billing** | Exibe plano **Receptivo Start**, botão "Upgrade" visível | | |
| 3 | Verificar endpoint de uso: `GET /billing/usage` | `plan: rec_start`, `conversationsLimit: 200`, `agentsLimit: 1` | | |

---

### 1.2 Agentes — limite de 1

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 4 | Criar 1 agente normalmente | Agente criado com sucesso | | |
| 5 | Ativar o agente criado | Agente ativo | | |
| 6 | Tentar criar um **2º agente** | **Bloqueado — HTTP 403**, mensagem de upgrade | | |
| 7 | Tentar ativar um 2º agente (se criado via SQL) | **Bloqueado — HTTP 403** | | |

---

### 1.3 Criar agente com IA — arquétipos disponíveis

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 8 | Abrir dialog **"Criar agente com IA"** | Fase "Tipo de agente" exibida | | |
| 9 | Verificar card **FAQ** | Selecionável, marcado como padrão | | |
| 10 | Verificar card **Receptivo** | Desabilitado, badge **"Growth"**, texto "Disponível no plano Growth." | | |
| 11 | Verificar card **SDR** | Desabilitado, badge **"Em breve"** | | |
| 12 | Tentar clicar no card Receptivo | Não seleciona, cursor `not-allowed` | | |

---

### 1.4 Base de conhecimento (RAG) — bloqueada no Start

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 13 | Acessar seção **Knowledge / Base de Conhecimento** | Página carrega | | |
| 14 | Tentar **upload de arquivo** | **Bloqueado — HTTP 403**, `code: PLAN_RAG_REQUIRED`, `upgradePlan: rec_growth` | | |
| 15 | Tentar criar **texto manual** na base | **Bloqueado — HTTP 403** | | |

---

### 1.5 Fluxos visuais — bloqueados no Start

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 16 | Acessar página de **Fluxos** | Página carrega (pode listar fluxos existentes) | | |
| 17 | Tentar criar **novo fluxo** | **Bloqueado — HTTP 403**, `code: PLAN_FLOWS`, `upgradePlan: rec_growth` | | |
| 18 | Tentar **editar** fluxo existente | **Bloqueado — HTTP 403** | | |
| 19 | Tentar **publicar** fluxo | **Bloqueado — HTTP 403** | | |
| 20 | Tentar **gerar fluxo com IA** | **Bloqueado — HTTP 403** | | |

---

### 1.6 Integrações CRM — bloqueadas no Start

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 21 | Acessar página de **Integrações CRM** | Página carrega, listagem visível *(gap conhecido — sem gate de leitura)* | | |
| 22 | Tentar **salvar/criar** integração CRM | **Bloqueado — HTTP 403**, `code: PLAN_CRM_API` | | |
| 23 | Tentar **testar** conexão CRM | **Bloqueado — HTTP 403** | | |
| 24 | Tentar **excluir** integração CRM | **Bloqueado — HTTP 403** | | |

---

### 1.7 Funcionalidades que devem funcionar no Start

| # | Funcionalidade | Resultado esperado | Resultado | Observação |
|---|----------------|--------------------|-----------|------------|
| 25 | Playground com agente ativo | Funciona | | |
| 26 | Inbox (painel de atendimentos) | Funciona | | |
| 27 | Dashboard / Home com métricas | Funciona | | |
| 28 | Canal WhatsApp — receber mensagens | Funciona (dentro do limite de 200/mês) | | |

---

## Bloco 2 — Plano Growth (`test.growth@sonia.test`)

### 2.1 Login e workspace

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 29 | Logar com `test.growth@sonia.test` / `Sonia@2026Test` | Login com sucesso, workspace "Teste Plano Growth" | | |
| 30 | Acessar **Configurações → Billing** | Exibe plano **Receptivo Growth** | | |
| 31 | Verificar endpoint de uso: `GET /billing/usage` | `plan: rec_growth`, `conversationsLimit: 1500`, `agentsLimit: 3` | | |

---

### 2.2 Agentes — limite de 3

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 32 | Criar **1º agente** | Sucesso | | |
| 33 | Criar **2º agente** | Sucesso | | |
| 34 | Criar **3º agente** | Sucesso | | |
| 35 | Tentar criar **4º agente** | **Bloqueado — HTTP 403**, sugestão de upgrade para `rec_enterprise` | | |

---

### 2.3 Criar agente com IA — arquétipos disponíveis

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 36 | Abrir dialog **"Criar agente com IA"** | Fase "Tipo de agente" exibida | | |
| 37 | Verificar card **FAQ** | Selecionável | | |
| 38 | Verificar card **Receptivo** | Selecionável, badge **"Popular"**, marcado como padrão | | |
| 39 | Verificar card **SDR** | Desabilitado, badge **"Em breve"** | | |
| 40 | Selecionar **Receptivo** e avançar | Fase de Integrações carrega normalmente | | |

---

### 2.4 Base de conhecimento (RAG) — liberada no Growth

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 41 | Fazer **upload de arquivo** PDF ou DOCX | Sucesso — arquivo processado | | |
| 42 | Criar **texto manual** na base | Sucesso | | |
| 43 | Testar no Playground se o agente consulta a base | Funciona com RAG | | |

---

### 2.5 Fluxos visuais — liberados no Growth

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 44 | Criar **novo fluxo** | Sucesso | | |
| 45 | **Editar** fluxo | Sucesso | | |
| 46 | **Publicar** fluxo | Sucesso | | |
| 47 | **Gerar fluxo com IA** | Sucesso | | |

---

### 2.6 Integrações CRM — liberadas no Growth

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 48 | **Criar** integração CRM | Sucesso | | |
| 49 | **Testar** conexão CRM | Sucesso | | |
| 50 | **Excluir** integração CRM | Sucesso | | |

---

## Bloco 3 — Verificação de limites via endpoint

Esses testes podem ser feitos com o browser aberto no **DevTools → Network**, ou via curl/Postman com o JWT do usuário logado.

### 3.1 Endpoint `/billing/usage`

Após logar com cada conta, acessar **Configurações → Billing** e observar os valores retornados:

| Campo esperado | Start | Growth |
|---------------|-------|--------|
| `plan` | `rec_start` | `rec_growth` |
| `conversationsLimit` | `200` | `1500` |
| `agentsLimit` | `1` | `3` |
| `hasFlows` | `false` | `true` |
| `hasRag` | `false` | `true` |
| `hasCrmApi` | `false` | `true` |

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 51 | Verificar `/billing/usage` na conta Start | Campos acima com valores Start | | |
| 52 | Verificar `/billing/usage` na conta Growth | Campos acima com valores Growth | | |

---

## Bloco 4 — Teste de downgrade (opcional)

> Esses testes validam o comportamento quando uma conta paga é rebaixada para um plano menor.  
> **Rodar no Supabase SQL Editor após concluir os blocos anteriores.**

### SQL para simular downgrade

```sql
-- Downgrade Growth → Start
UPDATE tb_subscriptions
SET plan = 'rec_start'
WHERE companies_id = '05a387f2-0c1f-45d5-9265-b235468201f3';

-- Aguardar 5 minutos (cache de plano) ou reiniciar o backend
```

| # | Ação | Resultado esperado | Resultado | Observação |
|---|------|--------------------|-----------|------------|
| 53 | Conta Growth degradada para Start tenta criar fluxo | **Bloqueado — 403** (após cache expirar) | | |
| 54 | Conta degradada tenta ativar 3º agente | **Bloqueado — 403** | | |

### SQL para restaurar

```sql
UPDATE tb_subscriptions
SET plan = 'rec_growth', status = 'active'
WHERE companies_id = '05a387f2-0c1f-45d5-9265-b235468201f3';
```

---

## Gaps conhecidos (não são bugs prioritários)

| Gap | Comportamento atual | Impacto |
|-----|---------------------|---------|
| Listagem CRM sem gate | Usuário Start **vê** a lista de integrações CRM, mas não consegue criar/editar | Baixo — operações de escrita estão bloqueadas |
| Bloqueio de atendimento não retorna HTTP 403 ao usuário final | O 201º atendimento é bloqueado silenciosamente na `service-session`; o operador vê via painel | Médio — UX do cliente pode ser confusa |
| Cache de 5 min após mudança de plano | Após upgrade/downgrade via SQL, gates levam até 5 min para atualizar | Operacional |

---

## Referência rápida — IDs das contas

| Conta | `companies_id` | `user_id` (tb_users) |
|-------|---------------|----------------------|
| Start | `483ab1bf-a41f-463d-a544-423f52b0bd0d` | `1016d33c-8254-4771-9351-e33aa12c5ef3` |
| Growth | `05a387f2-0c1f-45d5-9265-b235468201f3` | `b503aec5-15d9-4140-8a93-dbbfd879ffc0` |

### SQL de verificação rápida

```sql
SELECT u.email, c.name AS empresa, s.plan, s.status, s.current_period_end::date AS expira
FROM tb_subscriptions s
JOIN tb_companies c      ON c.id = s.companies_id
JOIN tb_company_users cu ON cu.companies_id = c.id
JOIN tb_users u          ON u.id = cu.user_id
WHERE u.email IN ('test.start@sonia.test', 'test.growth@sonia.test')
ORDER BY u.email;
```
