import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:uni_links/uni_links.dart';
import '../config/environment.dart';

class SpotifyAuthService {
  static const String _tokenKey = 'spotify_access_token';
  static const String _expiryKey = 'spotify_token_expiry';
  StreamSubscription? _linkSubscription;

  Future<String?> authenticate() async {
    try {
      final scope = AppConfig.spotifyScopes.join('%20');
      final authUrl = Uri.parse('https://accounts.spotify.com/authorize'
          '?client_id=${AppConfig.spotifyClientId}'
          '&response_type=token'
          '&redirect_uri=${Uri.encodeComponent(AppConfig.spotifyRedirectUrl)}'
          '&scope=$scope');

      // Launch Spotify authorization URL
      if (await canLaunchUrl(authUrl)) {
        await launchUrl(authUrl, mode: LaunchMode.externalApplication);
      } else {
        throw Exception('Could not launch $authUrl');
      }

      // Wait for callback
      final completer = Completer<String?>();

      _linkSubscription = uriLinkStream.listen((Uri? uri) {
        if (uri != null && uri.scheme == 'songgame') {
          _linkSubscription?.cancel();

          // Extract access token from fragment
          final fragment = uri.fragment;
          final params = Uri.splitQueryString(fragment);
          final accessToken = params['access_token'];
          final expiresIn = params['expires_in'];

          if (accessToken != null) {
            final expirySeconds = int.tryParse(expiresIn ?? '3600') ?? 3600;
            final expiryTime =
                DateTime.now().add(Duration(seconds: expirySeconds)).millisecondsSinceEpoch;

            _saveToken(accessToken, expiryTime);
            completer.complete(accessToken);
          } else {
            completer.complete(null);
          }
        }
      });

      // Timeout after 5 minutes
      return await completer.future.timeout(
        const Duration(minutes: 5),
        onTimeout: () {
          _linkSubscription?.cancel();
          return null;
        },
      );
    } catch (e) {
      print('Error during Spotify authentication: $e');
      _linkSubscription?.cancel();
      return null;
    }
  }

  Future<void> _saveToken(String token, int expiryTime) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setInt(_expiryKey, expiryTime);
  }

  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final expiry = prefs.getInt(_expiryKey);

    if (token == null || expiry == null) {
      return null;
    }

    // Check if token is expired
    if (DateTime.now().millisecondsSinceEpoch > expiry) {
      await clearToken();
      return null;
    }

    return token;
  }

  Future<bool> isAuthenticated() async {
    final token = await getAccessToken();
    return token != null;
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_expiryKey);
  }
}
