import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useWakeLock } from '../hooks/useWakeLock';

export function ResultsPage() {
  const navigate = useNavigate();
  const { gameSession } = useAppStore();

  // Keep screen awake during results
  useWakeLock(true);

  useEffect(() => {
    if (!gameSession) {
      navigate('/playlists');
    }
  }, [gameSession, navigate]);

  if (!gameSession) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={styles.errorText}>No game session found</p>
        </div>
      </div>
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

  const handlePlayAgain = () => {
    navigate('/playlists');
  };

  const handleStartFresh = () => {
    useAppStore.getState().reset();
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.appTitle}>SongGame</h1>

        {/* Header with Winner */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Game Complete!</h2>
          {winner && (
            <div style={styles.winnerBadge}>
              <p style={styles.winnerLabel}>WINNER</p>
              <p style={styles.winnerName}>{winner.name}</p>
              <p style={styles.winnerScore}>{winner.score} points</p>
            </div>
          )}
        </div>

        {/* Final Standings */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Final Standings</h2>
          <div style={styles.scoresList}>
            {finalScores.map((participant, index) => (
              <div
                key={participant.id}
                style={{
                  ...styles.scoreCard,
                  ...(index === 0 ? styles.scoreCardWinner : {}),
                }}
              >
                <div style={styles.rankBadge}>
                  <span style={styles.rankText}>
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `#${index + 1}`}
                  </span>
                </div>
                <div style={styles.scoreInfo}>
                  <p style={styles.scoreName}>{participant.name}</p>
                  <p style={styles.scorePoints}>{participant.score} pts</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Game Stats */}
        <div style={styles.statsSection}>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{gameSession.settings.numberOfSongs}</p>
            <p style={styles.statLabel}>Songs Played</p>
          </div>
          <div style={styles.statCard}>
            <p style={styles.statValue}>{gameSession.participants?.length || 0}</p>
            <p style={styles.statLabel}>Participants</p>
          </div>
        </div>

        {/* Actions */}
        <button
          style={styles.primaryButton}
          onClick={handlePlayAgain}
        >
          Play Again (Same Players)
        </button>

        <button
          style={styles.secondaryButton}
          onClick={handleStartFresh}
        >
          Start Fresh Session (New QR Code)
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    paddingBottom: '32px',
  },
  appTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#667eea',
    marginBottom: '16px',
    letterSpacing: '-0.5px',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '20px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
  },
  headerTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: 'white',
    marginBottom: '20px',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  winnerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '16px',
    padding: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    marginTop: '20px',
  },
  winnerLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '8px',
    margin: 0,
  },
  winnerName: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'white',
    marginBottom: '4px',
    margin: 0,
  },
  winnerScore: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    margin: 0,
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  scoresList: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden' as const,
    border: '1px solid #f0f0f0',
  },
  scoreCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px',
    borderBottom: '1px solid #f5f5f5',
  },
  scoreCardWinner: {
    backgroundColor: '#fff9e6',
    borderLeft: '4px solid #ffd700',
  },
  rankBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '22px',
    backgroundColor: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
  },
  rankText: {
    fontSize: '20px',
    color: 'white',
    fontWeight: '700',
  },
  scoreInfo: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    margin: 0,
  },
  scorePoints: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#667eea',
    margin: 0,
  },
  statsSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'center' as const,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
    border: '1px solid #f0f0f0',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#667eea',
    marginBottom: '6px',
    margin: 0,
  },
  statLabel: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    margin: 0,
  },
  primaryButton: {
    width: '100%',
    borderRadius: '12px',
    padding: '16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 8px rgba(102, 126, 234, 0.3)',
    marginTop: '8px',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: '12px',
    padding: '16px',
    backgroundColor: 'transparent',
    color: '#666',
    border: '2px solid #ddd',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    marginBottom: '32px',
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: '100px auto',
  },
  errorText: {
    fontSize: '18px',
    color: '#ef4444',
    margin: 0,
  },
};
