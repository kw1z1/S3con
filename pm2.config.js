module.exports = {
    apps: [{
        name: 's3-server',
        script: './server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development',
            PORT: 5050
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 5050
        },
        output: './logs/pm2-out.log',
        error: './logs/pm2-error.log',
        log: './logs/pm2-combined.log',
        time: true
    }]
};