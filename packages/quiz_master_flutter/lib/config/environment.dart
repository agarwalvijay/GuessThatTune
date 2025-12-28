class AppConfig {
  // Backend API URL
  static const String backendUrl = 'http://192.168.1.134:3000';

  // Web App URL (for participant joining)
  static const String webAppUrl = 'http://192.168.1.134:3000';

  // Spotify Configuration
  static const String spotifyClientId = '9d44321297df4c1f9d4f8be9306331e7';
  static const String spotifyRedirectUrl = 'songgame://callback';
  static const List<String> spotifyScopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
  ];
}
