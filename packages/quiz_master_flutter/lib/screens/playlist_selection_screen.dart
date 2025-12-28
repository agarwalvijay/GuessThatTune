import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../services/spotify_auth_service.dart';
import '../models/playlist.dart';
import '../models/song.dart';
import 'game_setup_screen.dart';

class PlaylistSelectionScreen extends StatefulWidget {
  const PlaylistSelectionScreen({super.key});

  @override
  State<PlaylistSelectionScreen> createState() =>
      _PlaylistSelectionScreenState();
}

class _PlaylistSelectionScreenState extends State<PlaylistSelectionScreen> {
  final _apiService = ApiService();
  final _authService = SpotifyAuthService();
  List<SpotifyPlaylist> _playlists = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlaylists();
  }

  Future<void> _loadPlaylists() async {
    try {
      final token = await _authService.getAccessToken();
      if (token == null) {
        setState(() {
          _error = 'No access token available';
          _isLoading = false;
        });
        return;
      }

      final playlists = await _apiService.getPlaylists(token);
      setState(() {
        _playlists = playlists;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _selectPlaylist(SpotifyPlaylist playlist) async {
    try {
      final token = await _authService.getAccessToken();
      if (token == null) return;

      // Show loading
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(
          child: CircularProgressIndicator(),
        ),
      );

      final songs = await _apiService.getPlaylistSongs(playlist.id, token);

      if (mounted) {
        Navigator.pop(context); // Close loading dialog

        // Navigate to game setup
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => GameSetupScreen(
              playlist: playlist,
              songs: songs,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context); // Close loading dialog
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading songs: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Playlist'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() {
                _isLoading = true;
              });
              _loadPlaylists();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error, size: 64, color: Colors.red),
                      const SizedBox(height: 16),
                      Text(_error!),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _isLoading = true;
                            _error = null;
                          });
                          _loadPlaylists();
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _playlists.isEmpty
                  ? const Center(
                      child: Text('No playlists found'),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _playlists.length,
                      itemBuilder: (context, index) {
                        final playlist = _playlists[index];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: ListTile(
                            leading: playlist.imageUrl != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: Image.network(
                                      playlist.imageUrl!,
                                      width: 56,
                                      height: 56,
                                      fit: BoxFit.cover,
                                    ),
                                  )
                                : const Icon(Icons.music_note, size: 56),
                            title: Text(
                              playlist.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            subtitle: Text('${playlist.trackCount} tracks'),
                            trailing: const Icon(Icons.arrow_forward_ios),
                            onTap: () => _selectPlaylist(playlist),
                          ),
                        );
                      },
                    ),
    );
  }
}
