import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/environment.dart';
import '../models/game_session.dart';
import '../models/song.dart';
import '../models/playlist.dart';

class ApiService {
  final String baseUrl = AppConfig.backendUrl;

  // Get user's Spotify playlists
  Future<List<SpotifyPlaylist>> getPlaylists(String accessToken) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/spotify/playlists'),
      headers: {
        'Authorization': 'Bearer $accessToken',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final items = data['items'] as List;
      return items.map((item) => SpotifyPlaylist.fromJson(item)).toList();
    } else {
      throw Exception('Failed to load playlists');
    }
  }

  // Get songs from a playlist
  Future<List<Song>> getPlaylistSongs(
      String playlistId, String accessToken) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/spotify/playlist/$playlistId/tracks'),
      headers: {
        'Authorization': 'Bearer $accessToken',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final tracks = data['tracks'] as List;
      return tracks.map((track) {
        final trackData = track['track'];
        return Song(
          id: trackData['id'],
          title: trackData['name'],
          artist: (trackData['artists'] as List).first['name'],
          album: trackData['album']['name'],
          spotifyUri: trackData['uri'],
          previewUrl: trackData['preview_url'],
          durationMs: trackData['duration_ms'],
        );
      }).toList();
    } else {
      throw Exception('Failed to load playlist songs');
    }
  }

  // Create a new game session
  Future<Map<String, dynamic>> createGameSession(
    List<Song> songs,
    String accessToken,
    String? playlistId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/create'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'songs': songs.map((s) => s.toJson()).toList(),
        'spotifyAccessToken': accessToken,
        'spotifyPlaylistId': playlistId,
      }),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return {
        'session': GameSession.fromJson(data['session']),
        'joinUrl': data['joinUrl'],
      };
    } else {
      throw Exception('Failed to create game session');
    }
  }

  // Start the game
  Future<void> startGame(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/$sessionId/start'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to start game');
    }
  }

  // Play next round
  Future<void> playNextRound(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/$sessionId/next-round'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to play next round');
    }
  }

  // Reveal answer
  Future<void> revealAnswer(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/$sessionId/reveal-answer'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to reveal answer');
    }
  }

  // End game
  Future<void> endGame(String sessionId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/$sessionId/end'),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to end game');
    }
  }

  // Restart game with same session
  Future<GameSession> restartGame(String sessionId, List<Song> songs) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/game/$sessionId/restart'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'songs': songs.map((s) => s.toJson()).toList(),
      }),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return GameSession.fromJson(data['session']);
    } else {
      throw Exception('Failed to restart game');
    }
  }
}
