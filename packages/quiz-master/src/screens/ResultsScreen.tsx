import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import { useAppStore } from '../store/appStore';

interface ResultsScreenProps {
  onStartNewGame: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ onStartNewGame }) => {
  const gameSession = useAppStore((state) => state.gameSession);

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Game Complete! 🏆</Text>
        {winner && (
          <Text style={styles.winnerText}>
            Winner: {winner.name} ({winner.score} pts)
          </Text>
        )}
      </View>

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
        style={styles.button}
        onPress={onStartNewGame}
      >
        <Text style={styles.buttonText}>Start New Game</Text>
      </TouchableOpacity>
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
    borderRadius: 16,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  winnerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
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
  scoresList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  scoreCardWinner: {
    backgroundColor: '#fffacd',
  },
  rankBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  rankText: {
    fontSize: 24,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  scorePoints: {
    fontSize: 20,
    fontWeight: '700',
    color: '#667eea',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#667eea',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 40,
  },
});
