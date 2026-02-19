import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { config } from '../config/environment';
import { useWakeLock } from '../hooks/useWakeLock';
import { analyticsService } from '../services/analyticsService';

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
  const [currentGameMode, setCurrentGameMode] = useState<'buzzer' | 'multiple_choice'>(gameSettings.gameMode || 'buzzer');

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
      setParticipants((prev) => {
        const updated = [...prev, participant];
        // Track participant join
        if (gameSession?.id) {
          analyticsService.trackParticipantJoined({
            sessionId: gameSession.id,
            totalParticipants: updated.length,
          });
        }
        return updated;
      });
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
        const songsToPlay = shuffledSongs.slice(0, Math.min(numberOfSongs, shuffledSongs.length));
        session = await apiService.restartGameSession(gameSession.id, songsToPlay);
      } else {
        // Create new game session
        console.log('🆕 Creating new game session');
        console.log('  - Reason:', !gameSession ? 'No existing session' : `Status is '${gameSession.status}' not 'ended'`);
        const songsToPlay = shuffledSongs.slice(0, Math.min(numberOfSongs, shuffledSongs.length));
        session = await apiService.createGameSession({
          hostName,
          playlistId: selectedPlaylist.id,
          playlistName: selectedPlaylist.name,
          songs: songsToPlay,
          settings: {
            gameMode: currentGameMode,
            songDuration,
            numberOfSongs: songsToPlay.length,
            negativePointsPercentage,
          },
        });
      }

      setGameSession(session);

      // Track game creation in analytics
      analyticsService.trackGameCreated({
        numberOfSongs: Math.min(numberOfSongs, shuffledSongs.length),
        songDuration,
        negativePointsPercentage,
        buzzerCountdownSeconds: gameSettings.buzzerCountdownSeconds,
      });

      return session; // Return the session so it can be used immediately
    } catch (err: any) {
      console.error('Error creating game session:', err);
      setError('Failed to create game session. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!gameSession) return;

    try {
      let sessionToStart = gameSession;

      // If game mode changed, recreate the session with new settings
      if (currentGameMode !== gameSession.settings.gameMode) {
        console.log('🔄 Game mode changed, recreating session...');
        const newSession = await createGameSession();
        if (!newSession) {
          console.error('Failed to recreate session');
          return;
        }
        sessionToStart = newSession;
      }

      await apiService.startGameSession(sessionToStart.id);

      // Track game started
      analyticsService.trackGameStarted({
        sessionId: sessionToStart.id,
        numberOfParticipants: participants.length,
        numberOfSongs: sessionToStart.settings.numberOfSongs,
      });

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
        <img src="/logo.png" alt="Hear and Guess" style={styles.logo} />
        <h1 style={styles.title}>Waiting for Players</h1>
        <p style={styles.subtitle}>
          Playlist: <strong>{selectedPlaylist?.name}</strong>
        </p>

        <div style={styles.qrSection}>
          <div style={styles.qrCard}>
            {gameSession && (
              <>
                <QRCodeSVG
                  value={joinUrl}
                  size={250}
                  level="H"
                  imageSettings={{
                    src: "/logo.png",
                    height: 50,
                    width: 50,
                    excavate: true,
                  }}
                />
                <p style={styles.joinUrl}>{joinUrl}</p>
              </>
            )}
          </div>
        </div>

        {/* Game Mode Toggle */}
        <div style={styles.gameModeSection}>
          <label style={styles.gameModeLabel}>Game Mode</label>
          <div style={styles.gameModeButtons}>
            <button
              onClick={() => setCurrentGameMode('multiple_choice')}
              style={{
                ...styles.gameModeButton,
                ...(currentGameMode === 'multiple_choice' ? styles.gameModeButtonActive : {}),
              }}
            >
              📝 Multiple Choice
            </button>
            <button
              onClick={() => setCurrentGameMode('buzzer')}
              style={{
                ...styles.gameModeButton,
                ...(currentGameMode === 'buzzer' ? styles.gameModeButtonActive : {}),
              }}
            >
              🔔 Buzzer
            </button>
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

        <div style={styles.participantsSection}>
          <h2 style={styles.participantsTitle}>
            Participants ({participants.length})
          </h2>
          <div style={styles.participantsList}>
            {participants.map((participant) => (
              <div key={participant.id} style={styles.participantCard}>
                <span style={styles.participantIcon}>👤</span>
                <span style={styles.participantName}>{participant.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    maxWidth: '800px',
    width: '100%',
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
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#a7a7a7',
    textAlign: 'center',
    marginBottom: '32px',
  },
  qrSection: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: '0',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  joinUrl: {
    fontSize: '14px',
    color: '#333',
    textAlign: 'center',
    wordBreak: 'break-all',
  },
  participantsSection: {
    marginBottom: '32px',
  },
  participantsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  participantsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  participantCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
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
    color: '#ffffff',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: '16px',
    color: '#a7a7a7',
    textAlign: 'center',
    padding: '20px',
  },
  gameModeSection: {
    marginBottom: '24px',
    textAlign: 'center',
  },
  gameModeLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  gameModeButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  gameModeButton: {
    flex: '1',
    padding: '12px 16px',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    transition: 'all 0.2s',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    textTransform: 'none' as const,
  },
  gameModeButtonActive: {
    borderColor: '#1DB954',
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    color: '#1DB954',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  button: {
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    flex: 1,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  backButton: {
    backgroundColor: 'transparent',
    color: '#a7a7a7',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: '18px',
    color: '#a7a7a7',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  errorText: {
    fontSize: '18px',
    color: '#ff3333',
  },
};
