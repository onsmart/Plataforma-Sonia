# Observabilidade — Camadas, Funcionamento e Cuidados

Documento técnico de referência da stack de observabilidade da Plataforma Sonia.
Toda vez que uma camada for adicionada, alterada ou removida, este documento deve ser atualizado no mesmo esforço.

Configurações: [`observabilidade/`](../observabilidade/) · Código backend: [`BackEnd/src/lib/metrics.ts`](../BackEnd/src/lib/metrics.ts), [`BackEnd/src/lib/instrument.ts`](../BackEnd/src/lib/instrument.ts), [`BackEnd/src/middleware/metrics.middleware.ts`](../BackEnd/src/middleware/metrics.middleware.ts), [`BackEnd/src/middleware/error-handler.middleware.ts`](../BackEnd/src/middleware/error-handler.middleware.ts)

---

## Visão geral da arquitetura

```
Servidor Linux
├── PM2 → Backend Node.js :3333
│         ├── GET /health      (sem auth)
│         ├── GET /metrics     (Bearer token)
│         └── logs → BackEnd/logs/pm2-*.log
│
└── Node Exporter :9100 (Docker, obs-net)

Docker Compose (~/observabilidade/)
├── Prometheus :9090    → coleta /metrics e node-exporter
├── Grafana    :3030    → dashboards + alertas → e-mail via Resend
├── Loki       :3100    → armazena logs
└── Promtail           → lê pm2-*.log → envia ao Loki

Sentry Cloud (externo)
└── Captura exceções via SDK no backend
```

---

## 1. PM2

**O que é:** gerenciador de processos Node.js. Não é uma ferramenta de observabilidade, mas é a base de tudo — mantém o backend vivo e gera os logs que alimentam o Loki.

**O que controla:**
- Ciclo de vida do processo (`online`, `stopped`, `errored`)
- Reinício automático em caso de crash (`autorestart: true`)
- Limite de memória para reinício (`max_memory_restart: 1G`)
- Arquivos de log: `BackEnd/logs/pm2-out.log` (stdout) e `pm2-error.log` (stderr)
- Injeção de variáveis de ambiente via `ecosystem.config.cjs`

**Como usar:**
```bash
pm2 status                        # estado dos processos
pm2 logs backend --lines 50       # logs em tempo real
pm2 restart backend --update-env  # reiniciar com novos env vars
pm2 reload ecosystem.config.cjs   # recarregar config (node_args, etc.)
pm2 delete backend && pm2 start ecosystem.config.cjs  # forçar config nova
```

**Cuidados:**
- `pm2 restart` não recarrega `node_args` do `ecosystem.config.cjs` — use `pm2 reload` ou `delete + start` para alterações de config
- `override: false` no `dotenv` significa que variáveis já presentes no ambiente (shell/PM2) têm precedência sobre o `.env` — usar `pm2 restart --update-env` para forçar novos valores do shell
- Após o servidor reiniciar, PM2 precisa ser levantado manualmente a menos que `pm2 startup` + `pm2 save` tenham sido configurados

---

## 2. Prometheus

**O que é:** banco de dados de séries temporais (TSDB) especializado em métricas. Funciona por **pull** — ele busca métricas nos endpoints configurados a cada `scrape_interval` (15s).

**O que coleta:**

| Job | Endpoint | Métricas |
|-----|----------|----------|
| `prometheus` | `localhost:9090` | auto-monitoramento |
| `node-exporter` | `node-exporter:9100` | CPU, RAM, disco, rede, filesystem |
| `backend-sonia` | `host-gateway:3333/metrics` | HTTP, Node.js heap, event loop, GC |

**Métricas do backend (prefixo `sonia_`):**
- `sonia_http_request_duration_seconds` — histograma de latência por rota/método/status
- `sonia_http_requests_total` — contador de requisições
- `sonia_http_errors_total` — contador de erros 4xx e 5xx
- Métricas padrão Node.js (sem prefixo): `nodejs_heap_*`, `nodejs_eventloop_lag_*`, `process_cpu_*`

**Retenção:** 15 dias (`--storage.tsdb.retention.time=15d`)

**Cuidados:**
- Nunca expor a porta 9090 publicamente — manter em `127.0.0.1`
- Cuidado com **alta cardinalidade**: não adicionar labels com valores únicos (IDs de usuário, UUIDs de requisição) — explodem o número de séries temporais
- O `METRICS_BEARER_TOKEN` no backend deve ser idêntico ao `credentials` no `prometheus.yml` — qualquer diferença resulta em 401 e target DOWN
- Ao trocar o token: atualizar o `.env` do backend E o `prometheus.yml`, depois `pm2 restart --update-env` E `docker compose restart prometheus`
- `host-gateway` no `prometheus.yml` resolve para `172.17.0.1` (Docker bridge) — se o servidor trocar, verificar com `ip addr show docker0`

---

## 3. Node Exporter

**O que é:** agente que expõe métricas do sistema operacional Linux para o Prometheus. Roda como container Docker na rede `obs-net`, com volumes montados do host para ler `/proc` e `/sys`.

**O que monitora:**
- CPU por modo (`user`, `system`, `idle`, `iowait`)
- Memória RAM (`MemTotal`, `MemAvailable`, `Cached`, `Buffers`)
- Disco: espaço usado/disponível por filesystem e mountpoint
- Rede: bytes/pacotes por interface (RX/TX)
- Load average (1m, 5m, 15m)
- File descriptors abertos
- Uptime do sistema

**Cuidados:**
- Requer volumes `ro` do host (`/`, `/proc`, `/sys`) — nunca montar com escrita
- Não usar `network_mode: host` nesta instalação — causa conflito de firewall com o Prometheus em Docker bridge; usar `networks: [obs-net]` com `--path.procfs=/host/proc`
- A porta 9100 não é exposta externamente (`ports` não definido) — só acessível dentro de `obs-net`

---

## 4. Grafana

**O que é:** plataforma de visualização e alertas. Conecta-se ao Prometheus e ao Loki como datasources e exibe dashboards interativos.

**Datasources configurados:**
- **Prometheus** (`http://prometheus:9090`) — métricas
- **Loki** (`http://loki:3100`) — logs

**Dashboards ativos:**
| Nome | ID | Fonte de dados |
|------|----|----------------|
| Node Exporter Full | 1860 | Prometheus |
| Node.js Application | 11159 | Prometheus |

**Alertas configurados (pasta `Sonia / Infraestrutura`):**
| Alerta | Threshold | Pending | Canal |
|--------|-----------|---------|-------|
| Backend Fora do Ar | `up < 1` | 2m | Email |
| CPU Alta | `> 90%` | 5m | Email |
| RAM Alta | `> 85%` | 5m | Email |
| Disco Alto | `> 80%` | 5m | Email |
| Erros 5xx Altos | `> 0.05/s` | 2m | Email |
| Latência Alta | `p95 > 2s` | 2m | Email |

**Acesso:** túnel SSH `ssh -L 3030:localhost:3030 servidoronsmart@192.168.15.31` → `http://localhost:3030`

**Cuidados:**
- Porta 3030 em `127.0.0.1` — acesso externo apenas via Nginx com HTTPS (não implementado) ou túnel SSH
- `GF_AUTH_ANONYMOUS_ENABLED=false` — nunca habilitar acesso anônimo
- Credenciais em `~/observabilidade/.env` no servidor — nunca commitar
- Ao adicionar novo alerta com query que pode retornar `No data` (ex: erros, latência): configurar **Alert state if no data → Normal** para evitar falsos positivos
- `histogram_quantile` pode retornar `+Inf` nos primeiros minutos após restart — usar `pending period` adequado

---

## 5. Loki

**O que é:** sistema de armazenamento e indexação de logs otimizado para uso com Grafana. Diferente do Elasticsearch, indexa apenas os **labels** (metadata), não o conteúdo dos logs — mais eficiente em disco.

**Labels indexados:**
- `job` → `sonia-backend`
- `app` → `sonia`
- `env` → `production`
- `log_type` → `stdout` ou `stderr`
- `service` → `backend-node`

**Retenção:** 30 dias (`retention_period: 30d`)

**Como consultar no Grafana (Explore → Loki):**
```
{job="sonia-backend"}                          # todos os logs
{job="sonia-backend", log_type="stderr"}       # só erros
{job="sonia-backend"} |= "ERROR"              # filtrar por texto
{job="sonia-backend"} |= "WhatsApp"           # logs de WhatsApp
{job="sonia-backend"} | json | level="error"  # se log for JSON
```

**Cuidados:**
- Porta 3100 em `127.0.0.1` — nunca exposta externamente
- `delete_request_store: filesystem` obrigatório no Loki 3.x quando `retention_enabled: true`
- Se o Loki subir antes do Promtail conseguir resolver o DNS `loki`, recriar o Promtail: `docker compose up -d --force-recreate promtail`
- Monitorar espaço em disco: logs de aplicação ativa crescem rapidamente — verificar com `docker system df -v`

---

## 6. Promtail

**O que é:** agente coletor de logs. Lê arquivos de log do PM2, aplica labels e envia para o Loki via HTTP push.

**Arquivos monitorados:**
| Arquivo no host | Path no container | Label `log_type` |
|----------------|-------------------|-----------------|
| `BackEnd/logs/pm2-out.log` | `/var/log/pm2/pm2-out.log` | `stdout` |
| `BackEnd/logs/pm2-error.log` | `/var/log/pm2/pm2-error.log` | `stderr` |

**Cuidados:**
- O path do host é definido via `PM2_LOGS_PATH` no `~/observabilidade/.env` — deve apontar para o diretório real dos logs PM2 no servidor (`/home/servidoronsmart/plataform-backend/BackEnd/logs`)
- Montar sempre como `ro` (read-only) — Promtail não precisa escrever nos logs
- O Promtail armazena posição de leitura em `/tmp/promtail-positions.yaml` — se o container for removido, ele relê os logs desde o início
- Sempre iniciar o Loki antes do Promtail ou recriar o Promtail após o Loki estar `ready`

---

## 7. Sentry

**O que é:** plataforma de rastreamento de erros em tempo real. Captura exceções com stack trace completo, contexto da requisição e frequência do problema.

**Como está integrado:**
- `BackEnd/src/lib/instrument.ts` — inicializa o Sentry via `--require` no PM2 (antes de qualquer outro módulo)
- `BackEnd/src/middleware/error-handler.middleware.ts` — captura todos os erros 5xx com `Sentry.captureException(err)`
- `ecosystem.config.cjs` — `node_args: '--require ./dist/lib/instrument.js'`

**O que captura:**
- Exceções não tratadas (`unhandledRejection`, `uncaughtException`)
- Erros HTTP 5xx via `errorHandler`
- Eventos manuais via `Sentry.captureException(err)` ou `Sentry.captureMessage(msg)` em qualquer serviço

**Como usar em novos serviços:**
```typescript
import * as Sentry from '@sentry/node'

try {
  await operacaoCritica()
} catch (err) {
  Sentry.captureException(err)
  throw err
}
```

**Variável necessária no `.env`:**
```env
SENTRY_DSN=https://...@...ingest.sentry.io/...
```

**Acesso:** [sentry.io](https://sentry.io) → projeto `sonia-backend` → Issues

**Cuidados:**
- `sendDefaultPii: false` — nunca enviar dados pessoais (e-mails, CPFs, tokens) ao Sentry
- `tracesSampleRate: 0.1` — apenas 10% das transações são rastreadas para performance (controla custo)
- Não logar payloads de webhook cru, tokens de autenticação ou senhas — filtrar antes de capturar
- A inicialização via `--require` (instrumento separado) é obrigatória no Sentry v8 com CommonJS — se alterar o `ecosystem.config.cjs`, usar `pm2 reload` ou `pm2 delete + start` para que o novo `node_args` seja aplicado
- Ao fazer deploy novo: o `SENTRY_DSN` precisa estar no `.env` do servidor E nas variáveis do processo PM2 (`pm2 restart --update-env`)

---

## Quando atualizar este documento

| Gatilho | O que atualizar |
|---------|----------------|
| Nova ferramenta adicionada à stack | Nova seção completa |
| Mudança de threshold em alerta do Grafana | Tabela de alertas na seção Grafana |
| Mudança no `prometheus.yml` (novo job, novo token) | Seção Prometheus |
| Mudança no path dos logs do PM2 | Seção Promtail |
| Novo tipo de erro capturado manualmente no Sentry | Seção Sentry |
| Mudança de retenção do Loki | Seção Loki |
| Mudança de versão de algum container | Seção correspondente |
