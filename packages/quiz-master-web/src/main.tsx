import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Define Spotify SDK callback early to prevent errors on pages that don't use it
// The actual implementation will be set by spotifyPlaybackService when needed
window.onSpotifyWebPlaybackSDKReady = () => {
  console.log('🎵 Spotify SDK loaded (placeholder callback)');
};

createRoot(document.getElementById('root')!).render(
  <App />
)
