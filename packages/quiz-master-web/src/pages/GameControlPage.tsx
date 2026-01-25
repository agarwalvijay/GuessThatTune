import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { spotifyPlaybackService } from '../services/spotifyPlaybackService';
import { config } from '../config/environment';
import { useWakeLock } from '../hooks/useWakeLock';
import type { Song } from '../store/appStore';

interface RoundData {
  roundIndex: number;
  song: Song;
}

interface BuzzerEvent {
  id: string;
  participantId: string;
  participantName: string;
  elapsedSeconds: number;
  position: number;
}

export function GameControlPage() {
  const navigate = useNavigate();
  const { accessToken, gameSession, setGameSession } = useAppStore();

  const [currentRound, setCurrentRound] = useState<RoundData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buzzerEvents, setBuzzerEvents] = useState<BuzzerEvent[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [isAwarding, setIsAwarding] = useState(false);

  // Keep screen awake during gameplay
  useWakeLock(true);

  useEffect(() => {
    console.log('GameControlPage mounted', { accessToken: !!accessToken, gameSession });

    if (!accessToken || !gameSession) {
      console.error('Missing access token or game session');
      navigate('/');
      return;
    }

    let isSubscribed = true;

    const init = async () => {
      // Initialize socket connection
      socketService.connect();

      // Initialize Spotify player
      await initializePlayer();

      // Set up socket listeners
      setupSocketListeners();

      // Fetch the latest session from the API to get the round data
      try {
        const updatedSession = await apiService.getGameSession(gameSession.id);
        console.log('Fetched updated session:', updatedSession);

        if (isSubscribed) {
          setGameSession(updatedSession);

          // Check if game has already started and set initial round
          if (updatedSession.status === 'playing' && updatedSession.currentRoundIndex >= 0) {
            const round = updatedSession.rounds?.[updatedSession.currentRoundIndex];
            const song = updatedSession.songs?.[updatedSession.currentRoundIndex];

            if (round && song) {
              console.log('Setting initial round from updated session:', { round, song });
              const roundData = {
                roundIndex: updatedSession.currentRoundIndex,
                song: song,
              };
              setCurrentRound(roundData);
              setScores(updatedSession.scores || {});
              setTimeRemaining(updatedSession.settings.songDuration);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching game session:', error);
      }
    };

    init();

    return () => {
      isSubscribed = false;
      spotifyPlaybackService.disconnect();

      // Clean up all socket listeners
      socketService.off('participant_joined');
      socketService.off('participant_left');
      socketService.off('song_started');
      socketService.off('buzzer_event');
      socketService.off('round_ended');
      socketService.off('score_update');
      socketService.off('game_ended');
      socketService.off('game_state_update');

      if (gameSession) {
        socketService.leaveSession(gameSession.id);
      }
    };
  }, []);

  const initializePlayer = async () => {
    if (!accessToken) return;

    try {
      await spotifyPlaybackService.initialize(accessToken);
      console.log('✅ Spotify playback service initialized');
    } catch (error) {
      console.error('Failed to initialize playback service:', error);
      alert('Failed to initialize Spotify playback. Please refresh and try again.');
    }
  };

  // Play song when we have a round
  useEffect(() => {
    if (currentRound && !showAnswer) {
      console.log('Round ready, starting playback');
      playSong(currentRound.song);
      setIsPlaying(true);
    }
  }, [currentRound]);

  const setupSocketListeners = () => {
    if (!gameSession) return;

    console.log('📡 Setting up socket listeners for session:', gameSession.id);

    // Join session room ONCE
    socketService.joinSession(gameSession.id);

    // Listen for participant updates
    socketService.onParticipantJoined((participant) => {
      console.log('✅ Participant joined:', participant);
      const currentSession = useAppStore.getState().gameSession;
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          participants: [...(currentSession.participants || []), participant],
        };
        console.log('Updating session with new participant. Total participants:', updatedSession.participants.length);
        setGameSession(updatedSession);
      }
    });

    socketService.onParticipantLeft((participantId) => {
      console.log('❌ Participant left:', participantId);
      const currentSession = useAppStore.getState().gameSession;
      if (currentSession) {
        setGameSession({
          ...currentSession,
          participants: (currentSession.participants || []).filter(
            (p: { id: string; name: string }) => p.id !== participantId
          ),
        });
      }
    });

    socketService.onRoundStarted((data) => {
      console.log('🎵 Round started event received:', data);

      // Wait a moment for GAME_STATE_UPDATE to arrive and update the session
      setTimeout(() => {
        const currentSession = useAppStore.getState().gameSession;

        if (currentSession) {
          console.log('Current round index after update:', currentSession.currentRoundIndex);
          const round = currentSession.rounds?.[currentSession.currentRoundIndex];
          const song = currentSession.songs?.[currentSession.currentRoundIndex];

          if (round && song) {
            console.log('Setting up round:', currentSession.currentRoundIndex + 1, 'Song:', song.answer?.title || song.title);
            setCurrentRound({
              roundIndex: currentSession.currentRoundIndex,
              song: song,
            });
            // Don't call playSong here - the useEffect watching currentRound will do it
          } else {
            console.error('Round or song not found for index:', currentSession.currentRoundIndex);
          }
        }
      }, 100); // Small delay to let GAME_STATE_UPDATE arrive first

      // Reset UI state for new round immediately
      setShowAnswer(false);
      setBuzzerEvents([]);
      setElapsedSeconds(0);
      setIsPlaying(true);
      setTimeRemaining(data.duration);
    });

    socketService.on('buzzer_event', (data: { buzzerEvent: BuzzerEvent; position: number }) => {
      console.log('🔔 Buzzer event received:', data.buzzerEvent.participantName);
      setBuzzerEvents((prev) => [...prev, { ...data.buzzerEvent, position: data.position }]);
    });

    socketService.onRoundEnded((data) => {
      console.log('Round ended:', data);
      setShowAnswer(true);
      setIsPlaying(false);

      // Pause playback
      spotifyPlaybackService.pause();
    });

    socketService.onScoreUpdate((data) => {
      console.log('Score update:', data);
      setScores(data.scores);
    });

    socketService.onGameEnded((data) => {
      console.log('Game ended:', data);
      // Navigate to results page to show final scores
      navigate('/results');
    });

    socketService.onSessionUpdate((data) => {
      console.log('📡 Session update received. CurrentRoundIndex:', data.session.currentRoundIndex);
      console.log('Session status:', data.session.status);
      setGameSession(data.session);
    });
  };

  const playSong = async (song: any) => {
    try {
      // Random start position (avoiding the very end of the song)
      const durationMs = song.durationMs || (song.metadata?.duration * 1000) || 180000;
      const maxStart = Math.max(0, durationMs - 30000);
      const startPosition = Math.floor(Math.random() * maxStart);

      const uri = song.spotifyUri;
      const title = song.title || song.metadata?.title || 'Unknown';
      const artist = song.artist || song.metadata?.artist || 'Unknown';

      console.log(`🎵 Playing: ${title} by ${artist}`);
      await spotifyPlaybackService.playSong(uri, startPosition);
    } catch (error: any) {
      console.error('Error playing song:', error);
      const errorMessage = error.message || 'Failed to play song';
      if (errorMessage.includes('No Spotify devices found')) {
        alert('Please open Spotify on your phone or computer first, then try again.');
      }
    }
  };

  const handleAwardPoints = async (participantId: string, participantName: string) => {
    if (!currentRound || !gameSession) return;

    try {
      setIsAwarding(true);
      console.log('🏆 Awarding points to:', participantName);

      const roundId = gameSession.rounds?.[currentRound.roundIndex]?.id;
      if (!roundId) {
        console.error('No round ID found');
        return;
      }

      await apiService.awardPoints(gameSession.id, roundId, participantId);
    } catch (error) {
      console.error('Error awarding points:', error);
      alert('Failed to award points');
    } finally {
      setIsAwarding(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      await spotifyPlaybackService.pause();
      setIsPlaying(false);
    } else {
      await spotifyPlaybackService.resume();
      setIsPlaying(true);
    }
  };

  const handleStop = async () => {
    await spotifyPlaybackService.pause();
    setIsPlaying(false);
    setElapsedSeconds(0);
    setTimeRemaining(gameSession?.settings.songDuration || 30);
  };

  const handleNextRound = async () => {
    if (!gameSession) return;

    try {
      console.log('⏭️ Moving to next round. Current index:', gameSession.currentRoundIndex);

      // Stop current audio
      await spotifyPlaybackService.pause();
      setIsPlaying(false);

      const result = await apiService.nextRound(gameSession.id);
      console.log('Next round result:', result);

      if (result.gameComplete) {
        console.log('Game complete! Navigating to results');
        // Update session state to 'ended' before navigating
        if (result.session) {
          console.log('Updating session status to:', result.session.status);
          setGameSession(result.session);
        }
        // Navigate to results
        navigate('/results');
      } else {
        // Update session immediately from API response to avoid race condition
        // where GAME_STATE_UPDATE socket event arrives after the 100ms timeout
        if (result.session) {
          setGameSession(result.session);
        }
        console.log('Waiting for SONG_STARTED event for next round...');
        // Clear buzzer events for new round
        setBuzzerEvents([]);
        setShowAnswer(false);
      }
    } catch (error) {
      console.error('Error advancing to next round:', error);
      alert('Failed to advance to next round');
    }
  };

  const handleEndGame = async () => {
    if (!gameSession) return;

    if (!confirm('Are you sure you want to end the game?')) {
      return;
    }

    try {
      // Stop playback before ending the game
      await spotifyPlaybackService.pause();
      const result = await apiService.endGameSession(gameSession.id);
      // Update session state to 'ended' before navigating
      if (result && result.session) {
        console.log('Updating session status to:', result.session.status);
        setGameSession(result.session);
      }
      // Navigate to results page to show final scores
      navigate('/results');
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  // Timer countdown and elapsed time
  useEffect(() => {
    if (!isPlaying || !gameSession || timeRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const newValue = prev - 0.1;
        if (newValue <= 0) {
          // Time's up - stop playing
          setIsPlaying(false);
          spotifyPlaybackService.pause();
          console.log('⏱️ Timer reached 0, stopping playback');
          return 0;
        }
        return newValue;
      });
      setElapsedSeconds((prev) => prev + 0.1);
    }, 100);

    return () => clearInterval(timer);
  }, [isPlaying, gameSession]); // timeRemaining is NOT in dependencies to avoid recreating interval

  if (!gameSession || !currentRound) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <p style={styles.loadingText}>Waiting for game to start...</p>
        </div>
      </div>
    );
  }

  const songNumber = currentRound.roundIndex + 1;
  const totalSongs = gameSession.settings.numberOfSongs;
  const currentSong = currentRound.song;
  const duration = gameSession.settings.songDuration;
  const progress = Math.min(elapsedSeconds / duration, 1);
  const winnerId = gameSession.rounds?.[currentRound.roundIndex]?.winnerId;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Guess That Tune!" style={styles.headerLogo} />
          <h1 style={styles.appTitle}>Guess That Tune!</h1>
        </div>

        {/* Two Column Layout: Buzzer Events & Scores */}
        <div style={styles.twoColumnContainer}>
          {/* Left Column: Who Buzzed In */}
          <div style={styles.column}>
            <h2 style={styles.sectionTitle}>Who Buzzed In</h2>
            <div style={styles.buzzerListContainer}>
              {gameSession.participants && gameSession.participants.length > 0 ? (
                (() => {
                  // Create a map of buzzer events for quick lookup
                  const buzzerMap = new Map(
                    buzzerEvents.map((event) => [
                      event.participantId,
                      { time: event.elapsedSeconds, position: event.position },
                    ])
                  );

                  // Sort participants: buzzed players first (by buzz position), then others
                  const sortedParticipants = [...gameSession.participants].sort((a, b) => {
                    const aBuzzed = buzzerMap.has(a.id);
                    const bBuzzed = buzzerMap.has(b.id);

                    if (aBuzzed && !bBuzzed) return -1;
                    if (!aBuzzed && bBuzzed) return 1;

                    if (aBuzzed && bBuzzed) {
                      // Both buzzed - sort by position (earlier buzz first)
                      return buzzerMap.get(a.id)!.position - buzzerMap.get(b.id)!.position;
                    }

                    // Neither buzzed - keep original order
                    return 0;
                  });

                  return sortedParticipants.map((participant) => {
                    const buzzerData = buzzerMap.get(participant.id);
                    const hasBuzzed = buzzerData != null;

                    return (
                      <button
                        key={participant.id}
                        style={{
                          ...styles.buzzerCard,
                          ...(hasBuzzed ? {} : styles.buzzerCardInactive),
                          ...(winnerId === participant.id ? styles.buzzerCardWinner : {}),
                        }}
                        onClick={() => hasBuzzed && handleAwardPoints(participant.id, participant.name)}
                        disabled={!hasBuzzed || isAwarding || winnerId != null}
                      >
                        <div style={styles.buzzerInfo}>
                          <p style={{
                            ...styles.buzzerName,
                            ...(hasBuzzed ? {} : styles.buzzerNameInactive),
                          }}>
                            {participant.name}
                          </p>
                          {hasBuzzed && (
                            <p style={styles.buzzerTime}>🔔 {buzzerData.time.toFixed(2)}s</p>
                          )}
                        </div>
                        {winnerId === participant.id && (
                          <span style={styles.winnerBadge}>✓ Correct</span>
                        )}
                      </button>
                    );
                  });
                })()
              ) : (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No participants yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Scores */}
          <div style={styles.column}>
            <h2 style={styles.sectionTitle}>Scores</h2>
            <div style={styles.scoresList}>
              {gameSession.participants && gameSession.participants.length > 0 ? (
                [...gameSession.participants]
                  .sort((a, b) => {
                    const aScore = scores[a.id] || 0;
                    const bScore = scores[b.id] || 0;
                    return bScore - aScore;
                  })
                  .map((participant) => {
                    const score = scores[participant.id] || 0;
                    return (
                      <div key={participant.id} style={styles.scoreCard}>
                        <p style={styles.scoreName}>{participant.name}</p>
                        <p style={styles.scorePoints}>{score} pts</p>
                      </div>
                    );
                  })
              ) : (
                <div style={styles.emptyState}>
                  <p style={styles.emptyText}>No participants yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          <button
            style={styles.nextButton}
            onClick={handleNextRound}
          >
            {songNumber === totalSongs ? 'Finish Game' : 'Next Round'}
          </button>
          <button
            style={styles.endButton}
            onClick={handleEndGame}
          >
            End Game
          </button>
        </div>

        {/* Playback Card */}
        <div style={styles.playbackCard}>
          <div style={styles.cardHeader}>
            <div style={styles.roundBadge}>
              Round {songNumber}/{totalSongs}
            </div>
            <div style={styles.playbackControls}>
              <button
                style={styles.controlButton}
                onClick={handlePlayPause}
                disabled={showAnswer}
              >
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button
                style={styles.controlButton}
                onClick={handleStop}
              >
                ⏹
              </button>
            </div>
          </div>

          <div style={styles.timerSection}>
            <p style={styles.timerText}>
              {elapsedSeconds.toFixed(1)}s / {duration}s
            </p>
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${progress * 100}%`,
                }}
              />
            </div>
          </div>

          <button
            style={styles.revealButton}
            onClick={() => setShowAnswer(!showAnswer)}
          >
            {showAnswer ? 'HIDE' : 'REVEAL'} SONG
          </button>
        </div>

        {/* Song Info Card - Shows when answer is revealed */}
        {showAnswer && currentSong.metadata && (
          <div style={styles.songInfoCard}>
            {currentSong.metadata.imageUrl && (
              <img
                src={currentSong.metadata.imageUrl}
                alt="Album artwork"
                style={styles.albumArtwork}
              />
            )}
            <div style={styles.songDetails}>
              <h3 style={styles.songTitle}>
                {currentSong.answer?.title || currentSong.title || currentSong.metadata.title}
              </h3>
              <p style={styles.songArtist}>
                {currentSong.answer?.artist || currentSong.artist || currentSong.metadata.artist}
              </p>
              <p style={styles.songAlbum}>
                Album: {currentSong.metadata.album}
              </p>
            </div>
          </div>
        )}

        {/* QR Code Section */}
        <div style={styles.section}>
          <button
            style={styles.qrToggle}
            onClick={() => setShowQRCode(!showQRCode)}
          >
            {showQRCode ? '▼' : '▶'} Players Can Join Here
          </button>
          {showQRCode && (
            <div style={styles.qrCodeContainer}>
              <QRCodeSVG
                value={`${config.webAppUrl}/join/${gameSession.id}`}
                size={180}
              />
              <p style={styles.joinUrl}>
                {config.webAppUrl}/join/{gameSession.id}
              </p>
            </div>
          )}
        </div>
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  appTitle: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#667eea',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  headerLogo: {
    height: '40px',
    width: 'auto',
  },
  playbackCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  roundBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  playbackControls: {
    display: 'flex',
    gap: '12px',
  },
  controlButton: {
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    backgroundColor: 'white',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  timerSection: {
    marginBottom: '16px',
  },
  timerText: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  progressBarContainer: {
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '3px',
    overflow: 'hidden' as const,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: '3px',
    transition: 'width 0.1s linear',
  },
  revealButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: '12px 24px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    fontSize: '15px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    cursor: 'pointer',
    width: '100%',
  },
  songInfoCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  albumArtwork: {
    width: '120px',
    height: '120px',
    borderRadius: '12px',
    objectFit: 'cover' as const,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    flexShrink: 0,
  },
  songDetails: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1DB954',
    marginBottom: '8px',
    margin: 0,
  },
  songArtist: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '6px',
    margin: 0,
  },
  songAlbum: {
    fontSize: '15px',
    color: '#666',
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
  qrToggle: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '12px',
    border: '1px solid #f0f0f0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#667eea',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
  },
  qrCodeContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '1px solid #f0f0f0',
  },
  joinUrl: {
    fontSize: '12px',
    color: '#666',
    marginTop: '12px',
    textAlign: 'center' as const,
    wordBreak: 'break-all' as const,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center' as const,
    border: '1px solid #e8e8e8',
  },
  emptyText: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  twoColumnContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '16px',
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  buzzerListContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  buzzerCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #f0f0f0',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
  },
  buzzerCardInactive: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
    cursor: 'default',
  },
  buzzerCardWinner: {
    backgroundColor: '#f0f9f4',
    borderColor: '#34d399',
    borderWidth: '1.5px',
  },
  buzzerInfo: {
    flex: 1,
  },
  buzzerName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '2px',
    margin: 0,
  },
  buzzerNameInactive: {
    color: '#999',
  },
  buzzerTime: {
    fontSize: '13px',
    color: '#f59e0b',
    fontWeight: '600',
    margin: 0,
  },
  winnerBadge: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#10b981',
  },
  scoresList: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden' as const,
    border: '1px solid #f0f0f0',
  },
  scoreCard: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px',
    borderBottom: '1px solid #f5f5f5',
  },
  scoreName: {
    fontSize: '15px',
    color: '#1a1a1a',
    fontWeight: '500',
    margin: 0,
  },
  scorePoints: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#667eea',
    margin: 0,
  },
  controls: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '12px',
    marginBottom: '20px',
  },
  nextButton: {
    flex: 1,
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  endButton: {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'white',
    color: '#ef4444',
    border: '1.5px solid #ef4444',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: '100px auto',
  },
  loadingText: {
    fontSize: '18px',
    color: '#666',
    margin: 0,
  },
};
