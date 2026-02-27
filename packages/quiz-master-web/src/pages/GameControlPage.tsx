import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { spotifyPlaybackService } from '../services/spotifyPlaybackService';
import { config } from '../config/environment';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  playBuzzSound,
  playCorrectSound,
  playIncorrectSound,
  playBeepSound,
  playReactionPopSound,
  playRoundStartSound,
  setSoundIntensity,
  type SoundIntensity,
} from '../utils/soundEffects';
import { analyticsService } from '../services/analyticsService';
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
  score?: number;
  isCorrect?: boolean;
}

interface ReactionEvent {
  id: string;
  emoji: string;
}

interface ReactionSplatter {
  id: string;
  emoji: string;
  left: number;
  top: number;
  rotate: number;
  scale: number;
  sizeVmin: number;
  durationMs: number;
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
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reactionSplatters, setReactionSplatters] = useState<ReactionSplatter[]>([]);
  const [soundIntensityLevel, setSoundIntensityLevel] = useState<SoundIntensity>('medium');

  const [waitingForDevice, setWaitingForDevice] = useState(false);

  // Use ref to track playing state for event handlers
  const isPlayingRef = useRef(false);
  const countdownTimerRef = useRef<number | null>(null);
  const roundSetByApiRef = useRef<number | null>(null);
  const pendingSongRef = useRef<any>(null);
  const devicePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep screen awake during gameplay
  useWakeLock(true);

  // Sync ref with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setSoundIntensity(soundIntensityLevel);
  }, [soundIntensityLevel]);

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
      socketService.off('reaction_event');
      socketService.off('multiple_choice_submitted');
      if (gameSession) {
        socketService.leaveSession(gameSession.id);
      }
    };
  }, []);

  const initializePlayer = async () => {
    if (!accessToken) return;

    try {
      await spotifyPlaybackService.initialize(accessToken);

      // Set the selected device if configured
      const { gameSettings } = useAppStore.getState();
      if (gameSettings.selectedDeviceId) {
        spotifyPlaybackService.setSelectedDevice(gameSettings.selectedDeviceId);
        console.log('✅ Using selected device:', gameSettings.selectedDeviceId);
      }

      console.log('✅ Spotify playback service initialized');
    } catch (error) {
      console.error('Failed to initialize playback service:', error);
      alert('Failed to initialize Spotify playback. Please refresh and try again.');
    }
  };

  const startCountdown = (seconds: number) => {
    // Clear any existing countdown
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    setCountdown(seconds);

    let remaining = seconds;
    countdownTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        setCountdown(remaining);
      } else {
        setCountdown(null);
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        // Play beep sound when countdown ends
        playBeepSound();
      }
    }, 1000);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (devicePollRef.current) clearInterval(devicePollRef.current);
    };
  }, []);

  // Check for a Spotify player then play, or show blocking overlay if none found
  const startRoundWhenReady = async (song: any) => {
    if (!accessToken) return;
    const devices = await apiService.getSpotifyDevices(accessToken);
    if (devices.length > 0) {
      playSong(song);
      setIsPlaying(true);
      return;
    }
    // No device — block and poll
    pendingSongRef.current = song;
    setWaitingForDevice(true);
    if (devicePollRef.current) clearInterval(devicePollRef.current);
    devicePollRef.current = setInterval(async () => {
      const updatedDevices = await apiService.getSpotifyDevices(accessToken);
      if (updatedDevices.length > 0) {
        if (devicePollRef.current) {
          clearInterval(devicePollRef.current);
          devicePollRef.current = null;
        }
        setWaitingForDevice(false);
        if (pendingSongRef.current) {
          playSong(pendingSongRef.current);
          setIsPlaying(true);
          pendingSongRef.current = null;
        }
      }
    }, 5000);
  };

  // Play song when we have a round
  useEffect(() => {
    if (currentRound && !showAnswer) {
      console.log('Round ready, checking for Spotify player');
      startRoundWhenReady(currentRound.song);
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
          // Skip if round was already set directly from API response
          if (roundSetByApiRef.current === currentSession.currentRoundIndex) {
            console.log('⏭️ Round already set from API, skipping socket-based setup');
            return;
          }

          console.log('Current round index after update:', currentSession.currentRoundIndex);
          const round = currentSession.rounds?.[currentSession.currentRoundIndex];
          const song = currentSession.songs?.[currentSession.currentRoundIndex];

          if (round && song) {
            console.log('Setting up round:', currentSession.currentRoundIndex + 1, 'Song:', song.answer?.title || song.title);
            setCurrentRound({
              roundIndex: currentSession.currentRoundIndex,
              song: song,
            });
          } else {
            console.error('Round or song not found for index:', currentSession.currentRoundIndex);
          }
        }
      }, 100); // Small delay to let GAME_STATE_UPDATE arrive first

      // Reset UI state for new round immediately
      setShowAnswer(false);
      setBuzzerEvents([]);
      setCountdown(null);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setElapsedSeconds(0);
      setIsPlaying(true);
      setTimeRemaining(data.duration);
      playRoundStartSound();
    });

    socketService.on('buzzer_event', (data: { buzzerEvent: BuzzerEvent; position: number }) => {
      console.log('🔔 Buzzer event received:', data.buzzerEvent.participantName);
      console.log('🎵 Song is playing:', isPlayingRef.current);
      setBuzzerEvents((prev) => [...prev, { ...data.buzzerEvent, position: data.position }]);

      // Play buzz sound and vibrate only if song is currently playing
      if (isPlayingRef.current) {
        console.log('🔊 Triggering buzz sound and vibration');
        playBuzzSound();

        // Vibrate for haptic feedback (300ms - slightly longer than participant)
        if ('vibrate' in navigator) {
          navigator.vibrate(300);
        }
      } else {
        console.log('⏸️ Song not playing, skipping buzz sound');
      }

      // Pause song playback when someone buzzes in
      console.log('⏸️ Pausing playback');
      spotifyPlaybackService.pause().catch((err: any) => {
        console.error('Error pausing:', err);
      });
      setIsPlaying(false);

      // Start countdown timer
      const { gameSettings } = useAppStore.getState();
      const countdownSeconds = gameSettings.buzzerCountdownSeconds || 3;
      startCountdown(countdownSeconds);
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

      // Sync local state with the current round data from the session
      if (data.session.rounds && data.session.currentRoundIndex >= 0) {
        const currentRoundData = data.session.rounds[data.session.currentRoundIndex];
        if (currentRoundData) {
          if (currentRoundData.buzzerEvents) {
            // Update local buzzerEvents to include isCorrect status from backend
            setBuzzerEvents(currentRoundData.buzzerEvents.map((event, index) => ({
              ...event,
              position: index + 1,
            })));
          }
        }
      }
    });

    socketService.on('reaction_event', (reaction: ReactionEvent) => {
      playReactionPopSound();

      const splatter: ReactionSplatter = {
        id: reaction.id,
        emoji: reaction.emoji,
        left: 6 + Math.random() * 88,
        top: 8 + Math.random() * 82,
        rotate: -35 + Math.random() * 70,
        scale: 0.95 + Math.random() * 0.6,
        sizeVmin: 22 + Math.random() * 26,
        durationMs: 1200 + Math.floor(Math.random() * 700),
      };

      setReactionSplatters((prev) => [...prev.slice(-24), splatter]);
      window.setTimeout(() => {
        setReactionSplatters((prev) => prev.filter((item) => item.id !== splatter.id));
      }, splatter.durationMs);
    });

    socketService.on('multiple_choice_submitted', (data: { answer: { isCorrect: boolean } }) => {
      if (data.answer.isCorrect) {
        playCorrectSound();
      } else {
        playIncorrectSound();
      }
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
    }
  };

  const handleAwardPoints = async (participantId: string, participantName: string) => {
    if (!currentRound || !gameSession) return;

    // Stop countdown immediately
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    try {
      setIsAwarding(true);
      console.log('🏆 Awarding points to:', participantName);

      // Play correct answer sound
      playCorrectSound();

      const roundId = gameSession.rounds?.[currentRound.roundIndex]?.id;
      if (!roundId) {
        console.error('No round ID found');
        return;
      }

      // Find the position of the participant being marked correct
      const correctParticipantEvent = buzzerEvents.find(e => e.participantId === participantId);

      if (correctParticipantEvent) {
        // Mark all participants who buzzed in before this one as incorrect
        const earlierBuzzers = buzzerEvents.filter(e =>
          e.position < correctParticipantEvent.position &&
          e.isCorrect === undefined // Only mark if not already judged
        );

        // Mark all earlier buzzers as incorrect
        for (const event of earlierBuzzers) {
          try {
            await apiService.markIncorrect(gameSession.id, roundId, event.participantId);
            console.log('❌ Auto-marked incorrect:', event.participantName);
          } catch (error) {
            console.error('Error marking incorrect:', event.participantName, error);
          }
        }
      }

      // Now mark the selected participant as correct
      await apiService.awardPoints(gameSession.id, roundId, participantId);
    } catch (error) {
      console.error('Error awarding points:', error);
      alert('Failed to award points');
    } finally {
      setIsAwarding(false);
    }
  };

  const handleMarkIncorrect = async (participantId: string, participantName: string) => {
    if (!currentRound || !gameSession) return;

    // Stop countdown immediately
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    try {
      setIsAwarding(true);
      console.log('❌ Marking incorrect:', participantName);

      // Play incorrect answer sound
      playIncorrectSound();

      const roundId = gameSession.rounds?.[currentRound.roundIndex]?.id;
      if (!roundId) {
        console.error('No round ID found');
        return;
      }

      await apiService.markIncorrect(gameSession.id, roundId, participantId);
    } catch (error) {
      console.error('Error marking incorrect:', error);
      alert('Failed to mark incorrect');
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
        // Update session and start next round directly from API response
        // Don't rely on socket events which can be unreliable on mobile
        if (result.session) {
          setGameSession(result.session);

          // Directly set up the next round from the API response
          const song = result.session.songs?.[result.session.currentRoundIndex];
          if (song) {
            console.log('🎵 Setting up next round directly from API response');
            roundSetByApiRef.current = result.session.currentRoundIndex;
            setCurrentRound({
              roundIndex: result.session.currentRoundIndex,
              song: song,
            });
          }

          // Reset UI state for new round
          setShowAnswer(false);
          setBuzzerEvents([]);
              setElapsedSeconds(0);
          setTimeRemaining(result.session.settings.songDuration);
        }
      }
    } catch (error) {
      console.error('Error advancing to next round:', error);
      alert('Failed to advance to next round');
    }
  };

  const handleEndGame = async (skipConfirm = false) => {
    if (!gameSession) return;

    if (!skipConfirm && !confirm('Are you sure you want to end the game?')) {
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

        // Track game ended
        analyticsService.trackGameEnded({
          sessionId: gameSession.id,
          numberOfParticipants: gameSession.participants?.length || 0,
          numberOfSongs: gameSession.settings.numberOfSongs,
          completedSongs: gameSession.currentRoundIndex + 1,
        });
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
  const soundSliderValue = soundIntensityLevel === 'low' ? 1 : soundIntensityLevel === 'medium' ? 2 : 3;

  return (
    <>
      <style>{`
        @keyframes countdownZoom {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes emojiSplatter {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2) rotate(var(--rot));
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -62%) scale(0.95) rotate(calc(var(--rot) + 10deg));
          }
        }
      `}</style>
      <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Hear and Guess" style={styles.headerLogo} />
          <h1 style={styles.appTitle}>Hear and Guess</h1>
        </div>

        {/* Game Mode Indicator */}
        <div style={styles.gameModeIndicator}>
          Mode: {gameSession?.settings?.gameMode === 'multiple_choice' ? '📝 Multiple Choice' : '🔔 Buzzer'}
        </div>

        {/* Two Column Layout: Buzzer Events/MC Answers & Scores */}
        <div style={styles.twoColumnContainer}>
          {/* Left Column */}
          <div style={styles.column}>
            {gameSession?.settings?.gameMode === 'multiple_choice' ? (
              (() => {
                const currentRoundData = gameSession.rounds?.[currentRound.roundIndex];
                const answers = currentRoundData?.multipleChoiceAnswers || [];
                return (
                  <>
                    <h2 style={styles.sectionTitle}>Answers</h2>
                    <div style={styles.buzzerListContainer}>
                      {answers.length > 0 ? (
                        answers.map((answer) => (
                          <div
                            key={answer.id}
                            style={{
                              padding: '12px',
                              marginBottom: '8px',
                              borderRadius: '0',
                              backgroundColor: answer.isCorrect ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 51, 51, 0.15)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderLeft: answer.isCorrect ? '4px solid #1DB954' : '4px solid #ff3333',
                              border: answer.isCorrect ? '2px solid #1DB954' : '2px solid #ff3333',
                            }}
                          >
                            <span style={{ fontWeight: 'bold', flex: 1, color: '#fff' }}>{answer.participantName}</span>
                            <span style={{ fontSize: '14px', flex: 2, textAlign: 'center', color: '#a7a7a7' }}>
                              {answer.isCorrect || currentRoundData?.isComplete ? answer.selectedAnswer : '---'}
                            </span>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '0',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                backgroundColor: answer.isCorrect ? '#1DB954' : '#ff3333',
                                color: answer.isCorrect ? '#0a0a0a' : '#fff',
                                textTransform: 'uppercase' as const,
                              }}
                            >
                              {answer.isCorrect ? '✓ Correct' : '✗ Wrong'}
                            </span>
                            <span style={{ fontWeight: 'bold', marginLeft: '8px', minWidth: '50px', textAlign: 'right', color: '#fff' }}>
                              {answer.score > 0 ? '+' : ''}{answer.score}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div style={styles.emptyState}>
                          <p style={styles.emptyText}>Waiting for answers...</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <h2 style={styles.sectionTitle}>Who Buzzed In</h2>
                <div style={styles.buzzerListContainer}>
                  {buzzerEvents.length > 0 ? (
                    (() => {
                      const buzzerMap = new Map(
                        buzzerEvents.map((event) => [
                          event.participantId,
                          { time: event.elapsedSeconds, position: event.position },
                        ])
                      );

                      const buzzedParticipants = (gameSession.participants || []).filter((p) =>
                        buzzerMap.has(p.id)
                      );

                      const sortedParticipants = buzzedParticipants.sort((a, b) => {
                        const aPosition = buzzerMap.get(a.id)!.position;
                        const bPosition = buzzerMap.get(b.id)!.position;
                        return aPosition - bPosition;
                      });

                      return sortedParticipants.map((participant) => {
                        const buzzerData = buzzerMap.get(participant.id)!;
                        const buzzerEvent = buzzerEvents.find(e => e.participantId === participant.id);
                        const isCorrect = buzzerEvent?.isCorrect === true;
                        const isIncorrect = buzzerEvent?.isCorrect === false;
                        const hasBeenJudged = winnerId === participant.id || isCorrect || isIncorrect;

                        return (
                          <div
                            key={participant.id}
                            style={{
                              ...styles.buzzerCard,
                              ...(isCorrect ? styles.buzzerCardWinner : {}),
                              ...(isIncorrect ? styles.buzzerCardIncorrect : {}),
                            }}
                          >
                            <div style={styles.buzzerInfo}>
                              <p style={styles.buzzerName}>{participant.name}</p>
                              <p style={styles.buzzerTime}>🔔 {buzzerData.time.toFixed(2)}s</p>
                            </div>
                            {!hasBeenJudged ? (
                              <div style={styles.buzzerActions}>
                                <button
                                  style={styles.correctButton}
                                  onClick={() => handleAwardPoints(participant.id, participant.name)}
                                  disabled={isAwarding}
                                >
                                  ✓
                                </button>
                                <button
                                  style={styles.incorrectButton}
                                  onClick={() => handleMarkIncorrect(participant.id, participant.name)}
                                  disabled={isAwarding}
                                >
                                  ✗
                                </button>
                              </div>
                            ) : (
                              <>
                                {isCorrect && <span style={styles.winnerBadge}>✓ Correct</span>}
                                {isIncorrect && <span style={styles.incorrectBadge}>✗ Wrong</span>}
                              </>
                            )}
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <div style={styles.emptyState}>
                      <p style={styles.emptyText}>No one has buzzed in yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
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
            onClick={() => songNumber === totalSongs ? handleEndGame(true) : handleNextRound()}
          >
            {songNumber === totalSongs ? 'Finish Game' : 'Next Round'}
          </button>
          <button
            style={styles.endButton}
            onClick={() => handleEndGame(false)}
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

        {/* Multiple Choice Options Display */}
        {gameSession?.settings?.gameMode === 'multiple_choice' && (() => {
          const currentRoundData = gameSession.rounds?.[currentRound.roundIndex];
          return currentRoundData && !currentRoundData.isComplete && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Answer Choices</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                {currentRoundData.multipleChoiceOptions?.map((option: string, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      borderRadius: '0',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '2px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{
                      fontWeight: 'bold',
                      fontSize: '18px',
                      color: '#1DB954',
                      minWidth: '24px',
                    }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span style={{ fontSize: '14px', color: '#ffffff' }}>{option}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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

        <div style={styles.soundControlCard}>
          <p style={styles.soundControlLabel}>
            Host Sound Intensity: {soundIntensityLevel.toUpperCase()}
          </p>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={soundSliderValue}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSoundIntensityLevel(val === 1 ? 'low' : val === 2 ? 'medium' : 'high');
            }}
            style={styles.soundControlSlider}
          />
          <div style={styles.soundControlScale}>
            <span>Low</span>
            <span>Med</span>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div style={styles.countdownOverlay} key={countdown}>
          <div style={styles.countdownNumber}>
            {countdown}
          </div>
        </div>
      )}

      <div style={styles.reactionSplatterLayer}>
        {reactionSplatters.map((splatter) => (
          <div
            key={splatter.id}
            style={{
              ...styles.reactionSplatter,
              left: `${splatter.left}%`,
              top: `${splatter.top}%`,
              fontSize: `${splatter.sizeVmin}vmin`,
              transform: `translate(-50%, -50%) scale(${splatter.scale})`,
              animationDuration: `${splatter.durationMs}ms`,
              ['--rot' as any]: `${splatter.rotate}deg`,
            }}
          >
            {splatter.emoji}
          </div>
        ))}
      </div>

      {/* No Spotify Device Overlay */}
      {waitingForDevice && (
        <div style={styles.deviceOverlay}>
          <div style={styles.deviceOverlayCard}>
            <div style={styles.deviceOverlayIcon}>🎵</div>
            <h2 style={styles.deviceOverlayTitle}>No Spotify Player Detected</h2>
            <p style={styles.deviceOverlayText}>
              Open Spotify on your phone, tablet, or computer and play any song
              for a moment to activate it.
            </p>
            <p style={styles.deviceOverlayHint}>
              Checking automatically every 5 seconds — this will unlock as soon as a player is found.
            </p>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    padding: '20px',
    position: 'relative',
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
    color: '#1DB954',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  headerLogo: {
    height: '40px',
    width: 'auto',
  },
  playbackCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '20px',
    marginBottom: '20px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  roundBadge: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    border: '2px solid #1DB954',
    padding: '6px 12px',
    borderRadius: '0',
    fontSize: '13px',
    fontWeight: '700',
    color: '#1DB954',
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
    borderRadius: '0',
    backgroundColor: 'transparent',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#ffffff',
  },
  timerSection: {
    marginBottom: '16px',
  },
  timerText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  progressBarContainer: {
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    overflow: 'hidden' as const,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: '0',
    transition: 'width 0.1s linear',
  },
  revealButton: {
    backgroundColor: 'transparent',
    padding: '12px 24px',
    borderRadius: '0',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    cursor: 'pointer',
    width: '100%',
  },
  songInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '20px',
    marginBottom: '20px',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  albumArtwork: {
    width: '120px',
    height: '120px',
    borderRadius: '0',
    objectFit: 'cover' as const,
    border: '2px solid rgba(255, 255, 255, 0.1)',
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
    color: '#ffffff',
    marginBottom: '6px',
    margin: 0,
  },
  songAlbum: {
    fontSize: '15px',
    color: '#a7a7a7',
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
  qrToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    padding: '14px',
    marginBottom: '12px',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    fontSize: '15px',
    fontWeight: '600',
    color: '#1DB954',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    textTransform: 'none' as const,
  },
  qrCodeContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '0',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  joinUrl: {
    fontSize: '12px',
    color: '#333',
    marginTop: '12px',
    textAlign: 'center' as const,
    wordBreak: 'break-all' as const,
  },
  emptyState: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    padding: '32px',
    textAlign: 'center' as const,
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  emptyText: {
    fontSize: '14px',
    color: '#a7a7a7',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderLeft: '4px solid rgba(255, 255, 255, 0.2)',
    textAlign: 'left' as const,
    width: '100%',
  },
  buzzerCardInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.6,
    cursor: 'default',
  },
  buzzerCardWinner: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderColor: '#1DB954',
    borderLeftColor: '#1DB954',
    borderWidth: '2px',
    borderLeftWidth: '4px',
  },
  buzzerCardIncorrect: {
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    borderColor: '#ff3333',
    borderLeftColor: '#ff3333',
    borderWidth: '2px',
    borderLeftWidth: '4px',
  },
  buzzerInfo: {
    flex: 1,
  },
  buzzerName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '2px',
    margin: 0,
  },
  buzzerNameInactive: {
    color: '#a7a7a7',
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
    color: '#1DB954',
  },
  incorrectBadge: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ff3333',
  },
  buzzerActions: {
    display: 'flex',
    gap: '8px',
  },
  correctButton: {
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '8px 16px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  incorrectButton: {
    backgroundColor: '#ff3333',
    color: '#ffffff',
    border: '2px solid #ff3333',
    borderRadius: '0',
    padding: '8px 16px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  scoresList: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '0',
    overflow: 'hidden' as const,
    border: '2px solid rgba(255, 255, 255, 0.1)',
  },
  scoreCard: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  },
  scoreName: {
    fontSize: '15px',
    color: '#ffffff',
    fontWeight: '500',
    margin: 0,
  },
  scorePoints: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1DB954',
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
    borderRadius: '0',
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  endButton: {
    padding: '16px',
    borderRadius: '0',
    backgroundColor: 'transparent',
    color: '#ff3333',
    border: '2px solid #ff3333',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    margin: '100px auto',
  },
  loadingText: {
    fontSize: '18px',
    color: '#a7a7a7',
    margin: 0,
  },
  countdownOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
    pointerEvents: 'none' as const,
  },
  countdownNumber: {
    fontSize: '350px',
    fontWeight: '900',
    color: '#1DB954',
    textShadow: '0 0 60px rgba(29, 185, 84, 0.5)',
    animation: 'countdownZoom 1s ease-out',
    userSelect: 'none' as const,
  },
  reactionSplatterLayer: {
    position: 'fixed' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    zIndex: 9000,
  },
  reactionSplatter: {
    position: 'absolute' as const,
    lineHeight: 1,
    filter: 'drop-shadow(0 8px 22px rgba(0, 0, 0, 0.75))',
    opacity: 0.96,
    animationName: 'emojiSplatter',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'forwards' as const,
    userSelect: 'none' as const,
  },
  gameModeIndicator: {
    fontSize: '14px',
    color: '#a7a7a7',
    marginBottom: '8px',
    fontWeight: '500',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  soundControlCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    padding: '12px 14px',
    marginBottom: '16px',
  },
  soundControlLabel: {
    margin: '0 0 8px 0',
    color: '#a7a7a7',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  soundControlSlider: {
    width: '100%',
    accentColor: '#1DB954',
    cursor: 'pointer',
    minHeight: '32px',
  },
  soundControlScale: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#7f7f7f',
    fontSize: '11px',
    marginTop: '2px',
    textTransform: 'uppercase' as const,
  },
  deviceOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
  },
  deviceOverlayCard: {
    backgroundColor: '#141414',
    border: '2px solid rgba(255, 165, 0, 0.6)',
    borderRadius: '0',
    padding: '48px 40px',
    maxWidth: '480px',
    width: '90%',
    textAlign: 'center' as const,
    boxShadow: '0 0 60px rgba(255, 165, 0, 0.15)',
  },
  deviceOverlayIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  deviceOverlayTitle: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#ffa500',
    marginBottom: '16px',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
    margin: '0 0 16px 0',
  },
  deviceOverlayText: {
    fontSize: '16px',
    color: '#ffffff',
    lineHeight: '1.6',
    margin: '0 0 20px 0',
  },
  deviceOverlayHint: {
    fontSize: '13px',
    color: '#a7a7a7',
    margin: 0,
    fontStyle: 'italic' as const,
  },
};
