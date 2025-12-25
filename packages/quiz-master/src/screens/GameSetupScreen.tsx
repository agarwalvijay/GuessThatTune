import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import KeepAwake from 'react-native-keep-awake';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/ApiService';
import { spotifyAuthService } from '../services/SpotifyAuthService';
import { socketService } from '../services/socketService';
import { DEFAULT_GAME_SETTINGS } from '@song-quiz/shared';
import type { GameSession } from '@song-quiz/shared';
import config from '../config/environment';

interface GameSetupScreenProps {
  onGameStarted: () => void;
}

export const GameSetupScreen: React.FC<GameSetupScreenProps> = ({ onGameStarted }) => {
  const selectedPlaylist = useAppStore((state) => state.selectedPlaylist);
  const songs = useAppStore((state) => state.songs);
  const gameSession = useAppStore((state) => state.gameSession);
  const setGameSession = useAppStore((state) => state.setGameSession);

  const [isCreating, setIsCreating] = useState(false);
  const [numberOfSongs, setNumberOfSongs] = useState((songs?.length || 0).toString());
  const [songDuration, setSongDuration] = useState(DEFAULT_GAME_SETTINGS.songDuration.toString());
  const [joinUrl, setJoinUrl] = useState('');

  const handleCreateGame = async () => {
    try {
      setIsCreating(true);

      // Get access token
      const accessToken = await spotifyAuthService.getAccessToken();
      if (!accessToken) {
        Alert.alert('Error', 'No Spotify access token available');
        return;
      }

      // Validate and prepare songs
      const numSongs = parseInt(numberOfSongs, 10);
      if (isNaN(numSongs) || numSongs < 1 || numSongs > songs.length) {
        Alert.alert('Error', `Please enter a number between 1 and ${songs.length}`);
        return;
      }

      const selectedSongs = songs.slice(0, numSongs);

      // Create game session
      console.log('Creating game session with', selectedSongs.length, 'songs');
      const response = await apiService.createGameSession(
        selectedSongs,
        accessToken,
        selectedPlaylist?.id
      );

      console.log('Game session created:', response.session.id);
      console.log('Join URL:', response.joinUrl);
      setGameSession(response.session);
      setJoinUrl(response.joinUrl);
    } catch (error) {
      console.error('Error creating game:', error);
      if ((error as any).response) {
        console.error('Response status:', (error as any).response.status);
        console.error('Response data:', (error as any).response.data);
      }
      const errorMsg = (error as any).response?.data?.error || 'Failed to create game session';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartGame = async () => {
    if (!gameSession) return;

    try {
      console.log('Starting game...');
      await apiService.startGame(gameSession.id);
      onGameStarted();
    } catch (error) {
      console.error('Error starting game:', error);
      Alert.alert('Error', 'Failed to start game');
    }
  };

  const getJoinUrl = () => {
    return joinUrl || '';
  };

  // Connect to socket on mount
  useEffect(() => {
    console.log('Connecting to socket...');
    socketService.connect();

    // Don't disconnect on unmount - socket should stay connected during the game
    // Only disconnect when explicitly needed (e.g., app closes)
  }, []);

  // Join session and listen for updates when gameSession is created
  useEffect(() => {
    if (!gameSession) return;

    console.log('Joining session:', gameSession.id);
    socketService.joinSession(gameSession.id);

    // Listen for game state updates
    const handleGameStateUpdate = (updatedSession: GameSession) => {
      console.log('Received game state update:', updatedSession.participantIds?.length, 'participants');
      setGameSession(updatedSession);
    };

    socketService.on('game_state_update', handleGameStateUpdate);

    return () => {
      socketService.off('game_state_update', handleGameStateUpdate);
    };
  }, [gameSession?.id, setGameSession]);

  if (!selectedPlaylist || !songs || songs.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No playlist or songs available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <KeepAwake />
      <View style={styles.header}>
        <Text style={styles.title}>Game Setup</Text>
        <Text style={styles.subtitle}>{selectedPlaylist.name}</Text>
      </View>

      {!gameSession ? (
        <>
          {/* Game Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Settings</Text>

            <View style={styles.setting}>
              <Text style={styles.settingLabel}>Number of Songs</Text>
              <TextInput
                style={styles.input}
                value={numberOfSongs}
                onChangeText={setNumberOfSongs}
                keyboardType="number-pad"
                placeholder={`1-${songs.length}`}
                placeholderTextColor="#666"
              />
              <Text style={styles.settingHint}>Available: {songs.length} songs</Text>
            </View>

            <View style={styles.setting}>
              <Text style={styles.settingLabel}>Song Duration (seconds)</Text>
              <TextInput
                style={styles.input}
                value={songDuration}
                onChangeText={setSongDuration}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor="#666"
              />
              <Text style={styles.settingHint}>How long to play each song</Text>
            </View>
          </View>

          {/* Create Game Button */}
          <TouchableOpacity
            style={[styles.button, styles.createButton, isCreating && styles.buttonDisabled]}
            onPress={handleCreateGame}
            disabled={isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Game Session</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* QR Code for participants to join */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants Join Here</Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={getJoinUrl()}
                size={200}
                backgroundColor="white"
              />
            </View>
            <Text style={styles.joinUrl}>{getJoinUrl()}</Text>
            <Text style={styles.sessionId}>Session ID: {gameSession.id}</Text>
          </View>

          {/* Participant Count */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participants</Text>
            <Text style={styles.participantCount}>
              {gameSession.participantIds?.length || 0} participant(s) joined
            </Text>
          </View>

          {/* Start Game Button */}
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStartGame}
          >
            <Text style={styles.buttonText}>Start Game</Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => setGameSession(null)}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel & Create New</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  content: {
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#191414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#B3B3B3',
    fontSize: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#B3B3B3',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  setting: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 14,
    color: '#B3B3B3',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  joinUrl: {
    color: '#1DB954',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  sessionId: {
    color: '#B3B3B3',
    fontSize: 12,
    textAlign: 'center',
  },
  participantCount: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: '#1DB954',
  },
  startButton: {
    backgroundColor: '#1DB954',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#B3B3B3',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#B3B3B3',
  },
});
