# Documentação da Plataforma SONIA

## 📋 Índice

1. [Estrutura de Pastas](#estrutura-de-pastas)
2. [Rotas da API](#rotas-da-api)
3. [URL Base da Aplicação](#url-base-da-aplicação)
4. [Guia para Novos Desenvolvedores](#guia-para-novos-desenvolvedores)

---

## 📁 Estrutura de Pastas

### Raiz do Projeto

```
Plataformadeatendimentosonia/
├── src/                    # Código-fonte principal
├── node_modules/           # Dependências do projeto
├── package.json            # Configurações e dependências
├── vite.config.ts          # Configuração do Vite
└── index.html              # Ponto de entrada HTML
```

### `src/` - Diretório Principal

#### `components/` - Componentes React Reutilizáveis

- **`agents/`**: Componentes relacionados aos agentes de IA
  - `AgentConfigSheet.tsx`: Configuração de agentes
  - `LiveMonitoring.tsx`: Monitoramento em tempo real

- **`auth/`**: Componentes de autenticação
  - `AuthPage.tsx`: Página de login/registro

- **`configuration/`**: Configurações e integrações
  - `Integrations.tsx`: Gerenciamento de integrações (Twilio, etc.)

- **`copilot/`**: Assistente virtual da plataforma
  - `SoniaCopilotProvider.tsx`: Provider do copilot

- **`layout/`**: Componentes de layout
  - `AppSidebar.tsx`: Barra lateral de navegação

- **`notifications/`**: Sistema de notificações
  - `NotificationCenter.tsx`: Centro de notificações
  - `NotificationItem.tsx`: Item individual de notificação

- **`ui/`**: Componentes de UI base (shadcn/ui)
  - 49 componentes reutilizáveis (botões, cards, dialogs, etc.)

#### `pages/` - Páginas da Aplicação

Cada arquivo representa uma rota/página da aplicação:

- `Cockpit.tsx`: Dashboard principal
- `Inbox.tsx`: Gerenciamento de conversas
- `AgentsHub.tsx`: Hub de agentes
- `AgentsList.tsx`: Lista de agentes
- `AgentConfig.tsx`: Configuração de agente
- `Playground.tsx`: Ambiente de testes
- `KnowledgeBase.tsx`: Base de conhecimento
- `Governance.tsx`: Governança e segurança
- `Insights.tsx`: Análises e insights
- `Configuration.tsx`: Configurações gerais
- `IoTDevices.tsx`: Gerenciamento de dispositivos IoT
- `Profile.tsx`: Perfil do usuário
- `Analytics.tsx`: Analytics e métricas
- `Dashboard.tsx`: Dashboard alternativo
- `LiveOperations.tsx`: Operações em tempo real
- `Settings.tsx`: Configurações
- `Team.tsx`: Gerenciamento de equipe
- `Workflows.tsx`: Fluxos de trabalho

#### `contexts/` - Contextos React

- `AuthContext.tsx`: Contexto de autenticação (gerencia sessão do usuário)
- `NavigationContext.tsx`: Contexto de navegação (gerencia rotas internas)

#### `supabase/functions/server/` - Backend (Edge Functions)

- **`index.tsx`**: Arquivo principal do servidor (define todas as rotas da API)
- **`core.ts`**: Funções core (autenticação, tenant, logging)
- **`repositories.ts`**: Repositórios de dados (Agents, Devices, Notifications, etc.)
- **`types.ts`**: Tipos TypeScript compartilhados
- **`ai.ts`**: Integração com LLMs (OpenAI, Anthropic, etc.)
- **`ai_tools.ts`**: Ferramentas disponíveis para os agentes
- **`chat.ts`**: Lógica de chat e mensagens
- **`billing.ts`**: Integração com Stripe (pagamentos)
- **`vector_store.ts`**: Armazenamento vetorial para busca semântica
- **`kv_store.tsx`**: Armazenamento chave-valor (cache/estado)

#### `utils/` - Utilitários

- `api.ts`: Cliente HTTP para chamadas à API
- `supabase/client.ts`: Cliente Supabase
- `supabase/info.tsx`: Configurações do Supabase (projectId, keys)

#### `services/` - Serviços

- `api.ts`: Serviço principal de API (AgentService com todos os métodos)

#### `lib/` - Bibliotecas

- `utils.ts`: Funções utilitárias gerais

#### `styles/` - Estilos

- `globals.css`: Estilos globais da aplicação
- `index.css`: Estilos adicionais

---

## 🔌 Rotas da API

### URL Base

A URL base da API é construída dinamicamente:

```
https://{projectId}.supabase.co/functions/v1/make-server-eeb342a4
```

Onde `{projectId}` é obtido do arquivo `src/utils/supabase/info.tsx`.

**Nota**: A API também está montada em `/make-server-eeb342a4` como fallback.

### Autenticação

Todas as rotas (exceto `/health` e `/signup`) requerem autenticação via header:
```
Authorization: Bearer {access_token}
```

### Lista Completa de Rotas

#### 🔍 Health Check

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Verifica se o servidor está online |

#### 🔐 Autenticação

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `POST` | `/signup` | Cria novo usuário | `{ email, password }` |

#### 🤖 Agentes (Agents)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/agents` | Lista todos os agentes | - |
| `POST` | `/agents` | Cria um novo agente | `CreateAgentSchema` |
| `PUT` | `/agents/:id` | Atualiza um agente | `Partial<Agent>` |
| `DELETE` | `/agents/:id` | Remove um agente | - |

**Schema de Criação de Agente:**
```typescript
{
  name: string (min 2),
  role: string (min 2),
  description?: string,
  systemPrompt?: string,
  channels?: string[],
  languages?: string[],
  avatar?: string,
  modelConfig?: {
    provider?: string,
    model?: string,
    temperature?: number,
    maxTokens?: number
  }
}
```

#### 📱 Dispositivos IoT (Devices)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/devices` | Lista todos os dispositivos | - |
| `POST` | `/devices` | Cria um novo dispositivo | `Partial<Device>` |
| `POST` | `/devices/:id/action` | Executa ação no dispositivo | `{ action, params? }` |

**Ações disponíveis:**
- `turn_on`: Liga dispositivo
- `turn_off`: Desliga dispositivo
- `lock`: Trava dispositivo
- `unlock`: Destrava dispositivo
- `snapshot`: Captura imagem (gera job assíncrono)
- `simulate_failure`: Simula falha (para testes)

#### ⚙️ Jobs (Tarefas Assíncronas)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/jobs/:id` | Obtém status de um job | - |
| `POST` | `/jobs/:id/process` | Processa um job | - |

**Tipos de Job:**
- `sentinel_audit`: Análise de imagem para compliance

#### 📬 Notificações

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/notifications` | Lista todas as notificações | - |
| `POST` | `/notifications/mark-read` | Marca notificação como lida | `{ id }` |
| `POST` | `/notifications/test` | Cria notificação de teste | `{ type? }` |

#### 📊 Dashboard

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/dashboard` | Obtém estatísticas do dashboard | - |

**Resposta:**
```typescript
{
  stats: {
    totalInteractions: number,
    activeLeads: number,
    avgResponseTime: number,
    meetingsBooked: number,
    activeAgents: number,
    lastUpdated: string
  },
  activityFeed: ActivityLog[]
}
```

#### 📥 Inbox (Conversas)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/inbox/conversations` | Lista todas as conversas | - |
| `GET` | `/inbox/conversations/:id/messages` | Obtém mensagens de uma conversa | - |
| `POST` | `/inbox/conversations/:id/status` | Atualiza status da conversa | `{ status }` |
| `POST` | `/inbox/conversations/:id/reply` | Envia resposta manual | `{ content }` |

**Status possíveis:**
- `active`: Conversa ativa com IA
- `human_takeover`: Tomada por humano
- `closed`: Fechada

#### 📚 Base de Conhecimento (Knowledge Base)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/knowledge` | Lista arquivos (com paginação) | Query: `?limit=50&offset=0` |
| `POST` | `/knowledge/upload-url` | Gera URL assinada para upload | `{ fileName, fileType }` |
| `POST` | `/knowledge` | Confirma upload e inicia indexação | `KnowledgeConfirmSchema` |
| `DELETE` | `/knowledge/:id` | Remove arquivo | - |

**Fluxo de Upload:**
1. Cliente chama `/knowledge/upload-url` para obter URL assinada
2. Cliente faz upload direto para Supabase Storage usando a URL
3. Cliente chama `/knowledge` para confirmar e iniciar indexação vetorial

#### 💡 Insights

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/insights` | Obtém insights e análises | - |

#### 📤 Mensagens Outbound (Campanhas)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `POST` | `/outbound/message` | Envia mensagem proativa | `{ to, channel, content, agentId? }` |

**Canais disponíveis:**
- `whatsapp`
- `sms`
- `email`

#### 💬 Chat (Mensagens Inbound)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `POST` | `/chat` | Processa mensagem do usuário | `ChatSchema` |

**Schema:**
```typescript
{
  agentId: string,
  messages: Array<{
    role: 'user' | 'assistant' | 'system',
    content: string
  }>,
  context?: {
    sessionId?: string,
    channel?: 'webchat' | 'whatsapp' | 'twilio'
  }
}
```

**Agente Especial:**
- `agentId: 'system-copilot'`: Usa o assistente virtual da plataforma

#### 💳 Billing (Stripe)

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/billing/subscription` | Obtém assinatura atual | - |
| `POST` | `/billing/checkout` | Cria sessão de checkout | `{ priceId }` |
| `POST` | `/billing/portal` | Cria sessão do portal do cliente | - |
| `POST` | `/billing/webhook` | Webhook do Stripe | `Stripe Event` |

#### 🔗 Integrações

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/integrations/:provider` | Obtém configuração de integração | - |
| `POST` | `/integrations/:provider` | Salva configuração de integração | `Config Object` |

**Providers suportados:**
- `twilio`
- Outros podem ser adicionados

#### ⚙️ Configurações Gerais

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/settings/general` | Obtém configurações gerais | - |
| `POST` | `/settings/general` | Atualiza configurações gerais | `Settings Object` |

#### 👥 Gerenciamento de Equipe

| Método | Rota | Descrição | Body |
|--------|------|-----------|------|
| `GET` | `/team` | Lista membros da equipe | - |
| `POST` | `/team/invite` | Convida novo membro | `{ email, role }` |
| `DELETE` | `/team/:email` | Remove membro da equipe | - |

---

## 🌐 URL Base da Aplicação

### Frontend (Desenvolvimento)

Durante o desenvolvimento, o frontend roda em:
```
http://localhost:3000
```

Configurado em `vite.config.ts`:
```typescript
server: {
  port: 3000,
  open: true
}
```

### Backend (API)

A API é hospedada como **Supabase Edge Function**:

**URL Base:**
```
https://{projectId}.supabase.co/functions/v1/make-server-eeb342a4
```

**URL Alternativa (Fallback):**
```
https://{projectId}.supabase.co/make-server-eeb342a4
```

O `projectId` é obtido do arquivo `src/utils/supabase/info.tsx` e representa o ID do projeto Supabase.

### Supabase Client

O cliente Supabase usa a URL:
```
https://{projectId}.supabase.co
```

### Exemplo de Uso

```typescript
// Exemplo de chamada à API
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-eeb342a4`;

const response = await fetch(`${BASE_URL}/agents`, {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 🚀 Guia para Novos Desenvolvedores

### Pré-requisitos

1. **Node.js** (versão 18 ou superior)
2. **npm** ou **yarn**
3. Conta no **Supabase** (para backend)
4. Editor de código (VS Code recomendado)

### Configuração Inicial

1. **Clone o repositório**
   ```bash
   git clone <repository-url>
   cd Plataformadeatendimentosonia
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o Supabase**
   - Crie um arquivo `src/utils/supabase/info.tsx` com:
   ```typescript
   export const projectId = "seu-project-id";
   export const publicAnonKey = "sua-chave-publica";
   ```

4. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

5. **Acesse a aplicação**
   - Abra `http://localhost:3000` no navegador

### Estrutura de Desenvolvimento

#### Frontend (React + TypeScript)

- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (baseado em Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: React Context API

#### Backend (Deno + Hono)

- **Runtime**: Deno (Supabase Edge Functions)
- **Framework**: Hono (similar ao Express)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth

### Fluxo de Trabalho

1. **Criar uma nova página:**
   - Adicione arquivo em `src/pages/`
   - Importe e adicione rota em `src/App.tsx`
   - Adicione item no menu em `src/components/layout/AppSidebar.tsx`

2. **Criar uma nova rota da API:**
   - Adicione rota em `src/supabase/functions/server/index.tsx`
   - Implemente lógica de negócio
   - Adicione método no `AgentService` em `src/services/api.ts`

3. **Usar componentes UI:**
   - Importe de `src/components/ui/`
   - Exemplo: `import { Button } from "@/components/ui/button"`

### Padrões de Código

#### Autenticação

Sempre verifique autenticação antes de acessar rotas protegidas:

```typescript
const { session, loading } = useAuth();

if (loading) return <Loader />;
if (!session) return <AuthPage />;
```

#### Chamadas à API

Use o `AgentService` para chamadas à API:

```typescript
import { AgentService } from "@/services/api";

// Listar agentes
const agents = await AgentService.listAgents();

// Criar agente
const newAgent = await AgentService.createAgent({
  name: "Meu Agente",
  role: "Atendente"
});
```

#### Tratamento de Erros

O `AgentService` já trata erros de rede automaticamente. Para erros customizados:

```typescript
try {
  await AgentService.createAgent(data);
} catch (error) {
  toast.error(error.message);
}
```

### Conceitos Importantes

#### Multi-tenancy

A aplicação é multi-tenant. Cada requisição identifica o tenant através do token JWT do Supabase. O `getTenantId()` extrai o tenant do token.

#### Sessões de Chat

As sessões de chat são armazenadas em KV Store com a chave:
```
tenant:{tenantId}:chat_session:{sessionId}
```

#### Indexação Vetorial

Arquivos na Knowledge Base são automaticamente indexados em um vector store para busca semântica. O processo é assíncrono.

#### Jobs Assíncronos

Algumas operações (como análise de imagens) são processadas de forma assíncrona:
1. Cliente cria job via API
2. Cliente chama `/jobs/:id/process` para processar
3. Cliente verifica status via `GET /jobs/:id`

### Recursos Úteis

- **Documentação do Supabase**: https://supabase.com/docs
- **Documentação do Hono**: https://hono.dev
- **Documentação do React**: https://react.dev
- **shadcn/ui**: https://ui.shadcn.com

### Dúvidas Comuns

**Q: Como adicionar um novo campo a um agente?**
A: Atualize o schema `CreateAgentSchema` em `index.tsx` e a interface `Agent` em `types.ts`.

**Q: Como criar uma nova integração?**
A: Adicione rotas em `/integrations/:provider` e implemente a lógica em um novo arquivo de serviço.

**Q: Como debugar o backend?**
A: Use `console.log()` - os logs aparecem no dashboard do Supabase em Edge Functions > Logs.

**Q: Onde estão os dados?**
A: Dados são armazenados no Supabase (PostgreSQL) e em KV Store (para cache/sessões).

---

## 📝 Notas Finais

- Esta documentação é um guia vivo e deve ser atualizada conforme o projeto evolui.
- Para dúvidas específicas, consulte o código-fonte ou entre em contato com a equipe.
- Sempre teste suas mudanças localmente antes de fazer deploy.

---

**Última atualização**: Baseado na estrutura atual do projeto
**Versão**: 0.1.0
