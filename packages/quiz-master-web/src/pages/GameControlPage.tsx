import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { spotifyPlaybackService } from '../services/spotifyPlaybackService';
import { config } from '../config/environment';
import { useWakeLock } from '../hooks/useWakeLock';
import { playBuzzSound, playCorrectSound, playIncorrectSound, playBeepSound } from '../utils/soundEffects';
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
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  const [firstRoundSongLoaded, setFirstRoundSongLoaded] = useState(false);
  const [loadingDots, setLoadingDots] = useState(1);
  const [showPlaybackConflictWarning, setShowPlaybackConflictWarning] = useState(false);
  const [conflictingDeviceName, setConflictingDeviceName] = useState<string>('');
  const [showDeviceTakenOverWarning, setShowDeviceTakenOverWarning] = useState(false);

  // Use ref to track playing state for event handlers
  const isPlayingRef = useRef(false);
  const countdownTimerRef = useRef<number | null>(null);
  const currentRoundIndexRef = useRef<number>(-1);

  // Keep screen awake during gameplay
  useWakeLock(true);

  // Sync refs with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentRoundIndexRef.current = currentRound?.roundIndex ?? -1;
  }, [currentRound]);

  // Listen for device taken over event
  useEffect(() => {
    spotifyPlaybackService.onDeviceTakenOver(() => {
      console.log('⚠️ Device taken over detected in GameControlPage');
      setShowDeviceTakenOverWarning(true);
      // Pause playback since we no longer control it
      setIsPlaying(false);
    });

    return () => {
      spotifyPlaybackService.clearDeviceTakenOverCallback();
    };
  }, []);

  useEffect(() => {
    console.log('GameControlPage mounted', { accessToken: !!accessToken, gameSession });

    if (!accessToken || !gameSession) {
      console.log('⚠️ Missing access token or game session - redirecting to login');
      navigate('/');
      return;
    }

    let isSubscribed = true;

    const init = async () => {
      // Initialize socket connection
      socketService.connect();

      // Check for playback conflicts BEFORE initializing player
      const hasConflict = await checkForPlaybackConflict();
      if (hasConflict) {
        // Warning modal is shown, wait for user decision
        // Don't initialize player yet - will be done if user chooses "Take Over"
        return;
      }

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

      // Note: Don't disconnect player here - keep it alive for next game
      // Only disconnect when user logs out or navigates to playlist selection
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

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Play song when we have a round
  useEffect(() => {
    if (currentRound && !showAnswer) {
      console.log('Round ready, starting playback');
      const isFirstRound = currentRound.roundIndex === 0;

      if (isFirstRound) {
        // First round: Load song with auto-pause (user will click START to resume)
        console.log('🎵 First round - loading song. User must click START.');
        setIsPlaying(false);
        setShowStartOverlay(true);
        setFirstRoundSongLoaded(false);

        // Mute before loading to prevent audio during pause loop
        spotifyPlaybackService.setVolume(0);

        // Load song and mark as loaded when complete
        playSong(currentRound.song).then(() => {
          setFirstRoundSongLoaded(true);
          console.log('✅ First round song loaded, START button enabled');
        });
      } else {
        // Subsequent rounds: auto-play (audio already unlocked from first round)
        playSong(currentRound.song);
        setIsPlaying(true);
      }
    }
  }, [currentRound]);

  // Continuous pause loop for first round - keeps pausing until user clicks START
  useEffect(() => {
    if (!showStartOverlay) return;

    console.log('⏸️ Starting continuous pause loop for first round');

    // Start pausing at 100ms and continue every 100ms
    const pauseInterval = setInterval(() => {
      spotifyPlaybackService.pause();
    }, 100);

    // Cleanup: stop pausing when overlay is hidden (user clicked START)
    return () => {
      console.log('⏸️ Stopping continuous pause loop');
      clearInterval(pauseInterval);
    };
  }, [showStartOverlay]);

  // Animate loading dots (1 -> 2 -> 3 -> 4 -> 1)
  useEffect(() => {
    // Animate dots when: no currentRound OR (showStartOverlay && !firstRoundSongLoaded)
    const shouldAnimate = !currentRound || (showStartOverlay && !firstRoundSongLoaded);
    if (!shouldAnimate) return;

    const dotsInterval = setInterval(() => {
      setLoadingDots((prev) => (prev % 4) + 1);
    }, 400);

    return () => clearInterval(dotsInterval);
  }, [currentRound, showStartOverlay, firstRoundSongLoaded]);

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

          // Check if this round is already set (e.g., from handleNextRound API call)
          // Use ref to avoid stale closure value
          if (currentRoundIndexRef.current === currentSession.currentRoundIndex) {
            console.log('⏭️ Round already set from API, skipping socket-based setup');
            return;
          }

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
      setCountdown(null);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setElapsedSeconds(0);
      setIsPlaying(true);
      setTimeRemaining(data.duration);
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

      // Sync local buzzerEvents with the current round's buzzer events from the session
      if (data.session.rounds && data.session.currentRoundIndex >= 0) {
        const currentRoundData = data.session.rounds[data.session.currentRoundIndex];
        if (currentRoundData && currentRoundData.buzzerEvents) {
          // Update local buzzerEvents to include isCorrect status from backend
          setBuzzerEvents(currentRoundData.buzzerEvents.map((event, index) => ({
            ...event,
            position: index + 1,
          })));
        }
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

      // For autoPause, the continuous pause loop in useEffect will handle it
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

  const checkForPlaybackConflict = async (): Promise<boolean> => {
    if (!accessToken) {
      console.log('🔍 Conflict check: No access token');
      return false;
    }

    try {
      console.log('🔍 Checking for playback conflicts...');
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.log('🔍 Conflict check: API request failed', response.status);
        return false;
      }

      const data = await response.json();
      const devices = data.devices || [];

      // Get our device ID
      const ourDeviceId = (spotifyPlaybackService as any).deviceId;

      console.log('🔍 Our device ID:', ourDeviceId);
      console.log('🔍 All devices:', devices.map((d: any) => ({
        id: d.id,
        name: d.name,
        is_active: d.is_active,
        type: d.type,
      })));

      // Check for conflicts in two ways:
      // 1. Any OTHER device is currently active/playing
      const activeConflict = devices.find((d: any) =>
        d.id !== ourDeviceId && d.is_active
      );

      // 2. Multiple "Hear and Guess" devices exist (indicates multiple game sessions)
      const hearAndGuessDevices = devices.filter((d: any) =>
        d.name && d.name.toLowerCase().includes('hear and guess')
      );
      const multipleSessionsConflict = hearAndGuessDevices.length > 1 &&
        hearAndGuessDevices.some((d: any) => d.id !== ourDeviceId);

      const conflictingDevice = activeConflict ||
        (multipleSessionsConflict ? hearAndGuessDevices.find((d: any) => d.id !== ourDeviceId) : null);

      if (conflictingDevice) {
        console.log('⚠️ CONFLICT DETECTED:', conflictingDevice.name);
        console.log('Active conflict:', !!activeConflict, 'Multiple sessions:', multipleSessionsConflict);
        setConflictingDeviceName(conflictingDevice.name);
        setShowPlaybackConflictWarning(true);
        return true;
      }

      console.log('✅ No conflicts found');
      return false;
    } catch (error) {
      console.error('❌ Error checking for playback conflicts:', error);
      return false;
    }
  };

  const handleTakeOverPlayback = async () => {
    setShowPlaybackConflictWarning(false);

    // Initialize player and continue with setup
    await initializePlayer();

    // Set up socket listeners
    setupSocketListeners();

    // Fetch session data and set up initial round if game already started
    try {
      const updatedSession = await apiService.getGameSession(gameSession!.id);
      console.log('Fetched updated session after taking over:', updatedSession);
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
    } catch (error) {
      console.error('Error fetching session:', error);
      alert('Failed to load game session. Please refresh and try again.');
    }
  };

  const handleCancelPlayback = () => {
    setShowPlaybackConflictWarning(false);
    alert('Game cancelled. Please stop the other game first, then refresh this page.');
    navigate('/playlists');
  };

  const handleTakeBackControl = async () => {
    setShowDeviceTakenOverWarning(false);
    console.log('🔄 Taking back control of playback...');

    try {
      // Reset and reinitialize the player
      spotifyPlaybackService.reset();
      await initializePlayer();

      // Resume the current round if there is one
      if (currentRound) {
        console.log('▶️ Resuming playback after taking back control');
        await playSong(currentRound.song);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error taking back control:', error);
      alert('Failed to take back control. Please refresh the page.');
    }
  };

  const handleEndAfterTakeover = async () => {
    setShowDeviceTakenOverWarning(false);
    await handleEndGame(true); // Skip confirmation since user already chose to end
  };

  const handleStartFirstRound = async () => {
    // Hide overlay
    setShowStartOverlay(false);
    setIsPlaying(true);

    // Set volume to 50%
    await spotifyPlaybackService.setVolume(50);

    // Resume playback using direct player method (iOS audio unlock via user gesture)
    await spotifyPlaybackService.resume();
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
      // Stop playback (keep player connected for next game)
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
    // Show game UI with START overlay in loading state
    // This eliminates the "Waiting for game to start" intermediate screen
    return (
      <>
        <style>{`
          @keyframes logoZoom {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
        `}</style>
        <div style={styles.container}>
        {/* Playback Conflict Warning Modal (shown even in loading state) */}
        {showPlaybackConflictWarning && (
          <div style={styles.modalOverlay}>
            <div style={styles.conflictModal}>
              <h2 style={styles.modalTitle}>⚠️ Playback Conflict</h2>
              <p style={styles.modalText}>
                Another device is already playing music on your Spotify account:
              </p>
              <p style={styles.deviceName}>"{conflictingDeviceName}"</p>
              <p style={styles.modalText}>
                Only one game can be active at a time. Would you like to take over playback?
              </p>
              <div style={styles.modalActions}>
                <button onClick={handleCancelPlayback} style={styles.cancelButton}>
                  Cancel
                </button>
                <button onClick={handleTakeOverPlayback} style={styles.takeOverButton}>
                  Take Over Playback
                </button>
              </div>
            </div>
          </div>
        )}

        {!showPlaybackConflictWarning && (
          <div style={styles.startOverlay}>
            <div style={styles.startButton}>
              <img src="/logo.png" alt="Hear and Guess" style={styles.loadingLogo} />
              <div style={styles.startText}>LOADING{'.'.repeat(loadingDots)}</div>
            </div>
          </div>
        )}
        <div style={styles.content}>
          <div style={styles.header}>
            <img src="/logo.png" alt="Hear and Guess" style={styles.headerLogo} />
            <h1 style={styles.appTitle}>Hear and Guess</h1>
          </div>
        </div>
      </div>
      </>
    );
  }

  const songNumber = currentRound.roundIndex + 1;
  const totalSongs = gameSession.settings.numberOfSongs;
  const currentSong = currentRound.song;
  const duration = gameSession.settings.songDuration;
  const progress = Math.min(elapsedSeconds / duration, 1);
  const winnerId = gameSession.rounds?.[currentRound.roundIndex]?.winnerId;

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
        @keyframes logoZoom {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
      <div style={styles.container}>
        {/* START Overlay for first round (iOS audio unlock) */}
        {showStartOverlay && !showPlaybackConflictWarning && (
          <div
            style={styles.startOverlay}
            onClick={firstRoundSongLoaded ? handleStartFirstRound : undefined}
          >
            <div style={styles.startButton}>
              {firstRoundSongLoaded ? (
                <>
                  <div style={styles.playTriangle}>▶</div>
                  <div style={styles.startText}>TAP TO START</div>
                </>
              ) : (
                <>
                  <img src="/logo.png" alt="Hear and Guess" style={styles.loadingLogo} />
                  <div style={styles.startText}>LOADING{'.'.repeat(loadingDots)}</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Playback Conflict Warning Modal */}
        {showPlaybackConflictWarning && (
          <div style={styles.modalOverlay}>
            <div style={styles.conflictModal}>
              <h2 style={styles.modalTitle}>⚠️ Playback Conflict</h2>
              <p style={styles.modalText}>
                Another device is already playing music on your Spotify account:
              </p>
              <p style={styles.deviceName}>"{conflictingDeviceName}"</p>
              <p style={styles.modalText}>
                Only one game can be active at a time. Would you like to take over playback?
              </p>
              <div style={styles.modalActions}>
                <button onClick={handleCancelPlayback} style={styles.cancelButton}>
                  Cancel
                </button>
                <button onClick={handleTakeOverPlayback} style={styles.takeOverButton}>
                  Take Over Playback
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Device Taken Over Warning Modal */}
        {showDeviceTakenOverWarning && (
          <div style={styles.modalOverlay}>
            <div style={styles.conflictModal}>
              <h2 style={styles.modalTitle}>⚠️ Playback Taken Over</h2>
              <p style={styles.modalText}>
                Another device has taken control of playback on your Spotify account.
              </p>
              <p style={styles.modalText}>
                This usually happens when you start another game session on a different device.
              </p>
              <p style={styles.modalText}>
                Would you like to take back control, or end this game?
              </p>
              <div style={styles.modalActions}>
                <button onClick={handleEndAfterTakeover} style={styles.cancelButton}>
                  End Game
                </button>
                <button onClick={handleTakeBackControl} style={styles.takeOverButton}>
                  Take Back Control
                </button>
              </div>
            </div>
          </div>
        )}

      <div style={styles.content}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Hear and Guess" style={styles.headerLogo} />
          <h1 style={styles.appTitle}>Hear and Guess</h1>
        </div>

        {/* Two Column Layout: Buzzer Events & Scores */}
        <div style={styles.twoColumnContainer}>
          {/* Left Column: Who Buzzed In */}
          <div style={styles.column}>
            <h2 style={styles.sectionTitle}>Who Buzzed In</h2>
            <div style={styles.buzzerListContainer}>
              {buzzerEvents.length > 0 ? (
                (() => {
                  // Create a map of buzzer events for quick lookup
                  const buzzerMap = new Map(
                    buzzerEvents.map((event) => [
                      event.participantId,
                      { time: event.elapsedSeconds, position: event.position },
                    ])
                  );

                  // Filter to only show participants who have buzzed
                  const buzzedParticipants = (gameSession.participants || []).filter((p) =>
                    buzzerMap.has(p.id)
                  );

                  // Sort by buzz position (earlier buzz first)
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
                          <p style={styles.buzzerName}>
                            {participant.name}
                          </p>
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

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div style={styles.countdownOverlay} key={countdown}>
          <div style={styles.countdownNumber}>
            {countdown}
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
    backgroundColor: '#f8f9fa',
    padding: '20px',
    position: 'relative',
  },
  startOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    cursor: 'pointer',
  },
  startButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    animation: 'pulse 2s ease-in-out infinite',
  },
  playTriangle: {
    fontSize: '120px',
    color: 'white',
    textShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
    lineHeight: 1,
  },
  loadingLogo: {
    width: '200px',
    height: 'auto',
    animation: 'logoZoom 1.5s ease-in-out infinite',
    filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.5))',
  },
  startText: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: '4px',
    textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  conflictModal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '16px',
    textAlign: 'center',
  },
  modalText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '12px',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  deviceName: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: '16px',
    textAlign: 'center',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  takeOverButton: {
    flex: 1,
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
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
    alignItems: 'center',
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
  volumeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '24px',
    padding: '8px 16px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  volumeIcon: {
    fontSize: '18px',
  },
  volumeSlider: {
    width: '100px',
    cursor: 'pointer',
    accentColor: '#667eea',
  },
  volumeText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    minWidth: '45px',
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
  buzzerCardIncorrect: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
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
  incorrectBadge: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ef4444',
  },
  buzzerActions: {
    display: 'flex',
    gap: '8px',
  },
  correctButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  incorrectButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
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
  countdownOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 9999,
    pointerEvents: 'none' as const,
  },
  countdownNumber: {
    fontSize: '350px',
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    animation: 'countdownZoom 1s ease-out',
    userSelect: 'none' as const,
  },
};
