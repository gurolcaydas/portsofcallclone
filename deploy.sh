#!/usr/bin/env bash
set -e

echo "🚢 === Starting Port of Call Deployment ==="

# Check if docker is installed
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. Building and starting containers..."
    docker compose up -d --build
    echo "✅ Application running with Docker on port 3001!"
else
    echo "📦 Building with Node.js & npm..."
    npm ci
    npm run build

    if command -v pm2 &> /dev/null; then
        echo "⚡ Restarting with PM2..."
        NODE_ENV=production pm2 startOrRestart ecosystem.config.cjs --env production 2>/dev/null || NODE_ENV=production pm2 start npm --name "portofcall" -- start
        pm2 save
        echo "✅ Application running with PM2 on port 3001!"
    else
        echo "⚠️ PM2 not found. You can start the server manually with: npm start"
    fi
fi

echo "🚢 Port of Call is live!"
