# 📊 Implementação de KPIs - Documentação

## ✅ O que foi implementado

### 1. **Tabela de Feedback** (`tb_feedback`)
- Criada tabela para armazenar CSAT, NPS e análise de sentimento
- Campos: `csat_score` (1-5), `nps_score` (0-10), `sentiment_score` (-1 a 1)
- Suporte a feedback textual e metadata adicional
- Arquivo: `BackEnd/database/CRIAR_TABELA_FEEDBACK.sql`

### 2. **Serviço de KPIs** (`kpis.service.ts`)
Implementa cálculo de todos os KPIs solicitados:

#### Operacional
- ✅ **Taxa de sucesso de tarefas**: Calcula % de workflows completados com sucesso
- ✅ **Tempo médio de resposta**: Calcula diferença entre `request_started_at` e `created_at`
- ✅ **Taxa de abandono**: Conversas sem resposta em 24 horas

#### Financeiro
- ✅ **Custo por interação**: Calcula usando `tb_agent_token_usage` e preços dos modelos
- ✅ **Custo total**: Soma de todos os custos no período

#### Conformidade e Risco
- ✅ **Número de violações**: Conta decisões bloqueadas (`status='pending_approval'`)
- ✅ **Alucinações sinalizadas**: Decisões com `confidence_score < 0.7` e sem `sources`

#### Feedback de Aprendizagem
- ✅ **Taxa de transferência humana**: % de conversas com `human_takeover`
- ✅ **Taxa de retrabalho rápido**: Decisões rejeitadas em menos de 1 hora

#### UX / Fatores Humanos
- ✅ **CSAT Score**: Média de feedbacks CSAT
- ✅ **NPS Score**: Média de feedbacks NPS
- ✅ **Sentimento médio**: Média de análise de sentimento
- ✅ **Frequência de roteamento incorreto**: % de feedbacks marcados como roteamento incorreto

### 3. **API Endpoints** (`/kpis`)
- `GET /kpis` - Retorna todos os KPIs calculados
  - Query params: `agentId`, `startDate`, `endDate`, `channel`
- `POST /kpis/feedback` - Salva feedback do usuário
  - Body: `csatScore`, `npsScore`, `sentimentScore`, `feedbackText`, etc.

### 4. **Rastreamento de Tempo de Resposta**
- Adicionado campo `metadata.request_started_at` nas mensagens
- Timestamp é marcado quando agente começa a processar
- Cálculo: `response_time = created_at - request_started_at`

### 5. **Análise de Sentimento** (`sentiment-analysis.service.ts`)
- Integração com OpenAI para análise de sentimento
- Fallback para análise heurística (palavras-chave) se OpenAI não disponível
- Retorna score de -1 (negativo) a 1 (positivo)

## 📁 Arquivos Criados/Modificados

### Novos Arquivos
- `BackEnd/database/CRIAR_TABELA_FEEDBACK.sql`
- `BackEnd/src/services/kpis/kpis.service.ts`
- `BackEnd/src/services/kpis/sentiment-analysis.service.ts`
- `BackEnd/src/api/controllers/kpis.controller.ts`
- `BackEnd/src/api/routes/kpis.routes.ts`

### Arquivos Modificados
- `BackEnd/src/index.ts` - Adicionada rota `/kpis`
- `BackEnd/src/services/integrations/whatsapp/whatsapp.service.ts` - Suporte a metadata
- `BackEnd/src/services/integrations/whatsapp/whatsapp.worker.ts` - Rastreamento de tempo
- `BackEnd/src/services/agents/chatwithAgent.ts` - Passa `request_started_at` no contexto

## 🚀 Como Usar

### 1. Criar Tabela de Feedback
Execute o SQL no Supabase:
```sql
-- Execute: BackEnd/database/CRIAR_TABELA_FEEDBACK.sql
```

### 2. Obter KPIs
```bash
GET http://192.168.15.31:3333/kpis?startDate=2024-01-01&endDate=2024-12-31&agentId=xxx
```

### 3. Salvar Feedback
```bash
POST http://192.168.15.31:3333/kpis/feedback
Content-Type: application/json

{
  "agentId": "xxx",
  "conversationId": "yyy",
  "channel": "whatsapp",
  "csatScore": 5,
  "npsScore": 9,
  "sentimentScore": 0.8,
  "feedbackText": "Excelente atendimento!"
}
```

## 📝 Próximos Passos (Pendentes)

1. **Componente de Feedback no Frontend**
   - Criar modal/componente para coletar CSAT/NPS após conversas
   - Integrar com endpoint `POST /kpis/feedback`

2. **Dashboard de KPIs**
   - Criar página no frontend para visualizar todos os KPIs
   - Gráficos e métricas em tempo real

3. **Análise Automática de Sentimento**
   - Integrar análise de sentimento automática nas mensagens recebidas
   - Salvar `sentiment_score` automaticamente em `tb_feedback`

## ⚙️ Configuração

### Preços dos Modelos (Ajustar em `kpis.service.ts`)
Os preços atuais são aproximados. Ajuste conforme seus custos reais:
```typescript
const pricing: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 }, // $ por 1M tokens
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // ...
}
```

### Análise de Sentimento
- Usa OpenAI se `OPENAI_API_KEY` estiver configurada
- Fallback automático para análise heurística se não disponível

## 🔍 Observações

- **Tempo de Resposta**: Requer que mensagens tenham `metadata.request_started_at` preenchido
- **Custo por Interação**: Baseado em preços aproximados, ajustar conforme necessário
- **Taxa de Abandono**: Define abandono como 24 horas sem resposta (ajustável)
- **Alucinações**: Define como `confidence_score < 0.7` E sem `sources` (ajustável)
