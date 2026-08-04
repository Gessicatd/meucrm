module.exports = {
  apps: [{
    name: 'meucrm',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/var/www/meucrm',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/www/meucrm/logs/err.log',
    out_file: '/var/www/meucrm/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
