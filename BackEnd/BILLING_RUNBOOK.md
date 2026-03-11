# 💳 Billing System - Runbook e Documentação

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Troubleshooting](#troubleshooting)
4. [Procedimentos de Emergência](#procedimentos-de-emergência)
5. [Monitoramento](#monitoramento)

---

## 🎯 Visão Geral

O sistema de billing da Sônia utiliza **Stripe** para processamento de pagamentos e controle de assinaturas. O sistema implementa:

- **3 Planos**: Starter (gratuito), Pro (pago), Enterprise (contato)
- **Limites por Plano**: Agentes, mensagens, features (RAG, SSO, Governance)
- **Tracking de Uso**: Métricas mensais de agentes e mensagens
- **Bloqueios Automáticos**: Sistema impede uso além dos limites

---

## 🏗️ Arquitetura

### Componentes Principais

#### 1. **Tabelas do Banco**
- `tb_subscriptions`: Armazena assinaturas Stripe
  - Campos: `plan`, `status`, `stripe_subscription_id`, `companies_id`
  - Status válidos: `'active'`, `'trialing'`
  - Status inválidos: `'canceled'`, `'past_due'`, `'incomplete'`

- `tb_usage_metrics`: Cache de uso mensal
  - Campos: `companies_id`, `month_start`, `message_count`, `agent_count`
  - Uma métrica por empresa por mês (UNIQUE constraint)

#### 2. **Serviços**
- `plan-helper.ts`: Lógica de verificação de planos e limites
  - `getPlanInfo()`: Busca plano atual da empresa
  - `canCreateAgent()`: Verifica se pode criar agente
  - `canSendMessage()`: Verifica se pode enviar mensagem
  - `canUseRAG()`: Verifica se pode usar RAG
  - `canUseGovernance()`: Verifica se pode usar Governance
  - `canUseSSO()`: Verifica se pode usar SSO

- `usage-tracker.service.ts`: Tracking de uso
  - `getCurrentAgentCount()`: Conta agentes ativos
  - `getCurrentMessageCount()`: Conta mensagens do mês
  - `incrementMessageCount()`: Incrementa contador após envio

#### 3. **Endpoints API**
- `POST /billing/checkout`: Cria sessão de checkout Stripe
- `GET /billing/subscription`: Retorna plano atual
- `POST /billing/portal`: Cria sessão do portal Stripe
- `POST /billing/webhook`: Webhook do Stripe (processa eventos)
- `GET /billing/export`: Exporta dados em CSV

---

## 🔧 Troubleshooting

### Problema: Usuário não consegue criar agente

**Sintomas:**
- Erro: "Você atingiu o limite de X agente(s)"
- Status 403 na API

**Diagnóstico:**
```bash
# 1. Verificar plano atual
GET /billing/subscription?email=usuario@empresa.com

# 2. Verificar contagem de agentes
SELECT COUNT(*) FROM tb_agents 
WHERE companies_id = 'xxx' AND status_id = 1;

# 3. Verificar subscription
SELECT * FROM tb_subscriptions 
WHERE companies_id = 'xxx' 
ORDER BY created_at DESC LIMIT 1;
```

**Soluções:**
1. **Plano Starter (limite: 1 agente)**
   - Upgrade para Pro (5 agentes) ou Enterprise (ilimitado)
   - Ou desativar agente existente antes de criar novo

2. **Subscription cancelada**
   - Verificar webhook do Stripe (`customer.subscription.deleted`)
   - Reativar subscription via Stripe Dashboard
   - Ou criar nova subscription

3. **Status incorreto**
   - Verificar se `status = 'active'` ou `'trialing'`
   - Atualizar manualmente se necessário:
   ```sql
   UPDATE tb_subscriptions 
   SET status = 'active' 
   WHERE companies_id = 'xxx' AND status = 'canceled';
   ```

---

### Problema: Mensagens não estão sendo enviadas

**Sintomas:**
- Erro: "Você atingiu o limite de X mensagens/mês"
- Mensagens bloqueadas no backend

**Diagnóstico:**
```bash
# 1. Verificar uso atual
SELECT * FROM tb_usage_metrics 
WHERE companies_id = 'xxx' 
AND month_start >= DATE_TRUNC('month', NOW())
ORDER BY month_start DESC;

# 2. Contar mensagens reais
SELECT COUNT(*) FROM tb_whatsapp_messages wm
JOIN tb_integrations i ON i.id = wm.integrations_id
WHERE i.companies_id = 'xxx'
AND wm.direction = 'outbound'
AND wm.created_at >= DATE_TRUNC('month', NOW());
```

**Soluções:**
1. **Limite atingido (Starter: 50/mês)**
   - Upgrade para Pro (ilimitado)
   - Ou aguardar próximo mês (reset automático)

2. **Métricas desatualizadas**
   - Verificar se `incrementMessageCount()` está sendo chamado
   - Verificar logs: `[incrementMessageCount]`
   - Sincronizar manualmente se necessário:
   ```sql
   -- Recalcular métricas do mês atual
   INSERT INTO tb_usage_metrics (companies_id, month_start, message_count, agent_count)
   SELECT 
     i.companies_id,
     DATE_TRUNC('month', NOW())::date,
     COUNT(*) FILTER (WHERE wm.direction = 'outbound'),
     (SELECT COUNT(*) FROM tb_agents WHERE companies_id = i.companies_id)
   FROM tb_integrations i
   LEFT JOIN tb_whatsapp_messages wm ON wm.integrations_id = i.id
   WHERE i.companies_id = 'xxx'
   AND wm.created_at >= DATE_TRUNC('month', NOW())
   GROUP BY i.companies_id
   ON CONFLICT (companies_id, month_start) 
   DO UPDATE SET message_count = EXCLUDED.message_count;
   ```

---

### Problema: Webhook do Stripe não está funcionando

**Sintomas:**
- Subscription criada no Stripe mas não aparece no banco
- Status não atualiza após cancelamento

**Diagnóstico:**
```bash
# 1. Verificar logs do backend
grep "Billing Webhook" logs/backend.log

# 2. Verificar webhook secret
echo $STRIPE_WEBHOOK_SECRET

# 3. Testar webhook manualmente
stripe listen --forward-to http://192.168.15.31:3333/billing/webhook
stripe trigger checkout.session.completed
```

**Soluções:**
1. **Webhook secret incorreto**
   - Obter novo secret: `stripe listen --print-secret`
   - Atualizar `.env`: `STRIPE_WEBHOOK_SECRET=whsec_...`
   - Reiniciar backend

2. **Rota não registrada corretamente**
   - Verificar `BackEnd/src/index.ts`:
   ```typescript
   // IMPORTANTE: Antes de express.json()
   app.post('/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
   app.use(express.json())
   ```

3. **Evento não processado**
   - Verificar `handleStripeWebhook()` em `billing.routes.ts`
   - Adicionar log para novo tipo de evento se necessário

---

### Problema: Feature bloqueada incorretamente

**Sintomas:**
- RAG/Governance/SSO bloqueado mesmo com plano correto
- Erro: "Funcionalidade disponível apenas no plano X"

**Diagnóstico:**
```bash
# 1. Verificar plano
GET /billing/subscription?email=usuario@empresa.com

# 2. Verificar status da subscription
SELECT plan, status FROM tb_subscriptions 
WHERE companies_id = 'xxx' 
ORDER BY created_at DESC LIMIT 1;
```

**Soluções:**
1. **Status incorreto**
   - Atualizar status manualmente:
   ```sql
   UPDATE tb_subscriptions 
   SET status = 'active' 
   WHERE companies_id = 'xxx';
   ```

2. **Plano incorreto**
   - Verificar webhook `checkout.session.completed`
   - Atualizar manualmente se necessário:
   ```sql
   UPDATE tb_subscriptions 
   SET plan = 'pro' 
   WHERE companies_id = 'xxx';
   ```

---

## 🚨 Procedimentos de Emergência

### 1. Desbloquear Usuário Imediatamente

**Cenário:** Cliente pagou mas está bloqueado

```sql
-- 1. Verificar subscription
SELECT * FROM tb_subscriptions WHERE companies_id = 'xxx';

-- 2. Atualizar status para active
UPDATE tb_subscriptions 
SET status = 'active', plan = 'pro'
WHERE companies_id = 'xxx';

-- 3. Verificar se funcionou
SELECT * FROM tb_subscriptions WHERE companies_id = 'xxx';
```

### 2. Resetar Limites Temporariamente

**Cenário:** Cliente precisa usar além do limite (ex: evento especial)

```sql
-- Aumentar limite de mensagens temporariamente
-- (Não recomendado, mas possível em emergências)
-- Melhor: criar subscription temporária ou aumentar limite no código
```

**Alternativa (Recomendada):**
- Criar subscription Enterprise temporária via Stripe Dashboard
- Ou aumentar limite manualmente no código (apenas para casos excepcionais)

### 3. Recriar Subscription Perdida

**Cenário:** Subscription deletada acidentalmente

```sql
-- 1. Buscar dados da subscription no Stripe Dashboard
-- 2. Recriar manualmente
INSERT INTO tb_subscriptions (
  companies_id,
  plan,
  status,
  stripe_subscription_id,
  stripe_customer_id,
  created_at,
  updated_at
) VALUES (
  'xxx',
  'pro',
  'active',
  'sub_xxxxx', -- Do Stripe Dashboard
  'cus_xxxxx', -- Do Stripe Dashboard
  NOW(),
  NOW()
);
```

---

## 📊 Monitoramento

### Métricas Importantes

1. **Taxa de Bloqueios**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE status = 'active') as active,
     COUNT(*) FILTER (WHERE status = 'canceled') as canceled,
     COUNT(*) FILTER (WHERE status = 'past_due') as past_due
   FROM tb_subscriptions;
   ```

2. **Uso Médio por Plano**
   ```sql
   SELECT 
     s.plan,
     AVG(um.message_count) as avg_messages,
     AVG(um.agent_count) as avg_agents
   FROM tb_subscriptions s
   JOIN tb_usage_metrics um ON um.companies_id = s.companies_id
   WHERE s.status = 'active'
   GROUP BY s.plan;
   ```

3. **Limites Atingidos**
   ```sql
   -- Starter com 50+ mensagens
   SELECT um.*, s.plan
   FROM tb_usage_metrics um
   JOIN tb_subscriptions s ON s.companies_id = um.companies_id
   WHERE s.plan = 'starter'
   AND um.message_count >= 50
   AND um.month_start >= DATE_TRUNC('month', NOW());
   ```

### Alertas Recomendados

1. **Subscription cancelada** → Notificar time de vendas
2. **Limite atingido** → Notificar usuário (já implementado)
3. **Webhook falhando** → Alertar DevOps
4. **Métricas desatualizadas** → Verificar `incrementMessageCount()`

---

## 🔗 Links Úteis

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Webhooks**: https://dashboard.stripe.com/webhooks
- **Documentação Stripe**: https://stripe.com/docs/api
- **Logs do Backend**: `BackEnd/logs/` (se configurado)

---

## 📝 Notas de Manutenção

### Atualizar Preços
Editar `BackEnd/src/api/routes/billing.routes.ts`:
```typescript
const PRICE_IDS = {
  price_pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  price_pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  // ...
}
```

### Adicionar Novo Plano
1. Adicionar em `plan-helper.ts` → `getPlanLimits()`
2. Adicionar Price ID em `billing.routes.ts` → `PRICE_IDS`
3. Atualizar UI em `FrontEnd/src/pages/Settings.tsx`

---

**Última atualização:** 2026-03-10  
**Versão:** 1.0.0
