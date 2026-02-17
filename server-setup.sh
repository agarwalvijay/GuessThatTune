#!/bin/bash
set -e  # Exit on any error

echo "=== SongGame Server Setup Script ==="
echo "This script will:"
echo "1. Check and display current configuration"
echo "2. Fix nginx configuration"
echo "3. Set up PM2 to run the backend"
echo "4. Configure SSL certificates"
echo ""
read -p "Press Enter to continue..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="$HOME/hearandguess/GuessThatTune"
BACKEND_PORT=4000

echo -e "${YELLOW}=== Step 1: Checking Current Setup ===${NC}"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 status:"
pm2 status || echo "PM2 not running yet"
echo ""

echo -e "${YELLOW}=== Step 2: Checking if backend is built ===${NC}"
if [ ! -f "$APP_DIR/packages/backend/dist/server.js" ]; then
    echo -e "${RED}Backend not built! Building now...${NC}"
    cd "$APP_DIR"
    npm run build:prod
else
    echo -e "${GREEN}Backend is built${NC}"
fi
echo ""

echo -e "${YELLOW}=== Step 3: Creating nginx configuration ===${NC}"
sudo tee /etc/nginx/sites-available/songgame > /dev/null << 'NGINX_EOF'
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name hearandguess.com www.hearandguess.com songgame.theagarwals.com;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server for hearandguess.com
server {
    listen 443 ssl http2;
    server_name hearandguess.com www.hearandguess.com;

    ssl_certificate /etc/letsencrypt/live/hearandguess.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hearandguess.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Serve participant web app
    location /join {
        alias /home/vagarwal/hearandguess/GuessThatTune/packages/participant-web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io proxy
    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve quiz master web app (default)
    location / {
        root /home/vagarwal/hearandguess/GuessThatTune/packages/quiz-master-web/dist;
        try_files $uri $uri/ /index.html;
    }

    client_max_body_size 10M;
}

# HTTPS server for songgame.theagarwals.com
server {
    listen 443 ssl http2;
    server_name songgame.theagarwals.com;

    ssl_certificate /etc/letsencrypt/live/songgame.theagarwals.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/songgame.theagarwals.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Same configuration as hearandguess.com
    location /join {
        alias /home/vagarwal/hearandguess/GuessThatTune/packages/participant-web/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /home/vagarwal/hearandguess/GuessThatTune/packages/quiz-master-web/dist;
        try_files $uri $uri/ /index.html;
    }

    client_max_body_size 10M;
}
NGINX_EOF

echo -e "${GREEN}nginx configuration created${NC}"
echo ""

echo -e "${YELLOW}=== Step 4: Testing nginx configuration ===${NC}"
sudo nginx -t
echo ""

echo -e "${YELLOW}=== Step 5: Reloading nginx ===${NC}"
sudo systemctl reload nginx
echo -e "${GREEN}nginx reloaded${NC}"
echo ""

echo -e "${YELLOW}=== Step 6: Setting up PM2 ===${NC}"

# Stop any existing process
pm2 delete songgame 2>/dev/null || echo "No existing PM2 process to delete"

# Start the backend
cd "$APP_DIR"
pm2 start packages/backend/dist/server.js --name songgame

# Save PM2 process list
pm2 save

# Set up PM2 to start on boot (only if not already done)
if ! sudo systemctl is-enabled pm2-vagarwal.service 2>/dev/null; then
    echo "Setting up PM2 startup..."
    pm2 startup systemd -u vagarwal --hp /home/vagarwal
    echo -e "${YELLOW}Note: You may need to run the command that PM2 outputs above${NC}"
fi

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "PM2 Status:"
pm2 status
echo ""
echo "Testing services:"
echo -n "Backend health check: "
curl -s http://localhost:4000/api/health && echo -e "${GREEN}OK${NC}" || echo -e "${RED}FAILED${NC}"
echo ""
echo "Access your sites at:"
echo "  - https://hearandguess.com"
echo "  - https://songgame.theagarwals.com"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check PM2 status"
echo "  pm2 logs songgame   - View backend logs"
echo "  pm2 restart songgame - Restart backend"
echo "  sudo nginx -t       - Test nginx config"
echo "  sudo systemctl reload nginx - Reload nginx"
