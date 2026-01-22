# Flow Execution Service

Serviço para executar flows de agentes sequencialmente, com transferência de dados entre nodes.

## Estrutura

```
flows/
├── flow.types.ts      # Tipos TypeScript
├── flow-executor.ts   # Classe principal de execução
├── flow.service.ts    # Serviço para gerenciar flows
└── index.ts           # Exports
```

## Como Funciona

1. **Node Inicial**: O flow começa pelo `startNodeId`
2. **Execução Sequencial**: Cada node executa seu agente
3. **Transferência de Dados**: Dados são passados entre nodes via JSON
4. **Grafo Direcionado**: Nodes são executados seguindo as edges (conexões)

## Exemplo de Uso

```typescript
import { FlowService } from './services/flows'

// Dados iniciais (ex: nome e email do usuário)
const initialData = {
  nome: "João Silva",
  email: "joao@example.com"
}

// Executa o flow
const result = await FlowService.executeFlow(
  'flow-id-123',
  'user@example.com',
  initialData
)

// Resultado contém:
// - executionHistory: histórico de execução de cada node
// - data: dados finais após execução de todos os nodes
```

## Fluxo de Execução

1. **Node 1** (inicial):
   - Recebe: `{ nome: "João", email: "joao@example.com" }`
   - Executa agente e retorna: `{ dadosProcessados: "..." }`

2. **Node 2** (conectado ao Node 1):
   - Recebe: dados do Node 1 + dados iniciais
   - Executa agente e retorna: `{ emailEnviado: true }`

3. **Node 3** (conectado ao Node 1):
   - Recebe: dados do Node 1 + dados iniciais
   - Executa agente independentemente

## Formato do JSON

O flow espera um JSON no formato:

```json
{
  "startNodeId": "node-1",
  "nodes": [
    {
      "id": "node-1",
      "data": {
        "agentId": "uuid-do-agente",
        "label": "Nome do Agente",
        "isStartNode": true
      }
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

## Transferência de Dados

- Cada node recebe os dados dos nodes predecessores (que apontam para ele)
- Dados são mesclados no contexto global
- Cada node pode acessar todos os dados anteriores via `context.data`
