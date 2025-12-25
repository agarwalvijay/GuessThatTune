import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
  const [isRevealed, setIsRevealed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-play song when round changes
  useEffect(() => {
    const currentRound = gameSession?.rounds[gameSession.currentRoundIndex];
    const currentSong = gameSession?.songs[gameSession.currentRoundIndex];

    if (currentRound && currentSong && !currentRound.isComplete) {
      playCurrentSong();
    }

    // Reset reveal state when round changes
    setIsRevealed(false);
    setElapsedSeconds(0);
    progressAnim.setValue(0);

    return () => {
      // Cleanup audio when unmounting
      spotifyPlaybackService.stop();
    };
  }, [gameSession?.currentRoundIndex]);

  // Update progress bar to match elapsed seconds
  useEffect(() => {
    if (gameSession) {
      const durationSeconds = gameSession.settings.songDuration;
      const progress = Math.min(elapsedSeconds / durationSeconds, 1);
      progressAnim.setValue(progress);
    }
  }, [elapsedSeconds, gameSession]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPlaying && gameSession) {
      const durationSeconds = gameSession.settings.songDuration;

      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 0.1;
          if (next >= durationSeconds) {
            return durationSeconds;
          }
          return next;
        });
      }, 100);
    } else {
      if (interval) {
        clearInterval(interval);
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, gameSession]);

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
    setElapsedSeconds(0);
    progressAnim.setValue(0);
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

      {/* Top spacing */}
      <View style={styles.topSpacer} />

      {/* App Title */}
      <Text style={styles.appTitle}>SongGame</Text>

      {/* Playback Card with Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.playbackCard}
      >
        {/* Header with Round Badge and Controls */}
        <View style={styles.cardHeader}>
          {/* Round Badge */}
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>Round {songNumber}/{totalSongs}</Text>
          </View>

          {/* Playback Controls */}
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={[styles.controlButton, isLoading && styles.controlButtonDisabled]}
              onPress={handlePlayPause}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#667eea" size="small" />
              ) : isPlaying ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playIcon} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleStop}
            >
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Timer and Progress Bar */}
        <View style={styles.timerSection}>
          <Text style={styles.timerText}>
            {elapsedSeconds.toFixed(1)}s / {gameSession.settings.songDuration}s
          </Text>
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>

        {/* Reveal/Hide Song Info */}
        <TouchableOpacity
          style={styles.revealButton}
          onPress={() => setIsRevealed(!isRevealed)}
        >
          <Text style={styles.revealButtonText}>
            {isRevealed ? 'Hide' : 'Reveal'} Song
          </Text>
        </TouchableOpacity>

        {isRevealed && currentSong && (
          <View style={styles.songInfo}>
            <Text style={styles.songTitle}>{currentSong.answer.title}</Text>
            <Text style={styles.songArtist}>{currentSong.answer.artist}</Text>
            {currentSong.metadata.album && (
              <Text style={styles.songAlbum}>Album: {currentSong.metadata.album}</Text>
            )}
            {currentSong.metadata.duration && (
              <Text style={styles.songDuration}>
                Duration: {Math.floor(currentSong.metadata.duration / 60)}:{String(currentSong.metadata.duration % 60).padStart(2, '0')}
              </Text>
            )}
            {currentRound?.songStartOffset !== undefined && (
              <Text style={styles.songOffset}>
                Start: {currentRound.songStartOffset.toFixed(1)}s
              </Text>
            )}
            {currentSong.spotifyUri && (
              <Text style={styles.songUri} numberOfLines={1}>
                URI: {currentSong.spotifyUri}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>

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
    backgroundColor: '#f8f9fa',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  topSpacer: {
    height: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  playbackCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  roundBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roundBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  playIcon: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftColor: '#667eea',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 18,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  timerSection: {
    marginBottom: 16,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  revealButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  revealButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  songInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  songOffset: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    marginBottom: 4,
  },
  songAlbum: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  songDuration: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 4,
  },
  songUri: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  buzzerList: {
    gap: 8,
  },
  buzzerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  buzzerCardFirst: {
    borderLeftWidth: 3,
    borderLeftColor: '#ffd700',
  },
  buzzerCardWinner: {
    backgroundColor: '#f0f9f4',
    borderColor: '#34d399',
    borderWidth: 1.5,
  },
  buzzerPosition: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  buzzerPositionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  buzzerInfo: {
    flex: 1,
  },
  buzzerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  buzzerTime: {
    fontSize: 13,
    color: '#999',
  },
  winnerBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  scoresList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  scoreName: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  scorePoints: {
    fontSize: 15,
    fontWeight: '700',
    color: '#667eea',
  },
  controls: {
    gap: 10,
    marginTop: 16,
    marginBottom: 32,
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
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  endButtonText: {
    color: '#ef4444',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
  },
});
