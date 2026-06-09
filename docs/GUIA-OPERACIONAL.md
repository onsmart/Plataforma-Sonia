# Guia Operacional — Plataforma Sonia

Referência para inicializar, fazer deploy e monitorar a plataforma.  
Atualizado: 2026-06-09

---

## Índice

1. [Acesso ao servidor](#1-acesso-ao-servidor)
2. [Inicialização do backend (PM2)](#2-inicialização-do-backend-pm2)
3. [Inicialização da observabilidade (Docker)](#3-inicialização-da-observabilidade-docker)
4. [Acesso ao Grafana via túnel SSH](#4-acesso-ao-grafana-via-túnel-ssh)
5. [Deploy de atualizações](#5-deploy-de-atualizações)
6. [Stress test](#6-stress-test)
7. [O que observar no Grafana durante o teste](#7-o-que-observar-no-grafana-durante-o-teste)
8. [Comandos de diagnóstico rápido](#8-comandos-de-diagnóstico-rápido)

---

## 1. Acesso ao servidor

**IP local:** `192.168.15.31`  
**Usuário SSH:** `servidoronsmart`

### Configuração única no PC (Windows)

Edite ou crie o arquivo `C:\Users\<seu-usuario>\.ssh\config`:

```
Host servidoronsmart
    HostName 192.168.15.31
    User servidoronsmart
    LocalForward 3030 127.0.0.1:3030
    ServerAliveInterval 60
    ServerAliveCountMax 0
```

Com essa config, o comando `ssh servidoronsmart` já:
- Conecta com o usuário correto
- Abre o túnel para o Grafana automaticamente
- Mantém a sessão viva (sem cair por inatividade)

### Conectar

```powershell
# No terminal Windows (PowerShell ou CMD)
ssh servidoronsmart
```

---

## 2. Inicialização do backend (PM2)

### Verificar se está rodando

```bash
pm2 list
```

Resultado esperado: múltiplas instâncias de `backend` com status `online` (uma por núcleo de CPU, modo cluster).

### Se estiver parado — iniciar

```bash
cd ~/plataform-backend/BackEnd
pm2 start ecosystem.config.cjs
pm2 save
```

### Se precisar reiniciar após deploy

```bash
cd ~/plataform-backend/BackEnd

# IMPORTANTE: pm2 restart NÃO recarrega o ecosystem.config.cjs
# Use sempre esta sequência após mudanças de config:
pm2 delete backend && pm2 start ecosystem.config.cjs && pm2 save
```

### Verificar logs em tempo real

```bash
pm2 logs backend --lines 50
```

---

## 3. Inicialização da observabilidade (Docker)

Os containers **não sobem automaticamente** após reboot do servidor (pendência conhecida). Sempre que o servidor reiniciar, rodar:

```bash
cd ~/observabilidade
docker compose up -d
```

### Verificar se estão rodando

```bash
docker compose ps
```

Resultado esperado — todos com `Status: Up`:

| Container | Função |
|-----------|--------|
| `obs-grafana` | Dashboards de monitoramento |
| `obs-prometheus` | Coleta e armazena métricas |
| `obs-loki` | Armazena logs |
| `obs-promtail` | Coleta logs do PM2 e envia ao Loki |
| `obs-node-exporter` | Métricas de CPU/memória/disco do servidor |

### Se algum container estiver parado

```bash
cd ~/observabilidade
docker compose up -d          # sobe o que estiver parado
docker compose restart loki   # reinicia container específico
```

### Se o Promtail tiver erro de DNS

```bash
cd ~/observabilidade
docker compose up -d --force-recreate promtail
```

---

## 4. Acesso ao Grafana via túnel SSH

O Grafana só aceita conexões de dentro do servidor (`127.0.0.1:3030`). Para acessar do PC:

### Passo 1 — Abrir o túnel SSH (PC Windows)

```powershell
ssh servidoronsmart
```

> Mantenha esta janela aberta enquanto usar o Grafana. Fechar encerra o túnel.

### Passo 2 — Abrir no browser

```
http://localhost:3030
```

### Credenciais

As credenciais estão no arquivo `~/observabilidade/.env` do servidor. Para consultar:

```bash
cat ~/observabilidade/.env | grep GRAFANA_ADMIN
```

---

## 5. Deploy de atualizações

### Do PC — commit e push

```powershell
cd "C:\Users\Mateus Mantovani\Desktop\Projetos\Plataformadeatendimentosonia"
git add -p          # ou adicionar arquivos específicos
git commit -m "descrição"
git push
```

### No servidor — build e restart

```bash
cd ~/plataform-backend/BackEnd

# 1. Puxa o código novo
git pull

# 2. Instala dependências novas (se houver)
npm ci --omit=dev

# 3. Compila TypeScript
npm run build

# 4. Reinicia o backend
# — Use esta sequência se ecosystem.config.cjs mudou:
pm2 delete backend && pm2 start ecosystem.config.cjs && pm2 save

# — Use esta se só o código mudou (mais rápido, mantém cluster):
pm2 reload backend
```

### Frontend (Vercel)

O push para `main` dispara o deploy automático no Vercel. Acompanhe em `vercel.com`.

---

## 6. Stress test

O script testa a plataforma com carga crescente e mede onde o servidor começa a degradar.

### Pré-requisito

Backend rodando no servidor. O script roda **do PC Windows**, não precisa ser copiado para o servidor.

### Como rodar

```powershell
# No terminal Windows (pasta do projeto)
cd "C:\Users\Mateus Mantovani\Desktop\Projetos\Plataformadeatendimentosonia\BackEnd"

# Opção 1 — Todas as 4 fases (~3 minutos, inclui chamadas reais à IA Anthropic)
node scripts/stress-test.mjs --backend http://192.168.15.31:3333

# Opção 2 — Só endpoints leves, sem IA (~1.5 minuto, recomendado para testes rápidos)
node scripts/stress-test.mjs --backend http://192.168.15.31:3333 --sem-ai

# Opção 3 — Começar a partir de uma fase específica
node scripts/stress-test.mjs --backend http://192.168.15.31:3333 --fase 3 --sem-ai
```

### O que cada fase testa

| Fase | Usuários | Duração | O que simula |
|------|----------|---------|--------------|
| **1 — Baseline** | 5 | 20s | Uso mínimo: billing, listagem de agentes. Valida que o servidor está saudável. |
| **2 — Carga normal** | 20 | 30s | 20 usuários navegando simultaneamente (billing, fluxos, agentes, CRM). Uso real com várias empresas ativas. |
| **3 — Pico** | 50 | 30s | 50 usuários ao mesmo tempo. Identifica o ponto onde a latência explode ou erros aparecem. |
| **4 — IA** | 5 | 60s | 5 conversas simultâneas com o agente (chama a Anthropic de verdade). Testa o gargalo de IA. |

### Como funciona na prática

Cada "usuário virtual" é uma Promise JavaScript que fica em loop disparando requisições HTTP reais para o backend durante o tempo da fase. Todas as Promises rodam ao mesmo tempo via `Promise.allSettled`. O script mede o tempo de cada resposta individualmente e calcula percentis estatísticos.

- **p50 (mediana):** metade das requisições responderam em menos que este tempo
- **p95:** 95% das requisições responderam em menos que este tempo — o mais relevante para UX
- **p99:** os 1% mais lentos — aponta casos extremos e timeouts
- **Taxa de erro:** % de requisições que receberam erro 5xx ou timeout

### Interpretação dos resultados

| p95 | Taxa de erro | Interpretação |
|-----|-------------|---------------|
| < 300ms | 0% | Servidor confortável |
| 300–1000ms | 0% | Servidor sob pressão, ainda aceitável |
| > 1000ms | 0% | Gargalo de CPU ou rede — avaliar cluster mode |
| qualquer | 1–5% | Servidor degradando, requisições sendo descartadas |
| qualquer | > 5% | Limite atingido — servidor não aguenta esta carga |

---

## 7. O que observar no Grafana durante o teste

Abra o Grafana (`http://localhost:3030`) antes de rodar o script e deixe os painéis visíveis em paralelo.

### Dashboard principal: "Sonia Backend"

#### Painel — Requisições por segundo (`http_requests_total`)

**O que você vê:** número de req/s chegando no backend em tempo real.  
**O que procurar:** deve subir proporcionalmente ao número de usuários da fase. Se travar num valor baixo enquanto o script envia mais carga, o servidor está enfileirando ou rejeitando.

#### Painel — Latência HTTP (`http_request_duration_seconds`)

**O que você vê:** percentis p50, p95, p99 de tempo de resposta.  
**O que procurar:**
- p95 subindo acima de 1s durante a Fase 3 = sinal de pressão
- p99 acima de 5s = requisições próximas do timeout
- Latência que sobe e não volta = leak de memória ou conexões presas

#### Painel — Taxa de erros

**O que você vê:** % de respostas 5xx.  
**O que procurar:** qualquer valor acima de 0 durante as Fases 1 e 2 é problema. Na Fase 3 (pico), até 1% é aceitável em produção.

### Dashboard: "Node Exporter / Server"

#### CPU por núcleo

**O que você vê:** uso de CPU de cada núcleo do servidor.  
**O que procurar:**
- Com cluster mode correto: a carga deve ser distribuída entre vários núcleos
- Se apenas 1 núcleo chega a 100% enquanto os outros ficam ociosos: cluster mode não foi aplicado corretamente — rodar `pm2 delete backend && pm2 start ecosystem.config.cjs`
- Se todos os núcleos chegam a 100% juntos: o servidor atingiu o limite real de CPU

#### Memória usada

**O que você vê:** RAM total em uso.  
**O que procurar:** crescimento contínuo sem estabilizar = memory leak no backend. Com cluster mode e `max_memory_restart: 512M`, um worker individual vai reiniciar antes de consumir toda a RAM.

#### Saturação de rede (bytes in/out)

**O que você vê:** tráfego de rede do servidor em MB/s.  
**O que procurar:** se a CPU estiver baixa mas a latência for alta, o gargalo pode ser a banda da conexão do servidor.

### Logs — Dashboard "Loki / PM2 Logs"

**O que você vê:** logs do backend em tempo real, vindos do PM2 via Promtail.  
**O que procurar durante o teste:**
- Erros `ECONNRESET`, `ETIMEDOUT` = requisições caindo por timeout
- Mensagens `Worker X died` = workers do cluster reiniciando por memória ou crash
- Stack traces de erro 500 = bugs ativados pela carga

---

## 8. Comandos de diagnóstico rápido

```bash
# Status geral do backend
pm2 list
pm2 monit             # monitor interativo (CPU/memória por worker em tempo real)

# Status da observabilidade
cd ~/observabilidade && docker compose ps

# Últimos erros do backend
pm2 logs backend --err --lines 100

# Uso de recursos do servidor
htop                  # interativo
free -h               # memória
df -h                 # disco

# Reiniciar tudo do zero
pm2 delete backend && pm2 start ~/plataform-backend/BackEnd/ecosystem.config.cjs && pm2 save
cd ~/observabilidade && docker compose up -d
```
