export const config = {
  // Backend API URL
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://192.168.1.134:3000',

  // Web App URL (for participant joining)
  webAppUrl: import.meta.env.VITE_WEB_APP_URL || 'http://192.168.1.134:3000',

  // Spotify Configuration
  spotify: {
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID || '9d44321297df4c1f9d4f8be9306331e7',
    redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/callback`,
    scopes: [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'streaming',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
    ],
  },
};
