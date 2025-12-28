import 'package:flutter/material.dart';
import '../models/game_session.dart';
import '../services/api_service.dart';

class GameControlScreen extends StatefulWidget {
  final GameSession gameSession;

  const GameControlScreen({
    super.key,
    required this.gameSession,
  });

  @override
  State<GameControlScreen> createState() => _GameControlScreenState();
}

class _GameControlScreenState extends State<GameControlScreen> {
  final _apiService = ApiService();
  late GameSession _gameSession;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _gameSession = widget.gameSession;
  }

  Future<void> _playNextRound() async {
    try {
      setState(() {
        _isLoading = true;
      });

      await _apiService.playNextRound(_gameSession.id);

      // TODO: Implement Spotify playback

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Playing next round...')),
        );
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
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _revealAnswer() async {
    try {
      await _apiService.revealAnswer(_gameSession.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Answer revealed!')),
        );
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
    }
  }

  Future<void> _endGame() async {
    try {
      await _apiService.endGame(_gameSession.id);

      if (mounted) {
        Navigator.pop(context);
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
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentRound = _gameSession.currentRoundIndex + 1;
    final totalRounds = _gameSession.songs.length;
    final currentSong = _gameSession.currentRoundIndex >= 0 &&
            _gameSession.currentRoundIndex < _gameSession.songs.length
        ? _gameSession.songs[_gameSession.currentRoundIndex]
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text('Round $currentRound / $totalRounds'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (currentSong != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      const Text(
                        'Current Song',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        currentSong.title,
                        style: const TextStyle(fontSize: 16),
                        textAlign: TextAlign.center,
                      ),
                      Text(
                        currentSong.artist,
                        style: const TextStyle(color: Colors.grey),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
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
                      '${_gameSession.participantIds.length} players',
                      style: const TextStyle(fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _isLoading ? null : _playNextRound,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                backgroundColor: Colors.blue,
              ),
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Play Next Round'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _revealAnswer,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                backgroundColor: Colors.green,
              ),
              child: const Text('Reveal Answer'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _endGame,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.all(16),
              ),
              child: const Text('End Game'),
            ),
          ],
        ),
      ),
    );
  }
}
