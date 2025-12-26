# SongGame Deployment Guide

## Single Server Architecture

The application is configured to run as a single Node.js server that serves:
- **Backend API** on `/api/*`
- **Quiz Master Web App** on root routes (`/`, `/playlists`, `/game-setup`, etc.)
- **Participant Web App** on `/join/*` routes

All three components run on **port 3000** by default.

## Prerequisites

- Node.js 18+ and npm
- Spotify Developer Account with registered app
- GCP account (for cloud deployment)

## Building for Production

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env` file in `packages/backend`:

```env
PORT=3000
NODE_ENV=production

# Spotify Configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# CORS - Add your production domain
CORS_ORIGIN=https://your-domain.com
```

Create `.env` file in `packages/quiz-master-web`:

```env
VITE_BACKEND_URL=https://your-domain.com
VITE_WEB_APP_URL=https://your-domain.com
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
```

Create `.env` file in `packages/participant-web`:

```env
VITE_BACKEND_URL=https://your-domain.com
```

### 3. Build All Components

```bash
npm run build:prod
```

This will:
1. Build participant-web → `packages/participant-web/dist`
2. Build quiz-master-web → `packages/quiz-master-web/dist`
3. Build backend → `packages/backend/dist`

### 4. Start Production Server

```bash
npm start
```

The server will be available at `http://localhost:3000`

## Deploying to Google Cloud Platform (GCP)

### Option 1: GCP Compute Engine VM

#### 1. Create a VM Instance

```bash
# Using gcloud CLI
gcloud compute instances create songgame-server \
    --project=YOUR_PROJECT_ID \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=http-server,https-server
```

#### 2. Configure Firewall Rules

```bash
# Allow HTTP traffic
gcloud compute firewall-rules create allow-http \
    --allow tcp:80 \
    --target-tags http-server

# Allow HTTPS traffic
gcloud compute firewall-rules create allow-https \
    --allow tcp:443 \
    --target-tags https-server

# Allow port 3000 (or use nginx as reverse proxy)
gcloud compute firewall-rules create allow-app \
    --allow tcp:3000 \
    --target-tags http-server
```

#### 3. SSH into VM

```bash
gcloud compute ssh songgame-server --zone=us-central1-a
```

#### 4. Install Node.js on VM

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install git
sudo apt-get install -y git
```

#### 5. Clone and Setup Application

```bash
# Clone your repository
git clone https://github.com/your-username/SongGame.git
cd SongGame

# Install dependencies
npm install

# Create environment files (see section above)
nano packages/backend/.env
nano packages/quiz-master-web/.env
nano packages/participant-web/.env

# Build for production
npm run build:prod
```

#### 6. Start with PM2

```bash
# Start the application
pm2 start packages/backend/dist/server.js --name songgame

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions from the command output
```

#### 7. Setup Nginx as Reverse Proxy (Recommended)

```bash
# Install nginx
sudo apt-get install -y nginx

# Create nginx configuration
sudo nano /etc/nginx/sites-available/songgame
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

    # WebSocket support for Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/songgame /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

#### 8. Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically update your nginx configuration
```

### Option 2: GCP Cloud Run (Alternative)

#### 1. Create Dockerfile

Create `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/participant-web/package*.json ./packages/participant-web/
COPY packages/quiz-master-web/package*.json ./packages/quiz-master-web/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build all packages
RUN npm run build:prod

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

#### 2. Deploy to Cloud Run

```bash
# Build and push to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/songgame

# Deploy to Cloud Run
gcloud run deploy songgame \
    --image gcr.io/YOUR_PROJECT_ID/songgame \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 3000 \
    --set-env-vars "NODE_ENV=production,SPOTIFY_CLIENT_ID=your_id,SPOTIFY_CLIENT_SECRET=your_secret"
```

## Monitoring and Maintenance

### View Logs (PM2)

```bash
# View logs
pm2 logs songgame

# View process status
pm2 status

# Restart application
pm2 restart songgame
```

### Update Application

```bash
# Pull latest code
cd ~/SongGame
git pull

# Rebuild
npm run build:prod

# Restart
pm2 restart songgame
```

## Spotify Configuration

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create or edit your app
3. Add Redirect URIs:
   - `https://your-domain.com/callback`
   - `http://localhost:3000/callback` (for local development)
4. Update environment variables with your Client ID and Secret

## Testing the Deployment

1. **Quiz Master Web App**: `https://your-domain.com`
2. **Participant Join**: `https://your-domain.com/join/{sessionId}`
3. **API Health Check**: `https://your-domain.com/health`

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
kill -9 PID
```

### PM2 Process Not Starting

```bash
# Check logs
pm2 logs songgame --lines 100

# Delete and restart
pm2 delete songgame
pm2 start packages/backend/dist/server.js --name songgame
```

### Socket.io Connection Issues

- Ensure WebSocket support is enabled in your reverse proxy
- Check CORS configuration in backend
- Verify firewall rules allow WebSocket connections

## Cost Estimation (GCP)

- **Compute Engine e2-medium**: ~$25/month
- **Cloud Run**: Pay per use, typically $5-15/month for low traffic
- **Cloud Storage**: Minimal cost for static assets
- **Bandwidth**: Typically under $5/month for moderate usage

## Security Best Practices

1. Use environment variables for sensitive data
2. Enable HTTPS with SSL certificates
3. Configure firewall to allow only necessary ports
4. Keep Node.js and dependencies updated
5. Use PM2 or similar for process management
6. Implement rate limiting for API endpoints
7. Regular security audits and updates
