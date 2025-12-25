// Environment configuration
export const config = {
  // Backend API URL
  backendUrl: 'http://192.168.5.126:3000',

  // Spotify Configuration
  // You'll need to create a Spotify Developer App and add these credentials
  spotify: {
    clientId: '9d44321297df4c1f9d4f8be9306331e7', // Add your Spotify Client ID here
    redirectUrl: 'songgame://callback',
    scopes: [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'streaming',
      'user-read-playback-state',
      'user-modify-playback-state',
    ],
  },
};

export default config;
