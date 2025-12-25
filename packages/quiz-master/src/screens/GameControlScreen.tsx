import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { useAppStore } from '../store/appStore';
import { socketService } from '../services/socketService';
import { apiService } from '../services/ApiService';
import { spotifyPlaybackService } from '../services/SpotifyPlaybackService';
import type { BuzzerEvent, GameSession } from '@song-quiz/shared';

interface GameControlScreenProps {
  onGameEnded: () => void;
}

export const GameControlScreen: React.FC<GameControlScreenProps> = ({ onGameEnded }) => {
  const gameSession = useAppStore((state) => state.gameSession);
  const setGameSession = useAppStore((state) => state.setGameSession);

  const [buzzerEvents, setBuzzerEvents] = useState<Array<BuzzerEvent & { position: number }>>([]);
  const [isAwarding, setIsAwarding] = useState(false);
  const [isNexting, setIsNexting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-play song when round changes
  useEffect(() => {
    const currentRound = gameSession?.rounds[gameSession.currentRoundIndex];
    const currentSong = gameSession?.songs[gameSession.currentRoundIndex];

    if (currentRound && currentSong && !currentRound.isComplete) {
      playCurrentSong();
    }

    return () => {
      // Cleanup audio when unmounting
      spotifyPlaybackService.stop();
    };
  }, [gameSession?.currentRoundIndex]);

  // Listen for buzzer events
  useEffect(() => {
    const handleBuzzerEvent = (data: { buzzerEvent: BuzzerEvent; position: number }) => {
      console.log('🔔 Buzzer event received:', data.buzzerEvent.participantName);
      setBuzzerEvents((prev) => [...prev, { ...data.buzzerEvent, position: data.position }]);
    };

    const handleGameStateUpdate = (session: GameSession) => {
      console.log('📡 Game state update in control screen');
      setGameSession(session);

      // Reset buzzer events when round changes
      if (session.currentRoundIndex !== gameSession?.currentRoundIndex) {
        setBuzzerEvents([]);
      }
    };

    socketService.on('buzzer_event', handleBuzzerEvent);
    socketService.on('game_state_update', handleGameStateUpdate);

    return () => {
      socketService.off('buzzer_event', handleBuzzerEvent);
      socketService.off('game_state_update', handleGameStateUpdate);
    };
  }, [gameSession?.currentRoundIndex, setGameSession]);

  if (!gameSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No active game session</Text>
      </View>
    );
  }

  const currentRound = gameSession.rounds[gameSession.currentRoundIndex];
  const currentSong = gameSession.songs[gameSession.currentRoundIndex];
  const songNumber = gameSession.currentRoundIndex + 1;
  const totalSongs = gameSession.songs.length;

  const handleAwardPoints = async (participantId: string, participantName: string) => {
    if (!currentRound) return;

    try {
      setIsAwarding(true);
      console.log('🏆 Awarding points to:', participantName);

      await apiService.awardPoints(gameSession.id, currentRound.id, participantId);

      Alert.alert('Success', `Awarded points to ${participantName}!`);
    } catch (error) {
      console.error('Error awarding points:', error);
      Alert.alert('Error', 'Failed to award points');
    } finally {
      setIsAwarding(false);
    }
  };

  const handleNextRound = async () => {
    try {
      setIsNexting(true);
      console.log('⏭️  Moving to next round...');

      // Stop current audio
      spotifyPlaybackService.stop();
      setIsPlaying(false);

      const result = await apiService.nextRound(gameSession.id);

      if (result.gameComplete) {
        // Game is complete, stop playback and navigate to results
        await spotifyPlaybackService.pause();
        spotifyPlaybackService.stop();
        onGameEnded();
      } else {
        // Clear buzzer events for new round
        setBuzzerEvents([]);
      }
    } catch (error) {
      console.error('Error moving to next round:', error);
      Alert.alert('Error', 'Failed to move to next round');
    } finally {
      setIsNexting(false);
    }
  };

  const handleEndGame = () => {
    Alert.alert(
      'End Game',
      'Are you sure you want to end the game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Game',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🏁 Ending game...');

              // Stop playback
              await spotifyPlaybackService.pause();
              spotifyPlaybackService.stop();
              setIsPlaying(false);

              await apiService.endGame(gameSession.id);
              onGameEnded();
            } catch (error) {
              console.error('Error ending game:', error);
              Alert.alert('Error', 'Failed to end game');
            }
          },
        },
      ]
    );
  };

  const playCurrentSong = async () => {
    const currentRound = gameSession?.rounds[gameSession.currentRoundIndex];
    const currentSong = gameSession?.songs[gameSession.currentRoundIndex];

    if (!currentRound || !currentSong) return;

    try {
      setIsLoading(true);

      // Get start offset from round (may be random)
      const startOffsetSeconds = currentRound.songStartOffset || 0;
      const startOffsetMs = Math.floor(startOffsetSeconds * 1000);

      // Get play duration from game settings
      const durationSeconds = gameSession.settings.songDuration;

      console.log('🎵 Playing song:', currentSong.answer.title);
      console.log('Spotify URI:', currentSong.spotifyUri);
      console.log('Start offset:', startOffsetSeconds, 'seconds');
      console.log('Duration:', durationSeconds, 'seconds');

      // Play on user's active Spotify device
      await spotifyPlaybackService.play(
        currentSong.spotifyUri,
        undefined, // Let Spotify use the active device
        startOffsetMs,
        durationSeconds
      );

      setIsPlaying(true);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error playing song:', error);
      const errorMessage = error.message || 'Failed to play the song';
      Alert.alert('Playback Error', errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      await spotifyPlaybackService.pause();
      setIsPlaying(false);
    } else {
      // Check if already playing - if so, resume
      const state = await spotifyPlaybackService.getPlaybackState();
      if (state && !state.is_playing) {
        await spotifyPlaybackService.resume();
        setIsPlaying(true);
      } else {
        // Start fresh playback
        playCurrentSong();
      }
    }
  };

  const handleStop = async () => {
    await spotifyPlaybackService.pause();
    spotifyPlaybackService.stop();
    setIsPlaying(false);
  };

  const handleOpenInSpotify = async () => {
    const currentSong = gameSession?.songs[gameSession.currentRoundIndex];
    if (!currentSong) return;

    try {
      // Try to open in Spotify app first
      const spotifyUrl = currentSong.spotifyUri;
      const canOpen = await Linking.canOpenURL(spotifyUrl);

      if (canOpen) {
        await Linking.openURL(spotifyUrl);
      } else {
        // Fallback to web URL
        const webUrl = `https://open.spotify.com/track/${currentSong.spotifyTrackId}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Error opening Spotify:', error);
      Alert.alert('Error', 'Could not open Spotify');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <KeepAwake />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Round {songNumber} of {totalSongs}</Text>
        <Text style={styles.sessionId}>Session: {gameSession.id.substring(0, 8)}</Text>
      </View>

      {/* Current Song Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Song</Text>
        <View style={styles.songCard}>
          <View style={styles.songInfo}>
            <Text style={styles.songTitle}>{currentSong?.answer.title || currentSong?.metadata.title || 'Unknown'}</Text>
            <Text style={styles.songArtist}>{currentSong?.answer.artist || currentSong?.metadata.artist || 'Unknown'}</Text>
            {currentRound?.songStartOffset !== undefined && (
              <Text style={styles.offsetText}>
                Start offset: {currentRound.songStartOffset.toFixed(1)}s
              </Text>
            )}
          </View>
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={[styles.controlButton, isLoading && styles.controlButtonDisabled]}
              onPress={handlePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.controlButtonText}>{isPlaying ? '⏸' : '▶️'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleStop}
            >
              <Text style={styles.controlButtonText}>⏹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.spotifyButton]}
              onPress={handleOpenInSpotify}
            >
              <Text style={styles.controlButtonText}>🎵</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Buzzer Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Who Buzzed In</Text>
        {buzzerEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Waiting for participants to buzz...</Text>
          </View>
        ) : (
          <View style={styles.buzzerList}>
            {buzzerEvents.map((event, index) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.buzzerCard,
                  index === 0 && styles.buzzerCardFirst,
                  currentRound?.winnerId === event.participantId && styles.buzzerCardWinner,
                ]}
                onPress={() => handleAwardPoints(event.participantId, event.participantName)}
                disabled={isAwarding || currentRound?.winnerId != null}
              >
                <View style={styles.buzzerPosition}>
                  <Text style={styles.buzzerPositionText}>{index + 1}</Text>
                </View>
                <View style={styles.buzzerInfo}>
                  <Text style={styles.buzzerName}>{event.participantName}</Text>
                  <Text style={styles.buzzerTime}>{event.elapsedSeconds.toFixed(2)}s</Text>
                </View>
                {currentRound?.winnerId === event.participantId && (
                  <Text style={styles.winnerBadge}>✓ Correct</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scores</Text>
        <View style={styles.scoresList}>
          {Object.entries(gameSession.scores || {})
            .sort(([, a], [, b]) => b - a)
            .map(([participantId, score]) => {
              const participant = gameSession.participants?.find(p => p.id === participantId);
              return (
                <View key={participantId} style={styles.scoreCard}>
                  <Text style={styles.scoreName}>{participant?.name || 'Unknown'}</Text>
                  <Text style={styles.scorePoints}>{score} pts</Text>
                </View>
              );
            })}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.nextButton]}
          onPress={handleNextRound}
          disabled={isNexting}
        >
          {isNexting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {songNumber === totalSongs ? 'Finish Game' : 'Next Round'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.endButton]}
          onPress={handleEndGame}
        >
          <Text style={[styles.buttonText, styles.endButtonText]}>End Game</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  sessionId: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  songCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  songInfo: {
    flex: 1,
    marginBottom: 16,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  songArtist: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  offsetText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  spotifyButton: {
    backgroundColor: '#1DB954',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  buzzerList: {
    gap: 12,
  },
  buzzerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  buzzerCardFirst: {
    borderLeftWidth: 4,
    borderLeftColor: '#ffd700',
  },
  buzzerCardWinner: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
    borderWidth: 2,
  },
  buzzerPosition: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  buzzerPositionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  buzzerInfo: {
    flex: 1,
  },
  buzzerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  buzzerTime: {
    fontSize: 14,
    color: '#666',
  },
  winnerBadge: {
    fontSize: 16,
    fontWeight: '600',
    color: '#28a745',
  },
  scoresList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scoreName: {
    fontSize: 16,
    color: '#333',
  },
  scorePoints: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  controls: {
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#667eea',
  },
  endButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#dc3545',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  endButtonText: {
    color: '#dc3545',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 40,
  },
});
