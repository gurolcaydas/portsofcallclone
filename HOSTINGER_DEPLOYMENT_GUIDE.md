# Hostinger VPS Deployment Guide: Port of Call

This guide provides step-by-step instructions to deploy **Port of Call** on your **Hostinger VPS** (Ubuntu 22.04 / 24.04).

---

## Architecture Overview

- **Port 3001**: Single unified Node.js process running Express + Socket.io + serving pre-compiled Three.js client (`client/dist`).
- **Nginx (Optional but recommended)**: Reverse proxies ports 80 (HTTP) & 443 (HTTPS) to internal port 3001 with WebSocket support (`Upgrade` & `Connection` headers).

---

## Step 1: Connect to Your Hostinger VPS

Open your terminal on your Mac and SSH into your VPS using your Hostinger VPS IP and password or SSH key:

```bash
ssh root@YOUR_VPS_IP
```

Update your packages:
```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 2: Upload Your Code to the VPS

### Option A: Using Git (Recommended)
If your repository is hosted on GitHub/GitLab:

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/PortofCall.git portofcall
cd portofcall
```

### Option B: Direct Copy from Local Mac (using rsync)
Run this command from your **Mac terminal** inside the `PortofCall` directory (do NOT run this inside the VPS):

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'client/node_modules' --exclude 'server/node_modules' --exclude 'shared/node_modules' . root@YOUR_VPS_IP:/var/www/portofcall
```

---

## Step 3: Choose Your Deployment Method

### Method 1: Docker (Easiest & Recommended)

This uses the included [Dockerfile](file:///Users/gurol/Code/PortofCall/Dockerfile) and [docker-compose.yml](file:///Users/gurol/Code/PortofCall/docker-compose.yml).

1. **Install Docker & Docker Compose on VPS**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. **Navigate to the project and start**:
   ```bash
   cd /var/www/portofcall
   docker compose up -d --build
   ```

3. **Verify running status**:
   ```bash
   docker compose ps
   docker compose logs -f
   ```

Your game is now live and reachable at `http://YOUR_VPS_IP:3001`!

---

### Method 2: Native Node.js + PM2 (Without Docker)

1. **Install Node.js 20 & PM2 on VPS**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

2. **Install dependencies and build**:
   ```bash
   cd /var/www/portofcall
   npm ci
   npm run build
   ```

3. **Start with PM2 (automatic restart on reboot)**:
   ```bash
   NODE_ENV=production pm2 start npm --name "portofcall" -- start
   pm2 save
   pm2 startup
   ```
   *(Run the copy-paste command that `pm2 startup` displays to enable system reboot persistence).*

4. **Check status & logs**:
   ```bash
   pm2 status
   pm2 logs portofcall
   ```

---

## Step 4: Configure Domain, Nginx & Free SSL (Let's Encrypt)

If you have a domain pointing to your Hostinger VPS IP:

1. **Install Nginx & Certbot**:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Create Nginx site configuration**:
   ```bash
   sudo nano /etc/nginx/sites-available/portofcall
   ```

   Paste the following (replace `yourdomain.com` with your actual domain):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:3001;
           proxy_http_version 1.1;

           # WebSocket Support (Required for Socket.io)
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";

           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;

           # Real-time WebSocket timeouts
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```

3. **Enable configuration and reload Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/portofcall /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Obtain Free SSL Certificate (HTTPS)**:
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```
   Follow the prompts. Certbot will automatically configure SSL in your Nginx file and handle automatic renewals.

---

## Step 5: Configure Hostinger & Ubuntu Firewall

Ensure required ports are allowed on your server:

```bash
# Allow SSH first so you do not lock yourself out!
sudo ufw allow 22/tcp

# Allow Web Traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# (Optional) Allow port 3001 if testing directly without Nginx
sudo ufw allow 3001/tcp

sudo ufw enable
```

> **Note on Hostinger Dashboard Firewall**:
> In the Hostinger hPanel -> VPS Dashboard -> "Security" -> "Firewall", make sure incoming connections on ports 22, 80, 443 (and 3001 if used directly) are not blocked.

---

## How to Update the Game in the Future

When you make changes locally and push to your VPS:

### If using Docker:
```bash
cd /var/www/portofcall
git pull
docker compose up -d --build
```

### If using PM2:
```bash
cd /var/www/portofcall
git pull
npm ci
npm run build
pm2 restart portofcall
```
