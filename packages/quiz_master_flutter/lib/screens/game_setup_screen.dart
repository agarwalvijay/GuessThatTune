import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/playlist.dart';
import '../models/song.dart';
import '../models/game_session.dart';
import '../services/api_service.dart';
import '../services/spotify_auth_service.dart';
import '../services/socket_service.dart';
import '../config/environment.dart';
import 'game_control_screen.dart';

class GameSetupScreen extends StatefulWidget {
  final SpotifyPlaylist playlist;
  final List<Song> songs;

  const GameSetupScreen({
    super.key,
    required this.playlist,
    required this.songs,
  });

  @override
  State<GameSetupScreen> createState() => _GameSetupScreenState();
}

class _GameSetupScreenState extends State<GameSetupScreen> {
  final _apiService = ApiService();
  final _authService = SpotifyAuthService();
  final _numberOfSongsController = TextEditingController();

  GameSession? _gameSession;
  String? _joinUrl;
  bool _isCreating = false;

  @override
  void initState() {
    super.initState();
    _numberOfSongsController.text = widget.songs.length.toString();

    // Connect to socket
    socketService.connect();

    // Listen for game state updates
    socketService.on('game_state_update', _handleGameStateUpdate);
  }

  @override
  void dispose() {
    _numberOfSongsController.dispose();
    socketService.off('game_state_update', _handleGameStateUpdate);
    super.dispose();
  }

  void _handleGameStateUpdate(dynamic data) {
    if (mounted) {
      setState(() {
        _gameSession = GameSession.fromJson(data);
      });
    }
  }

  Future<void> _createGameSession() async {
    try {
      setState(() {
        _isCreating = true;
      });

      final token = await _authService.getAccessToken();
      if (token == null) {
        throw Exception('No access token available');
      }

      final numSongs = int.tryParse(_numberOfSongsController.text) ?? widget.songs.length;
      if (numSongs < 1 || numSongs > widget.songs.length) {
        throw Exception('Please enter a number between 1 and ${widget.songs.length}');
      }

      final selectedSongs = widget.songs.sublist(0, numSongs);

      final result = await _apiService.createGameSession(
        selectedSongs,
        token,
        widget.playlist.id,
      );

      if (mounted) {
        setState(() {
          _gameSession = result['session'] as GameSession;
          _joinUrl = result['joinUrl'] as String;
        });

        // Join session as master
        socketService.joinSession(_gameSession!.id);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isCreating = false;
        });
      }
    }
  }

  Future<void> _startGame() async {
    if (_gameSession == null) return;

    try {
      await _apiService.startGame(_gameSession!.id);

      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => GameControlScreen(
              gameSession: _gameSession!,
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error starting game: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String _getJoinUrl() {
    if (_joinUrl != null) return _joinUrl!;
    if (_gameSession != null) {
      return '${AppConfig.webAppUrl}/join/${_gameSession!.id}';
    }
    return '';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Game Setup'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: _gameSession == null
            ? _buildSetupForm()
            : _buildWaitingRoom(),
      ),
    );
  }

  Widget _buildSetupForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.playlist.name,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 24),
        TextField(
          controller: _numberOfSongsController,
          decoration: InputDecoration(
            labelText: 'Number of Songs',
            hintText: '1-${widget.songs.length}',
            border: const OutlineInputBorder(),
          ),
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        Text(
          'Available: ${widget.songs.length} songs',
          style: const TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 32),
        ElevatedButton(
          onPressed: _isCreating ? null : _createGameSession,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.all(16),
          ),
          child: _isCreating
              ? const CircularProgressIndicator()
              : const Text('Create Game Session'),
        ),
      ],
    );
  }

  Widget _buildWaitingRoom() {
    return Column(
      children: [
        const Text(
          'Participants Join Here',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
          child: QrImageView(
            data: _getJoinUrl(),
            version: QrVersions.auto,
            size: 200,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          _getJoinUrl(),
          style: const TextStyle(color: Colors.blue),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Session ID: ${_gameSession!.id}',
          style: const TextStyle(color: Colors.grey),
        ),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text(
                  'Participants',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  '${_gameSession!.participantIds.length} participant(s) joined',
                  style: const TextStyle(fontSize: 16),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _startGame,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.all(16),
            backgroundColor: Colors.green,
          ),
          child: const Text('Start Game'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () {
            setState(() {
              _gameSession = null;
              _joinUrl = null;
            });
          },
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.all(16),
          ),
          child: const Text('Start New Session (New QR Code)'),
        ),
      ],
    );
  }
}
