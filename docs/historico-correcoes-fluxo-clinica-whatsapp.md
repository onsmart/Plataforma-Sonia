# Histórico: correções do fluxo Clínica Médica (WhatsApp)

Documento para handoff (Codex / outro agente). Resume problemas observados nos chats, causas nos logs e alterações feitas no repositório `Plataformadeatendimentosonia`.

**Data de referência:** maio/2026  
**Flow principal:** `4a52c8c1-34e0-42c6-b548-2083da50aa7e` (`Clinica Medica - Atendimento Completo`)  
**Subfluxo intake:** `2e90bea8-d582-4bbf-8933-98497fad285a`  
**Subfluxo appointment:** `8fbc137c-0b9f-43d7-acac-abc49e27cf85`  
**Empresa de teste:** `e95017dc-d649-4066-a795-fd047abe0000`  
**HubSpot (exemplo):** `5cd5d72a-84b9-4ef0-a43d-b33136d7b3f9`  
**E-mail owner/provision:** `mateus.mantovani@onsmart.com.br`

---

## 1. Comportamento desejado (requisito do usuário)

1. Coletar **somente** nome, e-mail e telefone (telefone pode vir do WhatsApp).
2. Se o paciente não existir no HubSpot → **criar/atualizar** contato com esses dados.
3. Perguntar **especialidade médica**.
4. Seguir para **agendamento** (Calendly / disponibilidade).
5. Conversa coerente, **sem repetir** pedidos nem pedir endereço/data de nascimento como obrigatórios.

---

## 2. Sintomas observados no WhatsApp

### 2.1 Primeira rodada de testes

- Menu inicial OK (`Oi` → opções 1–4).
- Ao escolher **1 (agendar)**, o bot pedia **nome, data de nascimento, endereço e telefone** (errado; deveria ser só nome, e-mail, telefone).
- Após o usuário enviar dados em bloco, pedia **e-mail** e **preferência de horário**, pulando especialidade.
- Mensagem final: *"Tive uma instabilidade ao finalizar o agendamento..."* (handoff humano).

### 2.2 Segunda rodada (loop de confirmação)

- Bot listava nome, data de nascimento, endereço, telefone e pedia confirmação.
- Usuário respondia **"Está tudo certo"** / **"Está correto sim"**.
- Bot **repetia a mesma mensagem** de confirmação indefinidamente.

### 2.3 Logs do servidor (padrão recorrente)

Trechos típicos (`npm run dev` em `~/plataform-backend/BackEnd`):

```
sf-intake-crm-lookup operation=lookup status=new
sf-intake-crm-upsert operation=upsert status=incomplete   # faltavam campos no contexto
sf-intake-collect-data → agente LLM (Completar cadastro)
Fluxo pausado ... resumeNodeId=sf-intake-collect-data reason=missing_required_fields
```

Na confirmação **sem deploy do código novo**:

```
messageLength: 3098  → chamada ao LLM (não aparecia "Resposta deterministica no cadastro (sem LLM)")
originalMessage: "Está correto sim"
pause novamente em sf-intake-collect-data
```

No agendamento:

```
sf-appointment-availability operation=availability status=incomplete
sf-appointment-status actual="incomplete" handle=default
sf-appointment-failed-handoff status=forwarded
```

Causa do handoff de agenda: `specialty_required` (campo `specialty` vazio no contexto).

---

## 3. Causas raiz (diagnóstico técnico)

| # | Problema | Causa |
|---|----------|--------|
| 1 | Pedia endereço / data de nascimento | Instruções do agente `Sonia Clinica - Cadastro e CRM` + LLM inventando formulário; templates não restringiam bem |
| 2 | Vários nós na mesma mensagem | Após `collect-data`, o executor seguia para `crm-upsert` e `triage` **sem pausar** quando o perfil estava incompleto |
| 3 | Loop de confirmação | `hasMinimalPatientProfile()` exige **e-mail**; confirmação ("sim") não preenchia e-mail → pausa eterna em `sf-intake-collect-data` + LLM repetia confirmação |
| 4 | "Está correto sim" não reconhecido | `isAffirmativeConfirmation()` não cobria **"está correto"** (só "está certo") |
| 5 | Retomada no nó errado | Resume em `sf-intake-triage` **pulava** `sf-intake-crm-upsert` mesmo após dados novos |
| 6 | Falha no agendamento | Subfluxo appointment ia direto para `availability` **sem** `specialty` no contexto |
| 7 | Código novo sem efeito no servidor | Logs mostravam `chatWithAgent` no collect — **deploy/pull não aplicado** ou processo antigo rodando |
| 8 | HubSpot no fluxo | Integração CRM no nó do fluxo (não no agente); lookup `status=new` funcionou após fix de `crmIntegrationId` em sessões anteriores |

---

## 4. Arquitetura do fluxo (referência)

### 4.1 Orquestrador principal (`clinic-main-*`)

```
Início → Atendimento inicial (agente) → Roteamento intenção (switch)
  → case:agendar → Subfluxo Cadastro + triagem
  → step after intake → Urgência? (switch)
  → case:non_urgent → Subfluxo Agendamento → Fim
```

### 4.2 Subfluxo intake (`sf-intake-*`) — edges (provision)

```
start → note → crm-lookup → patient-status (switch)
  case:existing → crm-update → triage
  case:new | incomplete | default → collect-data → crm-upsert → triage → urgency → stop
```

### 4.3 Subfluxo appointment (`sf-appointment-*`) — alteração estrutural

**Antes:** `note → availability → status → ...`  
**Depois:** `note → specialty (agente) → availability → ...`

Nó novo: `sf-appointment-specialty` — "Confirmar especialidade".

---

## 5. Alterações implementadas no código

### 5.1 `BackEnd/src/services/flows/flow-patient-intake.ts` (novo / evoluído)

Módulo central de parsing e mensagens determinísticas.

**Funções principais:**

- `extractPatientProfileFromMessage()` — linha única e **multilinha** (nome, e-mail, telefone BR); ignora linhas de data/cidade.
- `getMissingRegistrationFields()` — retorna `patient_name`, `patient_email`, `patient_phone` faltantes.
- `hasMinimalPatientProfile()` — nome + e-mail válido + telefone (≥10 dígitos).
- `isAffirmativeConfirmation()` — sim, está certo, **está correto sim**, tudo certo, etc.; exclui negações.
- `extractSpecialtyFromMessage()` — texto ou número 1–10 → slug (`cardiologia`, `clinica_geral`, ...).
- `applyPatientHintsFromUserMessage()` — merge no contexto; `registration_confirmed`; limpa `missing_fields` se perfil completo; "mesmo número" → usa telefone do WhatsApp.
- `resolveIntakeResumeNodeId()` — com perfil completo, retoma em `sf-intake-crm-upsert` (não pula HubSpot).
- `resolveIntakeCollectDeterministicMessage()` — **sempre** retorna texto (nunca `null`); **não usa LLM**.
- `resolveIntakeTriageDeterministicMessage()` — menu fixo de especialidades ou confirma escolha.
- `applyIntakeStructuredFieldsToContext()` — atualiza `patient_lookup_status`, `data_quality`, `missing_fields`.

**Mensagens determinísticas (exemplos):**

- Cadastro inicial: pede nome, e-mail, telefone (sem endereço/DOB).
- Nome+telefone sem e-mail: pede só e-mail.
- Confirmação sem e-mail: *"Ótimo! Para concluir, envie somente seu e-mail..."*.
- Perfil completo: *"Perfeito, {nome}! Cadastro recebido."*.
- Triagem: menu 1–10 de especialidades.

### 5.2 `BackEnd/src/services/flows/flow-executor.ts`

- `applyPatientHintsFromUserMessage()` no início de cada `executeNode`.
- **`sf-intake-collect-data`:** sempre `resolveIntakeCollectDeterministicMessage()` — **não chama** `chatWithAgent`.
- **`sf-intake-triage`:** `resolveIntakeTriageDeterministicMessage()` quando perfil completo — **não chama** LLM.
- **`sf-intake-urgency`:** define `urgency_status=non_urgent`, mensagem vazia (não envia WhatsApp extra).
- **`sf-appointment-specialty`:** mesma lógica de menu de especialidade.
- Pausas ajustadas: collect pausa se perfil incompleto; não pausa se perfil completo; triagem pausa só se falta `specialty`.
- Pausa após `crm_contact` upsert incompleto → resume em `sf-intake-collect-data`.
- Log esperado: `[FlowExecutor] Resposta deterministica no cadastro (sem LLM)`.

### 5.3 `BackEnd/src/services/flows/flow.service.ts`

- `applyPatientHintsFromUserMessage()` antes da execução.
- `resolveIntakeResumeNodeId()` ao definir `__resume_from_node_id`.

### 5.4 `BackEnd/src/services/flows/flow-channel-runtime.ts`

- `applyPatientHintsFromUserMessage()` ao montar `resumedInitialData` (estado pausado + nova mensagem).

### 5.5 `BackEnd/src/services/flows/flow-provision-medical-clinic.service.ts`

- Templates `Clinica - Base Cadastro e CRM`, `Triagem`, `Urgencia` — regras explícitas (só nome/email/telefone; não repetir cadastro).
- Prompts dos agentes `crm`, `triage`, `urgency` enxutos.
- Nós `collectData`, `triage`, `urgency` com flag `useDeterministicIntake: true` (documentação no canvas).
- Nó `sf-appointment-specialty` + edge antes de `availability`.
- `ensureTemplate` / `ensureAgent` atualizam role e `personality_prompt` no Supabase ao rodar seed.

### 5.6 Testes

- `BackEnd/src/__test__/flow-patient-intake.test.ts` — parsing, confirmação, mensagens determinísticas, resume.

### 5.7 Trabalho anterior na mesma linha (contexto da conversa)

- CRM HubSpot: `resolveCRMIntegrationIdForFlow()`, save integração via backend (RLS).
- `flow-node-crm-contact.service.ts`, `hubspot.service.ts`.
- Frontend `CRMIntegrationSheet.tsx`.

---

## 6. O que NÃO depende mais do LLM (após deploy correto)

| Etapa | Nó | Mecanismo |
|-------|-----|-----------|
| Cadastro | `sf-intake-collect-data` | `resolveIntakeCollectDeterministicMessage()` |
| Especialidade | `sf-intake-triage`, `sf-appointment-specialty` | `resolveIntakeTriageDeterministicMessage()` |
| Urgência (agendar) | `sf-intake-urgency` | `urgency_status=non_urgent` fixo |

O agente `c6c0601a-dfa0-4af0-b241-0ead59ae6a86` (Cadastro e CRM) **não deve mais ser invocado** no collect se o código novo estiver ativo.

---

## 7. Fluxo esperado após deploy + seed

```
1. Oi
2. Menu → usuário: 1
3. Bot: pede nome, e-mail, telefone (uma mensagem, sem endereço/DOB)
4. Usuário: bloco com dados (+ e-mail em mensagem seguinte se necessário)
5. Bot: "Cadastro recebido" OU pede só e-mail se faltar
6. (Automático) upsert HubSpot
7. Bot: menu especialidades 1–10
8. Usuário: 2 ou "cardiologia"
9. Urgência: non_urgent (silencioso)
10. Subfluxo appointment: specialty → availability Calendly → horários ou lista de espera
```

---

## 8. Como validar no servidor

### 8.1 Deploy

```bash
cd ~/plataform-backend/BackEnd
git pull
npm run dev
```

### 8.2 Provisionar fluxo + agentes (PowerShell)

```powershell
cd ~/plataform-backend/BackEnd
$env:OWNER_EMAIL = "mateus.mantovani@onsmart.com.br"
$env:CRM_INTEGRATION_ID = "5cd5d72a-84b9-4ef0-a43d-b33136d7b3f9"
npm run seed:medical-clinic
```

Ou `POST /flows/provision-medical-clinic-demo` (admin autenticado).

### 8.3 Checklist de logs

- [ ] `Resposta deterministica no cadastro (sem LLM)` em `sf-intake-collect-data`
- [ ] `Resposta deterministica na triagem (sem LLM)` em `sf-intake-triage`
- [ ] `Urgencia padrao non_urgent` em `sf-intake-urgency`
- [ ] Após e-mail completo: `sf-intake-crm-upsert status=success` (ou equivalente, não só `incomplete`)
- [ ] `specialty` preenchido antes de `sf-appointment-availability`
- [ ] **Não** deve aparecer `messageLength: 3000+` no collect (indica LLM antigo)

### 8.4 Reinício de conversa

Enviar **Oi** para limpar estado pausado (`flow-channel-runtime` descarta estado em reinício).

---

## 9. Problemas conhecidos / pendências

1. **Calendly não configurado** — `appointmentIntegrationId` vazio no nó → availability pode falhar por outro motivo que não `specialty_required`.
2. **Fluxo no Supabase desatualizado** — sem `npm run seed:medical-clinic`, falta nó `sf-appointment-specialty` no canvas (lógica do executor ainda ajuda via código).
3. **Agente ainda com temperature 0.3 no seed** — irrelevante para nós determinísticos; relevante só se fallback LLM voltar a ser chamado por bug.
4. **Múltiplas mensagens na mesma volta** — perfil completo no collect pode executar upsert + triagem na mesma execução; usuário pode receber "Cadastro recebido" e em seguida menu de especialidade (última mensagem no histórico costuma ser a da triagem).

---

## 10. Arquivos tocados (lista para diff/review)

```
BackEnd/src/services/flows/flow-patient-intake.ts
BackEnd/src/services/flows/flow-executor.ts
BackEnd/src/services/flows/flow.service.ts
BackEnd/src/services/flows/flow-channel-runtime.ts
BackEnd/src/services/flows/flow-provision-medical-clinic.service.ts
BackEnd/src/__test__/flow-patient-intake.test.ts
```

Relacionados (sessões anteriores, não reescritos neste doc):

```
BackEnd/src/services/flows/flow-node-crm-contact.service.ts
BackEnd/src/services/flows/flow-node-appointment.service.ts
BackEnd/src/services/integrations/crm/hubspot.service.ts
FrontEnd/src/components/configuration/CRMIntegrationSheet.tsx
```

---

## 11. IDs úteis para debug

| Recurso | ID |
|---------|-----|
| Flow principal | `4a52c8c1-34e0-42c6-b548-2083da50aa7e` |
| Subfluxo intake | `2e90bea8-d582-4bbf-8933-98497fad285a` |
| Subfluxo appointment | `8fbc137c-0b9f-43d7-acac-abc49e27cf85` |
| Agente atendimento inicial | `d4bad649-487d-470c-8a85-274eee509fce` |
| Agente cadastro CRM | `c6c0601a-dfa0-4af0-b241-0ead59ae6a86` |
| Agente triagem | `4219e0b8-b338-4fad-9d74-4bd898df5fb8` |
| Integração WhatsApp (log) | `6e130da7-a339-4386-8050-710e227deb31` |

---

## 12. Resumo em uma frase

O fluxo falhava porque o **LLM no cadastro** pedia campos errados, **pausava em loop** sem e-mail após confirmação, **pulava o HubSpot** na retomada e ia para **agendamento sem especialidade**; a correção foi **mensagens e regras determinísticas no executor**, **parser de mensagens**, **retomada no upsert** e **nó de especialidade antes da agenda**, exigindo **deploy do BackEnd** e ideally **`npm run seed:medical-clinic`**.
