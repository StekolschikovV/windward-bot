module.exports = {
    apps: [
        {
            wait_ready: true,
            script: 'ts-node',
            args: './index.ts',
            watch: true,
            name: 'dev-API',
            NODE_ENV: 'development',
            PORT: 8080,
        },
    ],
};
