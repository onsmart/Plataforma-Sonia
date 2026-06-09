/** PM2: mantém o backend ativo no servidor, independente de SSH ou inatividade.
 *
 * Cluster mode: PM2 cria um worker por núcleo de CPU disponível e distribui
 * as conexões TCP entre eles. Cada worker é um processo Node independente,
 * então o event loop de um não bloqueia os outros durante chamadas pesadas (AI,
 * parsing de PDF, etc.). O Sentry é inicializado em cada worker via --require
 * (comportamento correto — cada processo precisa do seu próprio SDK).
 *
 * Para recarregar após mudanças aqui:
 *   pm2 delete backend && pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      node_args: '--require ./dist/lib/instrument.js',
      cwd: __dirname,

      // Cluster mode: usa todos os núcleos da CPU do servidor
      instances: 'max',
      exec_mode: 'cluster',

      autorestart: true,
      watch: false,

      // Memória por worker — com 4 núcleos = até 2 GB total antes de reiniciar workers
      max_memory_restart: '512M',

      // Tempo mínimo rodando para considerar "estável" (evita loop de restart rápido)
      min_uptime: '15s',
      max_restarts: 20,
      restart_delay: 3000,

      // Backoff exponencial: 100ms → 200ms → 400ms ... até 16s entre tentativas
      exp_backoff_restart_delay: 100,

      // Graceful shutdown: aguarda requests em andamento terminarem (até 5s)
      kill_timeout: 5000,

      // Tempo para o worker fazer listen() antes de PM2 considerá-lo travado
      listen_timeout: 8000,

      env: {
        NODE_ENV: 'production',
      },

      error_file: 'logs/pm2-error.log',
      out_file:   'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
}
