# Deployment Options for Quiz Master Web

## Local Development

For local development, use:
- Redirect URI: `http://localhost:5173/callback`
- Access at: `http://localhost:5173`

## Network Access During Development

### Option 1: ngrok (Recommended for Testing)

1. Install ngrok: https://ngrok.com/download
2. Run ngrok:
   ```bash
   ngrok http 5173
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Add to Spotify Dashboard: `https://abc123.ngrok.io/callback`
5. Create `.env` file:
   ```
   VITE_SPOTIFY_REDIRECT_URI=https://abc123.ngrok.io/callback
   ```
6. Restart dev server

### Option 2: Local HTTPS Certificate

Use Vite's built-in HTTPS support:

1. Install mkcert:
   ```bash
   brew install mkcert  # macOS
   ```

2. Create certificates:
   ```bash
   mkcert -install
   mkcert localhost 192.168.1.134
   ```

3. Update `vite.config.ts`:
   ```typescript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import fs from 'fs'

   export default defineConfig({
     plugins: [react()],
     server: {
       https: {
         key: fs.readFileSync('./localhost+1-key.pem'),
         cert: fs.readFileSync('./localhost+1.pem'),
       },
       host: true,
     },
   })
   ```

4. Add redirect URI to Spotify: `https://192.168.1.134:5173/callback`

## Production Deployment

For production, deploy to a hosting service with HTTPS:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

Update redirect URI to your production URL.
