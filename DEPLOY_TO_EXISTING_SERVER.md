# Deploy SongGame to songgame.theagarwals.com

## Prerequisites
- You already have PM2 and Nginx installed ✓
- Domain: `songgame.theagarwals.com`
- Node.js 18+ installed on server

## Configuration Files to Update

### 1. Environment Variables

**On your server, create `.env` files:**

```bash
# packages/backend/.env
PORT=3000
NODE_ENV=production

# Spotify Configuration
SPOTIFY_CLIENT_ID=9d44321297df4c1f9d4f8be9306331e7
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# CORS - your domain
CORS_ORIGIN=https://songgame.theagarwals.com
```

```bash
# packages/quiz-master-web/.env
# Leave these commented out to use same-origin requests
# VITE_BACKEND_URL=
# VITE_WEB_APP_URL=

VITE_SPOTIFY_CLIENT_ID=9d44321297df4c1f9d4f8be9306331e7
```

```bash
# packages/participant-web/.env
# Leave commented out for same-origin
# VITE_BACKEND_URL=
```

### 2. Nginx Configuration

**Create/update: `/etc/nginx/sites-available/songgame`**

```nginx
server {
    listen 80;
    server_name songgame.theagarwals.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name songgame.theagarwals.com;

    # SSL certificates (if you have them, otherwise use certbot)
    ssl_certificate /etc/letsencrypt/live/songgame.theagarwals.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/songgame.theagarwals.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.io (critical for game functionality)
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Optional: Increase client max body size for file uploads
    client_max_body_size 10M;
}
```

### 3. Spotify Developer Configuration

**Update your Spotify app settings:**

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Add these Redirect URIs:
   - `https://songgame.theagarwals.com/callback`
   - `http://localhost:3000/callback` (for local dev)

## Deployment Steps

### On Your Local Machine:

```bash
# 1. Build all components
cd ~/path/to/SongGame
npm run build:prod

# 2. Push to your Git repository
git push origin main
```

### On Your Server:

```bash
# 1. Navigate to your deployment directory
cd ~/apps/SongGame  # or wherever you deploy

# 2. Pull latest code
git pull origin main

# 3. Install dependencies (if package.json changed)
npm install

# 4. Create environment files
nano packages/backend/.env
# Copy the .env content from above

nano packages/quiz-master-web/.env
# Copy the .env content from above

nano packages/participant-web/.env
# Copy the .env content from above

# 5. Build for production
npm run build:prod

# 6. Stop existing PM2 process (if running)
pm2 delete songgame  # or whatever you named it

# 7. Start with PM2
pm2 start packages/backend/dist/server.js --name songgame

# 8. Save PM2 configuration
pm2 save

# 9. Enable nginx site
sudo ln -sf /etc/nginx/sites-available/songgame /etc/nginx/sites-enabled/

# 10. Test nginx configuration
sudo nginx -t

# 11. Reload nginx
sudo systemctl reload nginx
```

### Setup SSL with Let's Encrypt (if not already done):

```bash
# Install certbot (if not already installed)
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d songgame.theagarwals.com

# Certbot will automatically update your nginx config
```

## Verify Deployment

1. **Quiz Master App**: https://songgame.theagarwals.com
2. **Participant Join**: https://songgame.theagarwals.com/join/{sessionId}
3. **API Health**: https://songgame.theagarwals.com/health

## PM2 Management Commands

```bash
# View logs
pm2 logs songgame

# View status
pm2 status

# Restart app
pm2 restart songgame

# Stop app
pm2 stop songgame

# Monitor
pm2 monit
```

## Future Updates

When you make changes:

```bash
# On local machine
git add .
git commit -m "Your changes"
git push origin main

# On server
cd ~/apps/SongGame
git pull origin main
npm run build:prod
pm2 restart songgame
```

## Troubleshooting

### Check if port 3000 is in use:
```bash
sudo lsof -i :3000
```

### View nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

### View PM2 logs:
```bash
pm2 logs songgame --lines 100
```

### Test without nginx:
```bash
curl http://localhost:3000/health
```

### WebSocket connection issues:
- Ensure nginx WebSocket proxy is configured correctly
- Check that Socket.io client is connecting to the correct URL
- Verify firewall allows WebSocket connections

## Architecture

- **Single Server**: Node.js app on port 3000
- **Quiz Master Web**: Served at `/` (root)
- **Participant Web**: Served at `/join/*`
- **API**: Available at `/api/*`
- **WebSocket**: Available at `/socket.io/*`
- **Nginx**: Reverse proxy on ports 80/443
- **PM2**: Process manager for Node.js app
