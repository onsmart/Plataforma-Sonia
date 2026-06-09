# Observabilidade — stack e manutenção (projeto Sonia)

Referência obrigatória: **`docs/observabilidade-camadas.md`**

Este documento descreve cada camada da stack (PM2, Prometheus, Grafana, Node Exporter, Loki, Promtail, Sentry), o que cada uma controla, como funciona e os cuidados necessários.

## Quando ler antes de agir

Consultar `docs/observabilidade-camadas.md` antes de:

- Adicionar, remover ou alterar qualquer ferramenta da stack de observabilidade
- Modificar arquivos em `observabilidade/` (docker-compose, configs do Prometheus, Loki, Promtail, Grafana)
- Modificar `BackEnd/src/lib/metrics.ts`, `BackEnd/src/lib/instrument.ts`, `BackEnd/src/middleware/metrics.middleware.ts`
- Modificar `BackEnd/ecosystem.config.cjs` (especialmente `node_args`)
- Adicionar novos alertas ou datasources no Grafana
- Alterar retenção de métricas ou logs
- Integrar Sentry em novos serviços ou módulos

## Quando atualizar o documento

Atualizar `docs/observabilidade-camadas.md` **no mesmo esforço** (mesmo commit ou PR) quando:

| Gatilho | O que atualizar no documento |
|---------|------------------------------|
| Nova ferramenta adicionada | Nova seção completa com funcionamento e cuidados |
| Threshold de alerta alterado | Tabela de alertas na seção Grafana |
| Novo job no `prometheus.yml` | Tabela de jobs na seção Prometheus |
| Mudança no path dos logs PM2 | Seção Promtail |
| Nova captura manual de erro no Sentry | Seção Sentry |
| Mudança de retenção (Prometheus ou Loki) | Seção correspondente |
| Versão de container atualizada | Seção correspondente |
| Mudança no `node_args` do PM2 | Seção PM2 |

## Regras críticas da stack atual

1. **Token de métricas:** `METRICS_BEARER_TOKEN` no `.env` do backend deve ser idêntico ao `credentials` em `prometheus.yml` — qualquer diferença resulta em 401 e target DOWN no Prometheus.

2. **PM2 e node_args:** alterações no `ecosystem.config.cjs` (como `node_args`) exigem `pm2 reload ecosystem.config.cjs` ou `pm2 delete backend && pm2 start ecosystem.config.cjs` — `pm2 restart` não recarrega a config.

3. **Sentry instrument:** o arquivo `dist/lib/instrument.js` deve ser carregado via `--require` antes de qualquer outro módulo. Nunca mover a inicialização do Sentry para dentro do `index.ts` como import normal — o Express será carregado antes e o SDK não funcionará corretamente.

4. **Alta cardinalidade:** nunca adicionar labels com valores únicos (UUIDs de usuário, IDs de requisição) nas métricas do Prometheus — causa explosão de séries temporais.

5. **Alertas com No Data:** ao criar alertas para métricas que podem não ter dados (erros, latência em período sem tráfego), sempre configurar **Alert state if no data → Normal**.

6. **Portas internas:** Prometheus (9090), Loki (3100) e Node Exporter (9100) nunca devem ter portas expostas publicamente. Grafana (3030) acessado via túnel SSH ou Nginx com HTTPS.

7. **Loki + Promtail:** sempre iniciar o Loki antes do Promtail. Se o Promtail tiver erro de DNS `server misbehaving`, recriar com `docker compose up -d --force-recreate promtail`.

## Ao encerrar a tarefa

No resumo ao usuário, indique em uma linha: **observabilidade atualizada** (qual camada + o que mudou) ou **observabilidade não alterada** (e por quê).
