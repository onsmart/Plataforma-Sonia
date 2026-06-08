/** PM2: mantém o backend ativo no servidor, independente de SSH ou inatividade. */
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      node_args: '--require ./dist/lib/instrument.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
}
