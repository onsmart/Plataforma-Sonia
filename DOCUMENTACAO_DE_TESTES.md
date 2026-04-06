# 📋 Documentação de Testes - Plataforma Sônia

**Versão:** 1.0  
**Data:** 2025-01-XX  
**Status:** Pré-Lançamento

---

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Testes Funcionais](#testes-funcionais)
3. [Testes de Segurança](#testes-de-segurança)
4. [Testes de Integração](#testes-de-integração)
5. [Testes de Performance](#testes-de-performance)
6. [Testes de Multi-Tenant](#testes-de-multi-tenant)
7. [Testes de Billing e Limites](#testes-de-billing-e-limites)
8. [Limitações Conhecidas](#limitações-conhecidas)
9. [Checklist de Pré-Lançamento](#checklist-de-pré-lançamento)
10. [Ambiente de Testes](#ambiente-de-testes)

---

## 🎯 Visão Geral

Este documento descreve todos os testes que devem ser realizados na Plataforma Sônia antes do lançamento oficial. Os testes são organizados por categoria e incluem critérios de aceite claros.

### Objetivo

Garantir que a plataforma esteja:
- ✅ Funcionalmente completa
- ✅ Segura contra vulnerabilidades conhecidas
- ✅ Estável para operação contínua
- ✅ Preparada para múltiplos tenants
- ✅ Pronta para produção

---

## 🧪 Testes Funcionais

### 1. Autenticação e Autorização

#### 1.1 Login/Logout
- [ ] **Login com email e senha válidos**
  - Verificar se o usuário consegue fazer login
  - Verificar se o token JWT é gerado corretamente
  - Verificar se o token expira no tempo correto
  
- [ ] **Login com credenciais inválidas**
  - Email inexistente
  - Senha incorreta
  - Email formatado incorretamente
  
- [ ] **Logout**
  - Verificar se o token é invalidado
  - Verificar se o usuário é redirecionado corretamente

#### 1.2 Permissões e Roles
- [ ] **Acesso de Owner**
  - Verificar se owner tem acesso a todas as funcionalidades
  - Verificar se pode criar/editar/deletar agentes
  - Verificar se pode acessar billing
  
- [ ] **Acesso de Admin**
  - Verificar se admin tem acesso às funcionalidades administrativas
  - Verificar se pode gerenciar agentes
  - Verificar se NÃO pode acessar configurações críticas de billing
  
- [ ] **Acesso de Usuário Comum**
  - Verificar se usuário comum tem acesso limitado
  - Verificar se NÃO pode criar/deletar agentes
  - Verificar se NÃO pode acessar billing

### 2. Gestão de Agentes

#### 2.1 Criação de Agentes
- [ ] **Criar agente básico**
  - Nome, descrição, role
  - System prompt
  - Modelo LLM (OpenAI, etc.)
  - Verificar se o agente é salvo no banco
  
- [ ] **Criar agente com RAG**
  - Vincular arquivos ao agente
  - Verificar se os arquivos são processados
  - Verificar se os embeddings são gerados
  - Verificar se o RAG funciona nas conversas
  
- [ ] **Limites de criação**
  - Starter: máximo 1 agente
  - Pro: máximo 5 agentes
  - Enterprise: ilimitado
  - Verificar se o bloqueio funciona corretamente

#### 2.2 Edição de Agentes
- [ ] **Editar informações básicas**
  - Nome, descrição, role
  - System prompt
  - Verificar se as alterações são salvas
  
- [ ] **Editar configurações de LLM**
  - Mudar modelo
  - Mudar API key
  - Verificar se as mudanças são aplicadas nas conversas

#### 2.3 Exclusão de Agentes
- [ ] **Deletar agente**
  - Verificar se o agente é removido
  - Verificar se as conversas relacionadas são mantidas (soft delete)
  - Verificar se os arquivos RAG são mantidos

### 3. Workflows

#### 3.1 Criação de Workflows
- [ ] **Criar workflow simples**
  - Adicionar nodes
  - Conectar nodes com edges
  - Definir node inicial
  - Verificar se o workflow é salvo
  
- [ ] **Criar workflow complexo**
  - Múltiplos nodes
  - Múltiplas branches
  - Loops condicionais
  - Verificar se a estrutura é válida

#### 3.2 Execução de Workflows
- [ ] **Executar workflow simples**
  - Verificar se os nodes são executados em ordem
  - Verificar se os dados são transferidos entre nodes
  - Verificar se os logs são gerados
  
- [ ] **Executar workflow com erros**
  - Node que falha
  - Verificar se o erro é tratado
  - Verificar se os logs de erro são salvos
  
- [ ] **Executar workflow com aprovação**
  - Node que requer aprovação
  - Verificar se a decisão é salva
  - Verificar se o workflow pausa corretamente
  - Verificar se continua após aprovação

### 4. Sistema de Aprovação/Handoff

#### 4.1 Decisões Bloqueadas
- [ ] **Agente bloqueia decisão**
  - Verificar se a decisão é salva em `tb_agent_decisions`
  - Verificar se o status é `pending_approval`
  - Verificar se aparece no Inbox
  
- [ ] **Aprovar decisão**
  - Aprovar sem edição
  - Verificar se a mensagem é enviada
  - Verificar se o status muda para `approved`
  - Verificar se o log de auditoria é salvo
  
- [ ] **Aprovar decisão editada**
  - Editar resposta antes de aprovar
  - Verificar se a resposta editada é enviada
  - Verificar se o log registra a edição
  
- [ ] **Rejeitar decisão**
  - Rejeitar decisão
  - Verificar se o status muda para `rejected`
  - Verificar se a mensagem NÃO é enviada
  - Verificar se o log é salvo

### 5. RAG (Retrieval Augmented Generation)

#### 5.1 Upload de Arquivos
- [ ] **Upload de arquivo PDF**
  - Verificar se o arquivo é salvo
  - Verificar se é processado
  - Verificar se os chunks são gerados
  - Verificar se os embeddings são criados
  
- [ ] **Upload de arquivo TXT**
  - Mesmos testes acima
  
- [ ] **Upload de arquivo DOCX**
  - Mesmos testes acima
  
- [ ] **Upload de arquivo grande (>10MB)**
  - Verificar se há limite de tamanho
  - Verificar se o erro é tratado

#### 5.2 Busca RAG
- [ ] **Busca com arquivo vinculado**
  - Fazer pergunta relacionada ao conteúdo
  - Verificar se o contexto é encontrado
  - Verificar se as fontes são retornadas
  - Verificar se a resposta usa o contexto
  
- [ ] **Busca sem arquivo vinculado**
  - Verificar se o agente funciona normalmente
  - Verificar se não há erro
  
- [ ] **Busca com múltiplos arquivos**
  - Vincular múltiplos arquivos
  - Verificar se todos são consultados
  - Verificar se as fontes são corretas

### 6. Integrações

#### 6.1 WhatsApp (Meta Cloud API)
- [ ] **Conectar número WhatsApp**
  - Escanear QR Code
  - Verificar se a conexão é estabelecida
  - Verificar se o webhook é configurado
  
- [ ] **Receber mensagem**
  - Enviar mensagem para o número conectado
  - Verificar se a mensagem é recebida
  - Verificar se o agente responde
  - Verificar se a mensagem é salva no banco
  
- [ ] **Enviar mensagem**
  - Enviar mensagem via API
  - Verificar se a mensagem é entregue
  - Verificar se o status é atualizado
  
- [ ] **Webhook de eventos**
  - Verificar se eventos são recebidos
  - Verificar se são processados corretamente
  - Verificar se erros são tratados

#### 6.2 Email (Azure)
- [ ] **Configurar integração de email**
  - Configurar credenciais Azure
  - Verificar se a conexão é estabelecida
  
- [ ] **Receber email**
  - Enviar email para o endereço configurado
  - Verificar se o email é recebido
  - Verificar se o agente responde
  
- [ ] **Enviar email**
  - Enviar email via API
  - Verificar se o email é entregue
  - Verificar se o status é atualizado

### 7. Analytics e KPIs

#### 7.1 Dashboard de Insights
- [ ] **Visualizar KPIs**
  - Taxa de sucesso de tarefas
  - Tempo médio de resposta
  - Taxa de abandono
  - Custo por interação
  - Número de violações
  - CSAT Score
  - NPS Score
  
- [ ] **Filtros de data**
  - Filtrar por período
  - Verificar se os dados são atualizados
  
- [ ] **Filtros por agente**
  - Filtrar KPIs por agente específico
  - Verificar se os dados são corretos

#### 7.2 Export de Dados
- [ ] **Exportar CSV de billing**
  - Exportar métricas de uso
  - Exportar dados de billing
  - Verificar se o arquivo é gerado
  - Verificar se os dados estão corretos
  
- [ ] **Exportar com filtros**
  - Filtrar por data
  - Verificar se apenas dados filtrados são exportados

---

## 🔒 Testes de Segurança

### 1. Autenticação e Autorização

#### 1.1 Autenticação
- [ ] **Token JWT válido**
  - Verificar se o token é válido
  - Verificar se expira corretamente
  - Verificar se é invalidado no logout
  
- [ ] **Token JWT inválido**
  - Token expirado
  - Token modificado
  - Token sem assinatura
  - Verificar se o acesso é negado
  
- [ ] **Ataque de força bruta**
  - Múltiplas tentativas de login
  - Verificar se há rate limiting
  - Verificar se a conta é bloqueada temporariamente

#### 1.2 Autorização
- [ ] **Acesso não autorizado**
  - Tentar acessar recurso de outro tenant
  - Verificar se o acesso é negado
  - Verificar se não há vazamento de dados
  
- [ ] **Escalação de privilégios**
  - Usuário comum tentar acessar funcionalidade admin
  - Verificar se o acesso é negado
  
- [ ] **SQL Injection**
  - Tentar injetar SQL em campos de entrada
  - Verificar se as queries são parametrizadas
  - Verificar se não há execução de SQL malicioso

### 2. Proteção de Dados

#### 2.1 Isolamento Multi-Tenant
- [ ] **Isolamento de dados**
  - Verificar se tenant A não acessa dados de tenant B
  - Verificar se queries sempre filtram por `companies_id`
  - Verificar se não há vazamento de dados entre tenants
  
- [ ] **Isolamento de recursos**
  - Verificar se agentes são isolados
  - Verificar se workflows são isolados
  - Verificar se arquivos RAG são isolados

#### 2.2 Dados Sensíveis
- [ ] **API Keys**
  - Verificar se API keys não são expostas em logs
  - Verificar se são criptografadas no banco
  - Verificar se não aparecem em respostas da API
  
- [ ] **Senhas**
  - Verificar se senhas são hasheadas (não em texto plano)
  - Verificar se não são expostas em logs
  - Verificar se há política de senha forte

### 3. Proteção de API

#### 3.1 Rate Limiting
- [ ] **Limite de requisições**
  - Fazer muitas requisições em pouco tempo
  - Verificar se há rate limiting
  - Verificar se o limite é aplicado por tenant
  
- [ ] **DDoS básico**
  - Enviar muitas requisições simultâneas
  - Verificar se o servidor aguenta
  - Verificar se há proteção

#### 3.2 Validação de Entrada
- [ ] **Validação de dados**
  - Enviar dados inválidos
  - Enviar dados maliciosos (XSS, etc.)
  - Verificar se são rejeitados
  - Verificar se não causam erros no servidor
  
- [ ] **Sanitização**
  - Verificar se dados são sanitizados
  - Verificar se não há execução de código malicioso

### 4. Logs e Auditoria

#### 4.1 Logs de Segurança
- [ ] **Logs de autenticação**
  - Verificar se tentativas de login são logadas
  - Verificar se falhas são logadas
  - Verificar se sucessos são logadas
  
- [ ] **Logs de ações críticas**
  - Criação de agentes
  - Aprovação de decisões
  - Mudanças de billing
  - Verificar se são logadas com user_id e timestamp

#### 4.2 Auditoria
- [ ] **Rastreabilidade**
  - Verificar se todas as ações são rastreáveis
  - Verificar se há histórico de mudanças
  - Verificar se logs não podem ser deletados por usuários

---

## 🔗 Testes de Integração

### 1. Integração com Supabase

#### 1.1 Banco de Dados
- [ ] **Conexão com banco**
  - Verificar se a conexão é estabelecida
  - Verificar se queries funcionam
  - Verificar se transações funcionam
  
- [ ] **Migrations**
  - Verificar se migrations são aplicadas corretamente
  - Verificar se rollback funciona
  
- [ ] **Backup e Restore**
  - Verificar se backups são feitos
  - Verificar se restore funciona

#### 1.2 Autenticação Supabase
- [ ] **Login via Supabase Auth**
  - Verificar se login funciona
  - Verificar se tokens são gerados
  - Verificar se refresh token funciona

### 2. Integração com Stripe

#### 2.1 Checkout
- [ ] **Criar sessão de checkout**
  - Verificar se a sessão é criada
  - Verificar se o link é gerado
  - Verificar se o usuário é redirecionado
  
- [ ] **Processar pagamento**
  - Simular pagamento bem-sucedido
  - Verificar se webhook é recebido
  - Verificar se subscription é criada
  - Verificar se plano é atualizado

#### 2.2 Webhooks
- [ ] **Webhook de subscription criada**
  - Verificar se evento é processado
  - Verificar se subscription é salva
  
- [ ] **Webhook de subscription cancelada**
  - Verificar se evento é processado
  - Verificar se subscription é atualizada
  - Verificar se limites são aplicados

### 3. Integração com LLM (OpenAI, etc.)

#### 3.1 Chamadas de API
- [ ] **Chamada bem-sucedida**
  - Verificar se a resposta é recebida
  - Verificar se é processada corretamente
  - Verificar se tokens são contabilizados
  
- [ ] **Tratamento de erros**
  - API key inválida
  - Rate limit atingido
  - Erro de rede
  - Verificar se erros são tratados

### 4. Integração com Meta Cloud API (WhatsApp)

#### 4.1 Conexão
- [ ] **Estabelecer conexão**
  - Verificar se QR Code é gerado
  - Verificar se conexão é estabelecida
  - Verificar se webhook é configurado
  
- [ ] **Manter conexão**
  - Verificar se conexão é mantida
  - Verificar se reconecta automaticamente

#### 4.2 Webhooks
- [ ] **Receber mensagem**
  - Verificar se webhook é recebido
  - Verificar se mensagem é processada
  - Verificar se agente responde
  
- [ ] **Eventos de conexão**
  - Verificar se eventos são recebidos
  - Verificar se são processados

---

## ⚡ Testes de Performance

### 1. Performance de API

#### 1.1 Tempo de Resposta
- [ ] **Endpoints críticos**
  - `/agents/chat` - < 3 segundos
  - `/workflows/execute` - < 5 segundos
  - `/billing/subscription` - < 1 segundo
  - `/kpis` - < 2 segundos
  
- [ ] **Carga normal**
  - 10 usuários simultâneos
  - Verificar se tempo de resposta é aceitável
  
- [ ] **Carga alta**
  - 50 usuários simultâneos
  - Verificar se sistema aguenta
  - Verificar se há degradação controlada

#### 1.2 Throughput
- [ ] **Mensagens por segundo**
  - Verificar quantas mensagens o sistema processa
  - Verificar se atende à demanda esperada

### 2. Performance de Banco de Dados

#### 2.1 Queries
- [ ] **Queries otimizadas**
  - Verificar se há índices nas colunas usadas em WHERE
  - Verificar se queries não fazem full table scan
  - Verificar se há N+1 queries
  
- [ ] **Cache**
  - Verificar se cache de planos funciona
  - Verificar se reduz carga no banco

### 3. Performance de RAG

#### 3.1 Busca Vetorial
- [ ] **Tempo de busca**
  - Verificar se busca é rápida (< 1 segundo)
  - Verificar se escala com muitos arquivos
  
- [ ] **Processamento de arquivos**
  - Verificar se processamento é assíncrono
  - Verificar se não bloqueia outras operações

---

## 🏢 Testes de Multi-Tenant

### 1. Isolamento de Dados

#### 1.1 Isolamento Completo
- [ ] **Dados isolados**
  - Criar dados em tenant A
  - Verificar se tenant B não vê
  - Verificar se queries sempre filtram por `companies_id`
  
- [ ] **Recursos isolados**
  - Agentes isolados
  - Workflows isolados
  - Arquivos RAG isolados
  - Conversas isoladas

#### 1.2 Limites por Tenant
- [ ] **Limites independentes**
  - Tenant A atinge limite de agentes
  - Verificar se tenant B não é afetado
  - Verificar se limites são por tenant

### 2. Performance Multi-Tenant

#### 2.1 Múltiplos Tenants
- [ ] **10 tenants simultâneos**
  - Verificar se performance é aceitável
  - Verificar se não há interferência
  
- [ ] **100 tenants simultâneos**
  - Verificar se sistema escala
  - Verificar se há degradação controlada

---

## 💳 Testes de Billing e Limites

### 1. Planos e Limites

#### 1.1 Plano Starter
- [ ] **Limite de agentes**
  - Criar 1 agente (deve funcionar)
  - Tentar criar 2º agente (deve bloquear)
  - Verificar mensagem de erro
  
- [ ] **Limite de mensagens**
  - Enviar 50 mensagens (deve funcionar)
  - Tentar enviar 51ª mensagem (deve bloquear)
  - Verificar mensagem de erro
  
- [ ] **Features bloqueadas**
  - Tentar usar RAG (deve bloquear)
  - Tentar usar Governance (deve bloquear)
  - Verificar mensagens de erro

#### 1.2 Plano Pro
- [ ] **Limite de agentes**
  - Criar 5 agentes (deve funcionar)
  - Tentar criar 6º agente (deve bloquear)
  
- [ ] **Mensagens ilimitadas**
  - Enviar muitas mensagens
  - Verificar se não há bloqueio
  
- [ ] **Features disponíveis**
  - Usar RAG (deve funcionar)
  - Verificar se Governance ainda está bloqueado

#### 1.3 Plano Enterprise
- [ ] **Agentes ilimitados**
  - Criar muitos agentes
  - Verificar se não há bloqueio
  
- [ ] **Todas as features**
  - RAG, Governance, SSO
  - Verificar se todas funcionam

### 2. Tracking de Uso

#### 2.1 Contagem de Agentes
- [ ] **Contagem correta**
  - Criar agente (contagem +1)
  - Deletar agente (contagem -1)
  - Ativar/desativar agente
  - Verificar se contagem é correta
  
- [ ] **Apenas agentes ativos**
  - Verificar se apenas agentes com `status_id = 1` são contados

#### 2.2 Contagem de Mensagens
- [ ] **Contagem mensal**
  - Enviar mensagem
  - Verificar se contador incrementa
  - Verificar se reset no início do mês
  
- [ ] **Apenas mensagens outbound**
  - Verificar se apenas mensagens enviadas são contadas
  - Verificar se mensagens recebidas não são contadas

### 3. Bloqueios Automáticos

#### 3.1 Bloqueio de Criação
- [ ] **Bloquear criação de agente**
  - Atingir limite
  - Tentar criar agente
  - Verificar se é bloqueado
  - Verificar mensagem de erro
  
- [ ] **Bloquear envio de mensagem**
  - Atingir limite
  - Tentar enviar mensagem
  - Verificar se é bloqueado
  - Verificar mensagem de erro

#### 3.2 Upgrade de Plano
- [ ] **Upgrade via Stripe**
  - Fazer upgrade
  - Verificar se limites são atualizados
  - Verificar se bloqueios são removidos

---

## ⚠️ Limitações Conhecidas

### 1. WhatsApp Oficial da Meta

#### 1.1 Status atual
**✅ IMPORTANTE:** O fluxo suportado para WhatsApp utiliza a **Meta Cloud API**, solução oficial do WhatsApp Business.

- ✅ **API oficial da Meta**
- ✅ **Webhook oficial no endpoint `/whatsapp/webhook`**
- ✅ **Phone Number ID, Access Token e Verify Token por integração**
- ❌ **Soluções não oficiais devem ser consideradas descontinuadas**

#### 1.2 Impacto
- O ambiente de testes e produção deve validar apenas integrações oficiais da Meta
- Fluxos, scripts e documentação baseados em providers não oficiais não devem mais ser usados
- A operação deve considerar somente webhook, credenciais e número oficial configurados na Meta

#### 1.3 Requisitos operacionais
Para operar com estabilidade no WhatsApp:
- ✅ **Aprovação da Meta** para WhatsApp Business API
- ✅ **Configuração do webhook oficial**
- ✅ **Phone Number ID, Access Token, Verify Token e número oficial**
- ✅ **Vínculo do agente correto à integração**

**Status:** Este é o caminho suportado pela plataforma.

### 2. Azure Email - Requer Aprovação

#### 2.1 Problema
**⚠️ IMPORTANTE:** Para usar a integração de email com Azure, é necessário:

- 📧 **Email corporativo aprovado pela Microsoft**
- 🔐 **Verificação de domínio**
- ⏱️ **Processo de aprovação** (pode levar dias/semanas)
- 💰 **Possíveis custos** dependendo do plano Azure

#### 2.2 Impacto
- Sem email aprovado, a integração de email não funciona
- Usuários não podem receber/enviar emails via plataforma
- Funcionalidade fica limitada

#### 2.3 Solução
- ✅ Obter email corporativo
- ✅ Configurar domínio na Azure
- ✅ Aguardar aprovação da Microsoft
- ✅ Configurar credenciais na plataforma

**Status:** Aguardando aprovação da Azure/Microsoft.

### 3. Servidor Externo para Agentes

#### 3.1 Problema
**⚠️ IMPORTANTE:** Os agentes criados pelos usuários precisam rodar em um **servidor externo dedicado**. O servidor atual da plataforma não suporta a execução de múltiplos agentes simultâneos de forma eficiente.

#### 3.2 Requisitos do Servidor
Para suportar a execução de agentes, o servidor precisa ter:

- 🖥️ **Recursos computacionais adequados**
  - CPU: Mínimo 4 cores (recomendado 8+)
  - RAM: Mínimo 8GB (recomendado 16GB+)
  - Disco: SSD com espaço suficiente para logs e cache
  
- 🌐 **Conectividade**
  - Conexão estável com internet
  - Latência baixa para APIs externas (LLM, etc.)
  - Banda larga suficiente para múltiplas requisições simultâneas
  
- 🔧 **Infraestrutura**
  - Sistema operacional: Linux (Ubuntu 20.04+ recomendado)
  - Node.js 20+ instalado
  - Docker (opcional, mas recomendado)
  - Process manager (PM2, systemd, etc.)
  
- 📊 **Monitoramento**
  - Logs centralizados
  - Monitoramento de recursos (CPU, RAM, disco)
  - Alertas para problemas

#### 3.3 Opções de Suporte
Considerando o suporte da máquina, temos algumas opções:

1. **Servidor Dedicado**
   - VPS (DigitalOcean, AWS EC2, etc.)
   - Controle total sobre recursos
   - Custo mensal previsível
   
2. **Container/Orquestração**
   - Docker containers por agente
   - Kubernetes para orquestração
   - Escalabilidade automática
   
3. **Serverless (Futuro)**
   - AWS Lambda, Azure Functions
   - Execução sob demanda
   - Custo baseado em uso

#### 3.4 Impacto
- Sem servidor externo, agentes não podem ser executados
- Plataforma fica limitada a funcionalidades básicas
- Usuários não podem usar agentes em produção

**Status:** **NECESSÁRIO** antes do lançamento. Requer:
- ✅ Provisionamento de servidor
- ✅ Configuração de ambiente
- ✅ Deploy de agentes
- ✅ Monitoramento e manutenção

---

## ✅ Checklist de Pré-Lançamento

### Funcionalidades Críticas
- [ ] Autenticação funcionando
- [ ] Criação/edição/exclusão de agentes
- [ ] Workflows executando corretamente
- [ ] Sistema de aprovação funcionando
- [ ] RAG funcionando com arquivos
- [ ] Integração WhatsApp (Meta Cloud API) funcionando
- [ ] Billing e limites funcionando
- [ ] Multi-tenant isolado corretamente

### Segurança
- [ ] Todos os testes de segurança passando
- [ ] Isolamento multi-tenant validado
- [ ] Logs de auditoria funcionando
- [ ] API keys protegidas
- [ ] Rate limiting configurado

### Performance
- [ ] Tempos de resposta aceitáveis
- [ ] Sistema aguenta carga esperada
- [ ] Banco de dados otimizado
- [ ] Cache funcionando

### Infraestrutura
- [ ] Servidor externo para agentes configurado
- [ ] Monitoramento configurado
- [ ] Backups configurados
- [ ] Logs centralizados

### Documentação
- [ ] Documentação de API atualizada
- [ ] Runbooks criados
- [ ] Guias de troubleshooting
- [ ] Documentação de deploy

### Limitações Documentadas
- [ ] Fluxo oficial da Meta documentado
- [ ] Azure email pendente documentado
- [ ] Servidor externo necessário documentado

---

## 🧪 Ambiente de Testes

### Requisitos
- Ambiente isolado de produção
- Dados de teste (não dados reais)
- Acesso a serviços externos (Stripe test mode, etc.)
- Múltiplos tenants de teste

### Dados de Teste
- 3 tenants diferentes (Starter, Pro, Enterprise)
- Agentes de teste
- Workflows de teste
- Arquivos RAG de teste

### Serviços Externos
- Stripe: Modo de teste
- OpenAI: API key de teste
- Meta Cloud API: número oficial e app de teste configurados
- Supabase: Projeto de teste

---

## 📝 Notas Finais

### Prioridades
1. **CRÍTICO:** Servidor externo para agentes
2. **ALTO:** Validação de segurança
3. **MÉDIO:** Performance e otimizações
4. **BAIXO:** Refinamentos de UX

### Próximos Passos
1. Provisionar servidor externo
2. Executar todos os testes
3. Corrigir problemas encontrados
4. Validar critérios de aceite
5. Preparar documentação final
6. Planejar lançamento

---

**Última atualização:** 2025-01-XX  
**Responsável:** Equipe de Desenvolvimento  
**Status:** Em andamento
