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
    // Navigate to playlist selection - keep the ended session in store
    // so GameSetupPage will restart it instead of creating a new one
    navigate('/playlists');
  };

  const handleStartFresh = () => {
    // Reset everything and start a completely new session
    useAppStore.getState().reset();
    navigate('/');
  };

  return (
    <div className="results-cinematic" style={styles.container}>
      <div className="winner-flash" />
      <div style={styles.content}>
        <h1 style={styles.appTitle}>Hear and Guess</h1>

        {/* Header with Winner */}
        <div className="glass-card" style={styles.header}>
          <h2 className="cinematic-title" style={styles.headerTitle}>Game Complete!</h2>
          {winner && (
            <div className="winner-pulse" style={styles.winnerBadge}>
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
    backgroundColor: '#0a0a0a',
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
    color: '#1DB954',
    marginBottom: '16px',
    letterSpacing: '-0.5px',
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '24px',
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  headerTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '20px',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  winnerBadge: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderRadius: '0',
    padding: '20px',
    border: '2px solid #1DB954',
    marginTop: '20px',
  },
  winnerLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#1DB954',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    marginBottom: '8px',
    margin: 0,
  },
  winnerName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px',
    margin: 0,
  },
  winnerScore: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1DB954',
    margin: 0,
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#a7a7a7',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  scoresList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    overflow: 'hidden' as const,
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  scoreCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  scoreCardWinner: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderLeft: '4px solid #1DB954',
  },
  rankBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '0',
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    border: '2px solid #1DB954',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
  },
  rankText: {
    fontSize: '20px',
    color: '#ffffff',
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
    color: '#ffffff',
    flex: 1,
    margin: 0,
  },
  scorePoints: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1DB954',
    margin: 0,
  },
  statsSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    padding: '20px',
    textAlign: 'center' as const,
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#1DB954',
    marginBottom: '6px',
    margin: 0,
  },
  statLabel: {
    fontSize: '13px',
    color: '#a7a7a7',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    margin: 0,
  },
  primaryButton: {
    width: '100%',
    borderRadius: '0',
    padding: '16px',
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: '0',
    padding: '16px',
    backgroundColor: 'transparent',
    color: '#a7a7a7',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    marginBottom: '32px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: '100px auto',
  },
  errorText: {
    fontSize: '18px',
    color: '#ff3333',
    margin: 0,
  },
};
