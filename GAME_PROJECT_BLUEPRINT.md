# 🚀 Multiplayer Web Game Engine & Project Blueprint
### A Production-Ready Starter Architecture for Autonomous AI Agents & Developers

> **INSTRUCTION FOR NEXT AI AGENT / DEVELOPER**:
> **READ THIS FILE FIRST** before creating, architecting, or extending any new web gaming project in this ecosystem.
> While the **game theme or genre can vary completely** (e.g. maritime trade, space colonization, cyberpunk cyberpunk syndicate, tactical turn-based RTS, post-apocalyptic survival, medieval kingdom management), the **core architectural patterns, technology stack, workspace configuration, git workflows, and Hostinger VPS deployment pipeline documented here are battle-tested, fast, and production-proven**. Follow this blueprint to achieve zero-friction setup and deployment.

---

## 1. Architectural Philosophy & Core Decisions

1. **Lightweight Monorepo Workspaces (`npm workspaces`)**:
   - A single repository hosting `shared/`, `server/`, and `client/`.
   - Shared models and physics are written once in TypeScript and consumed by both server and client without publishing to npm registry.
2. **Single Unified Production Port**:
   - In production, Node.js + Express handles Socket.io WebSockets, REST APIs, and serves the pre-compiled client bundle (`client/dist`) on a single port (`3001`).
   - **Zero CORS issues, zero cross-domain WebSocket headaches, and trivial Nginx reverse proxy configuration.**
3. **No Heavy Framework Overhead for Game Views**:
   - Rather than fighting React/Next.js virtual DOM reconciliation delays during high-frequency 60 FPS canvas or 3D animations, use **TypeScript + HTML5 Canvas 2D + Three.js + Vanilla CSS Modules/Tokens**.
   - DOM is used for crisp, accessible UI overlays (modals, HUD, buttons, dialogs); Canvas and WebGL are used for the game world, maps, and minigames.
4. **Authoritative Server with In-Memory State**:
   - The server maintains the source of truth in memory per room (`GameRoom`), ticking at a calibrated rate (e.g. 10–20 Hz for management/strategy, 30–60 Hz for real-time action).
   - State is synchronized to clients via Socket.io events. Single-instance PM2 processes guarantee zero cross-process synchronization bugs.
5. **Procedural Audio via Web Audio API**:
   - Sound effects (horns, radar beeps, cash registers, storms, engines) are synthesized procedurally in code with zero external MP3 file download latencies or missing asset 404s.

---

## 2. Technology Stack & Key Libraries

| Component | Technology | Version / Spec | Purpose & Benefits |
| :--- | :--- | :--- | :--- |
| **Monorepo Engine** | npm workspaces | Node.js 20+ LTS | Seamless local linking between `shared`, `server`, and `client`. |
| **Language** | TypeScript | `^5.4.0` | Strict type safety across network boundaries. |
| **Backend Runtime** | Node.js + Express | Express `^4.19.0` | High-performance HTTP routing & static asset delivery. |
| **WebSockets** | Socket.io + Socket.io Client | `^4.7.5` | Resilient bidirectional communication with automatic reconnection & binary support. |
| **Dev Server (Server)** | `tsx` | `^4.10.0` | Instant TypeScript execution & hot reloading for backend without manual compile step. |
| **Frontend Bundler** | Vite | `^5.2.0` | Lightning-fast HMR and optimized production bundling into `client/dist`. |
| **3D Engine** | Three.js | `^0.164.0` | Hardware-accelerated 3D minigames, physics scenes, terrain, and vehicle piloting. |
| **2D Engine** | HTML5 Canvas 2D | Native Browser API | Pixel-perfect 60 FPS vector world maps, nautical charts, HUDs, and tactical radars. |
| **Styling & Design** | Vanilla CSS + CSS Variables | CSS3 / Glassmorphism | Custom design system, responsive flex/grid, Google Fonts (Chakra Petch, Inter), zero bundle bloat. |
| **Process Manager** | PM2 | `^5.3.0` | Zero-downtime restarts, memory caps, system reboot persistence on VPS. |
| **Reverse Proxy** | Nginx | 1.18+ / 1.24+ | SSL termination, WebSocket proxying, gzip/brotli compression. |
| **SSL / HTTPS** | Let's Encrypt Certbot | certbot-nginx | 100% free, automated SSL certificates for production domains. |
| **Cloud Hosting** | Hostinger VPS | Ubuntu 22.04 / 24.04 | Cost-effective, high-bandwidth virtual private servers. |

---

## 3. Project Directory Template

```text
<project-root>/
├── .gitignore                      # Git exclusions (node_modules, dist, .env, etc.)
├── Dockerfile                      # Multi-stage production build (optional)
├── docker-compose.yml              # Container orchestration (optional)
├── deploy.sh                       # Local/remote one-step deployment automation
├── ecosystem.config.cjs            # PM2 production process configuration
├── nginx.conf.example              # Sample Nginx reverse proxy with WebSocket headers
├── package.json                    # Monorepo root package defining workspaces
├── package-lock.json
│
├── shared/                         # 🧠 SHARED CODEBASE (Client & Server)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                # Types, Interfaces, Game Enums, Constants, Port/Map Data
│
├── server/                         # 🖥️ BACKEND NODE.JS SERVER
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # Express setup, HTTP server, Socket.io initialization, static serving
│       └── services/
│           ├── GameRoom.ts         # Authoritative room instance, state machine, tick loop
│           └── MarketManager.ts    # Economy, dynamic pricing, random events
│
└── client/                         # 🎮 FRONTEND VITE WEB APP
    ├── index.html                  # Main entry page, viewport settings, audio unlocks
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts              # Proxy config for local dev (routes /socket.io to :3001)
    └── src/
        ├── main.ts                 # Socket.io connection, game loop, keyboard/touch input handlers
        ├── styles/
        │   └── main.css            # Dark glassmorphic design tokens, UI components, animations
        └── ui/
            ├── UIManager.ts        # DOM modal/dashboard manager, company stats, action buttons
            ├── WorldMap.ts         # High-fidelity 2D Canvas vector map, continents, routes, ships
            ├── ThreeMinigame.ts    # Three.js 3D action scene (e.g. docking, combat, storm navigation)
            └── SoundManager.ts     # Procedural Web Audio API sound synthesizer
```

---

## 4. Configuration Boilerplates

### Root `package.json`
```json
{
  "name": "my-multiplayer-game",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "shared",
    "server",
    "client"
  ],
  "scripts": {
    "dev": "npm run dev:server & npm run dev:client",
    "dev:server": "npm run dev --workspace=@game/server",
    "dev:client": "npm run dev --workspace=@game/client",
    "build": "npm run build --workspaces --if-present",
    "start": "node server/dist/index.js"
  }
}
```

### Shared `shared/package.json`
```json
{
  "name": "@game/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

### Server `server/package.json`
```json
{
  "name": "@game/server",
  "version": "1.0.0",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@game/shared": "*",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "tsx": "^4.10.5",
    "typescript": "^5.4.5"
  }
}
```

### Client `client/package.json`
```json
{
  "name": "@game/client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@game/shared": "*",
    "socket.io-client": "^4.7.5",
    "three": "^0.164.1"
  },
  "devDependencies": {
    "@types/three": "^0.164.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
```

### PM2 `ecosystem.config.cjs`
```javascript
module.exports = {
  apps: [
    {
      name: 'mygame',
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
```

---

## 5. Server Architecture & Unified Serving Pattern

The server entry point (`server/src/index.ts`) must support both local development and production static hosting:

```typescript
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In production, serve the pre-compiled Vite frontend bundle
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Real-time multiplayer rooms & socket listeners here...
io.on('connection', (socket) => {
  // join_room, player_action, disconnect
});

// Single-page application fallback:
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🎮 Game Server running on port ${PORT}`);
});
```

---

## 6. Procedural Web Audio Engine (Zero Asset Loading)

Instead of relying on remote sound assets, build a `SoundManager.ts` using the browser's native **Web Audio API**:

```typescript
export class SoundManager {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Example: Synthesized Radar Ping
  playPing(freq = 880, duration = 0.4) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // Example: Deep Engine / Thruster Rumble
  playRumble(duration = 1.0) {
    if (!this.soundEnabled) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(45, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}
```

---

## 7. Git & Remote Repository Workflow

### 1. Initial Setup
```bash
git init
git checkout -b main
git remote add origin git@github.com:<username>/<repository-name>.git
```

### 2. Standard `.gitignore`
```gitignore
node_modules/
dist/
.DS_Store
.env
.env.local
*.log
npm-debug.log*
.idea/
.vscode/
```

### 3. Pre-Commit Validation Rule
> **MANDATORY FOR AI AGENTS**: Never commit or push without running the top-level build check to ensure all workspaces compile without TypeScript or bundle errors:
```bash
npm run build
```

### 4. Semantic Commit Conventions
- `feat(mechanics): add real-time collision detection`
- `fix(socket): resolve disconnection memory leak in GameRoom`
- `refactor(ui): modernize glassmorphic dashboard layout`
- `perf(canvas): optimize radar batch rendering loop`
- `deploy(hostinger): update Nginx WebSocket configuration`

---

## 8. Hostinger VPS Deployment Guide (Complete Step-by-Step)

### Step 1: Initial VPS Configuration (Ubuntu 22.04 / 24.04)
Connect to your Hostinger VPS via SSH from your terminal:
```bash
ssh root@YOUR_VPS_IP
```

Update system packages and install Node.js 20 LTS, Git, and PM2:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

### Step 2: Configure Firewall (Hostinger hPanel & Ubuntu UFW)
1. **Ubuntu UFW**:
   ```bash
   sudo ufw allow 22/tcp    # SSH (Do this FIRST!)
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw allow 3001/tcp  # Direct App testing (Optional)
   sudo ufw enable
   ```
2. **Hostinger hPanel**:
   - Go to **VPS Dashboard** -> **Security** -> **Firewall**.
   - Ensure inbound ports `22`, `80`, `443` are allowed.

### Step 3: Clone & Build Repository on VPS
```bash
mkdir -p /var/www
cd /var/www
git clone git@github.com:<username>/<repository-name>.git game
cd game

# Install clean dependencies and compile all workspaces
npm ci
npm run build
```

### Step 4: Launch via PM2 with Auto-Restart
```bash
NODE_ENV=production pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```
*(Copy-paste the command output by `pm2 startup` to enable persistence across server reboots).*

Verify status and live logs:
```bash
pm2 status
pm2 logs game
```

### Step 5: Configure Nginx Reverse Proxy with WebSockets
Create a site configuration file:
```bash
sudo nano /etc/nginx/sites-available/game
```

Paste the following template (replace `yourdomain.com` with your actual domain or VPS IP):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket support (Critical for Socket.io)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Keep real-time multiplayer connections alive
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/game /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Install Free Automated SSL (HTTPS / WSS)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will automatically install the Let's Encrypt certificates, redirect HTTP to HTTPS, and update the Nginx configuration.

---

## 9. Future Update / Deploy One-Liner

When you or an AI agent pushes updates to `main`, run this single command on the Hostinger VPS to deploy:

```bash
cd /var/www/game && git pull origin main && npm run build && pm2 restart game
```

Or run the automated deployment script:
```bash
./deploy.sh
```

---

## 10. AI Agent 10-Step Execution Checklist for New Projects

When starting a completely new game using this template, execute these steps in order:

- [ ] **Step 1: Scaffolding**: Create the workspace directory structure (`shared/`, `server/`, `client/`) and root `package.json`.
- [ ] **Step 2: Shared Domain**: Define core entities, enums, game constants, and Socket event signatures in `shared/src/index.ts`.
- [ ] **Step 3: Server Core**: Implement `server/src/index.ts` with Express + Socket.io + static asset delivery.
- [ ] **Step 4: Game Loop**: Build `server/src/services/GameRoom.ts` with room management, state ticks (10–20 Hz), and client action listeners.
- [ ] **Step 5: Frontend Shell**: Setup Vite in `client/` with `index.html`, viewport config, and `client/src/styles/main.css`.
- [ ] **Step 6: UI & Design**: Implement `UIManager.ts` with modern cyber/tactical styling, CSS variables, and responsive panels.
- [ ] **Step 7: Game Canvas / 3D**: Implement Canvas 2D map/radar or Three.js scene, attaching render loop to `requestAnimationFrame`.
- [ ] **Step 8: Audio**: Hook up `SoundManager.ts` with Web Audio API procedural synthesis.
- [ ] **Step 9: Local Multi-tab Test**: Run `npm run dev` and open two browser windows to test real-time multiplayer synchronization.
- [ ] **Step 10: Deploy**: Build cleanly with `npm run build`, push to Git `main`, and execute the Hostinger PM2 deployment command.
