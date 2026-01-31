import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { config } from '../config/environment';
import { useWakeLock } from '../hooks/useWakeLock';

export function GameSetupPage() {
  const navigate = useNavigate();
  const {
    accessToken,
    selectedPlaylist,
    gameSession,
    setGameSession,
    gameSettings,
  } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostName] = useState('Quiz Master');
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);

  // Use settings from store
  const { songDuration, numberOfSongs, negativePointsPercentage } = gameSettings;

  // Keep screen awake during game setup
  useWakeLock(true);

  useEffect(() => {
    if (!accessToken || !selectedPlaylist) {
      navigate('/playlists');
      return;
    }

    let sessionId: string | null = null;

    const init = async () => {
      socketService.connect();
      await createGameSession();
    };

    init();

    return () => {
      // Clean up socket listeners
      socketService.off('participant_joined');
      socketService.off('participant_left');
      socketService.off('game_state_update');

      if (sessionId) {
        socketService.leaveSession(sessionId);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameSession) return;

    console.log('Setting up socket listeners for game setup');

    // Join the session room
    socketService.joinSession(gameSession.id);

    // Set up listeners
    socketService.onParticipantJoined((participant) => {
      console.log('Participant joined:', participant);
      setParticipants((prev) => [...prev, participant]);
    });

    socketService.onParticipantLeft((participantId) => {
      console.log('Participant left:', participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    });

    socketService.onSessionUpdate((data) => {
      console.log('Session updated:', data);
      // Only update participants list, don't update the whole session to avoid loops
      if (data.session.participants) {
        setParticipants(data.session.participants);
      }
    });

    // Cleanup function - this is critical!
    return () => {
      socketService.off('participant_joined');
      socketService.off('participant_left');
      socketService.off('game_state_update');
    };
  }, [gameSession?.id]); // Only re-run if session ID changes (which should only happen once)

  const createGameSession = async () => {
    if (!accessToken || !selectedPlaylist) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch songs from the playlist
      const songs = await apiService.fetchPlaylistSongs(selectedPlaylist.id, accessToken);

      if (songs.length === 0) {
        setError('This playlist has no songs with preview URLs');
        return;
      }

      // Shuffle songs randomly to avoid playing in playlist order
      const shuffledSongs = [...songs];
      for (let i = shuffledSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSongs[i], shuffledSongs[j]] = [shuffledSongs[j], shuffledSongs[i]];
      }
      console.log('🔀 Shuffled', shuffledSongs.length, 'songs for random playback');

      let session;
      // Check if there's an existing ended session to restart with same players
      console.log('🎮 Game session check:');
      console.log('  - gameSession exists?', !!gameSession);
      console.log('  - gameSession.id:', gameSession?.id);
      console.log('  - gameSession.status:', gameSession?.status);
      console.log('  - participants:', gameSession?.participantIds?.length || 0);

      if (gameSession && gameSession.status === 'ended') {
        console.log('🔄 Restarting game with same participants');
        console.log('  - Session ID:', gameSession.id);
        console.log('  - Participants to keep:', gameSession.participantIds);
        session = await apiService.restartGameSession(gameSession.id, shuffledSongs);
      } else {
        // Create new game session
        console.log('🆕 Creating new game session');
        console.log('  - Reason:', !gameSession ? 'No existing session' : `Status is '${gameSession.status}' not 'ended'`);
        session = await apiService.createGameSession({
          hostName,
          playlistId: selectedPlaylist.id,
          playlistName: selectedPlaylist.name,
          songs: shuffledSongs,
          settings: {
            songDuration,
            numberOfSongs: Math.min(numberOfSongs, shuffledSongs.length),
            negativePointsPercentage,
          },
        });
      }

      setGameSession(session);
    } catch (err: any) {
      console.error('Error creating game session:', err);
      setError('Failed to create game session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!gameSession) return;

    try {
      await apiService.startGameSession(gameSession.id);
      navigate('/game-control');
    } catch (err) {
      console.error('Error starting game:', err);
      alert('Failed to start game. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/playlists');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <p style={styles.loadingText}>Creating game session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
          <button onClick={handleBack} style={styles.button}>
            Back to Playlists
          </button>
        </div>
      </div>
    );
  }

  const joinUrl = gameSession
    ? `${config.webAppUrl}/join/${gameSession.id}`
    : '';

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <img src="/logo.png" alt="Guess That Tune!" style={styles.logo} />
        <h1 style={styles.title}>Waiting for Players</h1>
        <p style={styles.subtitle}>
          Playlist: <strong>{selectedPlaylist?.name}</strong>
        </p>

        <div style={styles.qrSection}>
          <div style={styles.qrCard}>
            {gameSession && (
              <>
                <QRCodeSVG value={joinUrl} size={250} level="H" />
                <p style={styles.joinUrl}>{joinUrl}</p>
              </>
            )}
          </div>
        </div>

        <div style={styles.participantsSection}>
          <h2 style={styles.participantsTitle}>
            Participants ({participants.length})
          </h2>
          <div style={styles.participantsList}>
            {participants.length === 0 ? (
              <p style={styles.emptyText}>Waiting for participants to join...</p>
            ) : (
              participants.map((participant) => (
                <div key={participant.id} style={styles.participantCard}>
                  <span style={styles.participantIcon}>👤</span>
                  <span style={styles.participantName}>{participant.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={handleBack} style={styles.backButton}>
            Back
          </button>
          <button onClick={handleStartGame} style={styles.button}>
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '800px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  },
  logo: {
    width: '180px',
    height: 'auto',
    margin: '0 auto 20px',
    display: 'block',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '32px',
  },
  qrSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
  },
  qrCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  joinUrl: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  participantsSection: {
    marginBottom: '32px',
  },
  participantsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '16px',
  },
  participantsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  participantCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  participantIcon: {
    fontSize: '20px',
  },
  participantName: {
    fontSize: '16px',
    color: '#333',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: '16px',
    color: '#999',
    textAlign: 'center',
    padding: '20px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
  },
  button: {
    backgroundColor: '#1DB954',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1,
  },
  backButton: {
    backgroundColor: '#666',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: '18px',
    color: '#666',
  },
  errorCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  errorText: {
    fontSize: '18px',
    color: '#e74c3c',
  },
};
