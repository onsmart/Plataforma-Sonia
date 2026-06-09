/** PM2: mantém o backend ativo no servidor, independente de SSH ou inatividade.
 *
 * Executa em fork mode com 1 instância — estável e compatível com o Sentry
 * --require. Cluster mode (multi-core) fica pendente de investigação da
 * compatibilidade do instrument.js com workers PM2.
 *
 * Para recarregar após mudanças aqui:
 *   pm2 delete all && pm2 start ecosystem.config.cjs && pm2 save
 */
const path = require('path')

module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      node_args: ['--require', path.join(__dirname, 'dist/lib/instrument.js')],
      cwd: __dirname,

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,

      max_memory_restart: '1G',
      min_uptime: '15s',
      max_restarts: 20,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
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
