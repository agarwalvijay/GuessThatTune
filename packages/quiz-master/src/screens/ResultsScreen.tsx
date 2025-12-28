import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import KeepAwake from 'react-native-keep-awake';
import { useAppStore } from '../store/appStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Login: undefined;
  PlaylistSelection: undefined;
  GameSetup: undefined;
  GameControl: undefined;
  Results: undefined;
};

type ResultsScreenProps = NativeStackScreenProps<RootStackParamList, 'Results'> & {
  onStartNewGame: () => void;
};

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ navigation, onStartNewGame }) => {
  const gameSession = useAppStore((state) => state.gameSession);

  const handlePlayAgain = () => {
    // Keep the session (with participants) and navigate to playlist selection
    // This allows the quiz master to choose a new playlist while keeping same players
    console.log('🔄 Playing again with same session:', gameSession?.id);
    navigation.navigate('PlaylistSelection');
  };

  if (!gameSession) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No game session found</Text>
      </View>
    );
  }

  // Get final scores sorted by score descending
  const finalScores = gameSession.participants
    ?.map((p) => ({
      id: p.id,
      name: p.name,
      score: gameSession.scores[p.id] || 0,
    }))
    .sort((a, b) => b.score - a.score) || [];

  const winner = finalScores[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <KeepAwake />

      {/* Top spacing */}
      <View style={styles.topSpacer} />

      {/* App Title */}
      <Text style={styles.appTitle}>SongGame</Text>

      {/* Header with Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Game Complete!</Text>
        {winner && (
          <View style={styles.winnerBadge}>
            <Text style={styles.winnerLabel}>Winner</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerScore}>{winner.score} points</Text>
          </View>
        )}
      </LinearGradient>

      {/* Final Scores */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Final Standings</Text>
        <View style={styles.scoresList}>
          {finalScores.map((participant, index) => (
            <View
              key={participant.id}
              style={[
                styles.scoreCard,
                index === 0 && styles.scoreCardWinner,
              ]}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={styles.scoreName}>{participant.name}</Text>
                <Text style={styles.scorePoints}>{participant.score} pts</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Game Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{gameSession.songs.length}</Text>
          <Text style={styles.statLabel}>Songs Played</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{gameSession.participants?.length || 0}</Text>
          <Text style={styles.statLabel}>Participants</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={handlePlayAgain}
      >
        <Text style={styles.buttonText}>Play Again (Same Players)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={onStartNewGame}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Start Fresh Session (New QR Code)</Text>
      </TouchableOpacity>
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
  header: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  winnerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  winnerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  winnerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  winnerScore: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
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
  scoresList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  scoreCardWinner: {
    backgroundColor: '#fff9e6',
    borderLeftWidth: 4,
    borderLeftColor: '#ffd700',
  },
  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
  scoreInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  scorePoints: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#667eea',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ddd',
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
  },
});
