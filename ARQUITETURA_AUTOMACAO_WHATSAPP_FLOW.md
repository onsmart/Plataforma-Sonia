# Arquitetura de Automacao: WhatsApp + Flow

## Estado Atual Encontrado

- O webhook oficial da Meta entra por `GET/POST /whatsapp/webhook`.
- Antes desta alteracao, o webhook resolvia a integracao e disparava apenas `chatWithAgent(...)`.
- O motor de flows ja existia e era executado principalmente pelo laboratorio em `POST /flows/execute`.
- O node `agent` ja suportava `agentId` e `templateId`.
- O modo `template` ja executava em memoria, sem criar agentes ocultos.

## Problema Principal

- O laboratorio e o WhatsApp usavam caminhos diferentes.
- O flow funcionava bem em ambiente de teste, mas nao era uma camada operacional reaproveitada no WhatsApp real.
- A integracao WhatsApp conhecia apenas `linked_agent_id`.
- Como a Meta usa um unico webhook, o roteamento entre `agente` e `flow` precisava acontecer dentro do backend.

## Solucao Implementada

### 1. Motor compartilhado de execucao por canal

Foi criado um wrapper de execucao em:

- `BackEnd/src/services/flows/flow-channel-runtime.ts`

Esse runtime:

- reutiliza `FlowService.executeFlow(...)`
- extrai a resposta final do flow a partir do `executionHistory`
- entrega a resposta no canal quando necessario
- permite que laboratorio e WhatsApp passem pelo mesmo motor base

### 2. Roteador central de automacao

Foi criado:

- `BackEnd/src/services/automation/automation-router.ts`

Esse roteador decide, por integracao WhatsApp:

- `agent`
- `flow`
- `hybrid`

Com isso, o webhook oficial da Meta nao precisa mais conhecer detalhes de orquestracao. Ele apenas:

- resolve a integracao
- salva inbound
- delega ao roteador

### 3. Evolucao segura da integracao WhatsApp

O controller agora suporta:

- `automation_mode`
- `linked_flow_id`

Sem quebrar registros antigos. Se as colunas ainda nao existirem, o backend faz fallback para o comportamento legado.

### 4. Paridade entre laboratorio e producao

`POST /flows/execute` agora tambem passa pelo runtime compartilhado de flow por canal.

Isso reduz diferencas entre:

- laboratorio
- WhatsApp oficial

O laboratorio continua sem entrega externa, mas usa a mesma camada central de execucao e extracao de resposta.

### 5. Supressao de envio direto durante flow no WhatsApp

Quando um flow eh disparado pelo WhatsApp:

- `disable_channel_delivery` entra no contexto
- nodes `agent` nao enviam mensagem direto para o canal
- nodes `template` tambem nao devem disparar mensagens externas
- o runtime do flow extrai uma resposta final e faz a entrega uma unica vez

Isso evita:

- envio duplicado
- mistura de responsabilidade entre node e adaptador de canal

## Mudancas de Modelo de Dados

Foi adicionada a migracao:

- `BackEnd/database/ALTER_TB_INTEGRATIONS_ADD_FLOW_AUTOMATION_FIELDS.sql`

Ela inclui:

- `automation_mode text default 'agent'`
- `linked_flow_id uuid null`
- indice para `automation_mode`
- indice para `linked_flow_id`
- FK opcional para `tb_flows(id)`

## Compatibilidade Preservada

- Integracoes antigas continuam funcionando com `linked_agent_id`.
- Flows antigos com `agentId` continuam funcionando.
- Nodes com `templateId` continuam funcionando.
- Se o banco ainda nao tiver as novas colunas, o backend cai para o comportamento legado sem quebrar a operacao atual.

## Frontend

A tela de integracoes agora permite escolher:

- `Agente existente`
- `Flow`

Quando o modo eh `flow`, o numero oficial pode apontar diretamente para um flow.

## Testes Adicionados

- `BackEnd/src/__test__/flow-channel-runtime.test.ts`
- `BackEnd/src/__test__/automation-router.test.ts`
- ampliacao em `BackEnd/src/__test__/flow-executor.test.ts`

Cobertura adicionada:

- caminho legado por agente
- caminho novo por flow
- fallback seguro sem flow/agente
- modo hybrid com fallback para agente
- node agent dentro do flow
- node template dentro do flow
- extracao e entrega da resposta final do flow

## Riscos Remanescentes

- O modo `flow` hoje depende de o flow produzir uma resposta final extraivel.
- Ainda nao existe um node universal explicito de "enviar WhatsApp" dentro da engine.
- Flows muito complexos podem exigir uma estrategia mais formal para definir qual node produz a resposta final.

## Proximos Passos Recomendados

1. Adicionar um node nativo de resposta/saida de canal.
2. Evoluir a UI para suportar `hybrid` de forma controlada, se fizer sentido.
3. Adicionar observabilidade por `automation_mode` e `flowExecutionId`.
4. Criar testes end-to-end com webhook oficial da Meta em ambiente controlado.
