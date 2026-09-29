module.exports = {
  apps: [
    {
      name: 'portofcall',
      script: 'server/dist/index.js',
      instances: 1, // Single instance preserves in-memory multiplayer room state
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
