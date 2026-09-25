module.exports = {
  apps: [
    {
      name: 'renic-hq-server',
      script: './backend/src/server.js',
      cwd: '/var/www/renic_soft',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5050
      }
    },
    {
      name: 'renic-wa-automation',
      script: './backend/server.js',
      cwd: '/var/www/wa_automation',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
