import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import { socketService } from '../services/socketService';
import { useWakeLock } from '../hooks/useWakeLock';
import { playBuzzSound } from '../utils/soundEffects';
import './GamePage.css';

export function GamePage() {
  const navigate = useNavigate();
  const participantName = useParticipantStore((state) => state.participantName);
  const sessionId = useParticipantStore((state) => state.sessionId);
  const gameSession = useParticipantStore((state) => state.gameSession);
  const hasBuzzed = useParticipantStore((state) => state.hasBuzzed);
  const buzzerDisabled = useParticipantStore((state) => state.buzzerDisabled);
  const myScore = useParticipantStore((state) => state.myScore);
  const participantId = useParticipantStore((state) => state.participantId);
  const multipleChoiceOptions = useParticipantStore((state) => state.multipleChoiceOptions);
  const selectedAnswer = useParticipantStore((state) => state.selectedAnswer);
  const hasAnswered = useParticipantStore((state) => state.hasAnswered);
  const setSelectedAnswer = useParticipantStore((state) => state.setSelectedAnswer);

  // Keep screen awake during active gameplay
  useWakeLock(true);

  // Derive current round from game session
  const currentRound = gameSession?.rounds?.[gameSession.currentRoundIndex];

  useEffect(() => {
    if (!participantName || !sessionId) {
      navigate('/');
      return;
    }
  }, [participantName, sessionId, navigate]);

  useEffect(() => {
    // When game ends, navigate to results
    if (gameSession?.status === 'ended') {
      navigate('/results');
    }
  }, [gameSession?.status, navigate]);

  // Clear selected answer when round changes
  useEffect(() => {
    if (gameSession?.currentRoundIndex !== undefined) {
      setSelectedAnswer(null);
    }
  }, [gameSession?.currentRoundIndex, setSelectedAnswer]);

  const handleBuzz = async () => {
    if (buzzerDisabled || hasBuzzed || !sessionId) return;

    // Play buzz sound immediately for feedback
    playBuzzSound();

    // Vibrate for haptic feedback (200ms)
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }

    try {
      await socketService.buzzIn(sessionId);
      // The socket service will set buzzed to true if successful
    } catch (err) {
      console.error('Failed to buzz:', err);
    }
  };

  const handleSelectAnswer = async (answer: string) => {
    if (hasAnswered || !sessionId || !currentRound) return;

    setSelectedAnswer(answer);

    // Vibrate for haptic feedback (100ms)
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }

    try {
      await socketService.submitMultipleChoiceAnswer(sessionId, answer);
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setSelectedAnswer(null);
    }
  };

  const currentSongNumber = (gameSession?.currentRoundIndex || 0) + 1;
  const totalSongs = gameSession?.songs?.length || 0;
  const roundWinner = currentRound?.winnerId;
  const isWinner = roundWinner && roundWinner === participantId;

  return (
    <div className="game-page">
      <div className="game-container">
        {/* Header */}
        <div className="game-header">
          <div className="player-info">
            <img src="/logo.png" alt="Hear and Guess" className="game-logo" />
            <div className="player-details">
              <p className="player-name">{participantName}</p>
              <p className="player-score">{myScore} points</p>
            </div>
          </div>
          <div className="round-info">
            <p className="round-number">
              Song {currentSongNumber} of {totalSongs}
            </p>
          </div>
        </div>

        {/* Game Mode Container */}
        <div className="game-mode-container">
          {gameSession?.settings?.gameMode === 'buzzer' ? (
            // BUZZER MODE
            currentRound && !currentRound.isComplete ? (
              <>
                <button
                  className={`buzzer ${hasBuzzed ? 'buzzed' : ''} ${buzzerDisabled ? 'disabled' : ''}`}
                  onClick={handleBuzz}
                  disabled={buzzerDisabled || hasBuzzed}
                >
                  {hasBuzzed ? '✓ BUZZED!' : 'BUZZ IN'}
                </button>
                <p className="buzzer-hint">
                  {hasBuzzed
                    ? 'Waiting for quiz master...'
                    : 'Tap to buzz in when you know the answer!'}
                </p>
              </>
            ) : (
              <>
                <div className="waiting-indicator">
                  <div className="pulse"></div>
                  <p>Waiting for next song...</p>
                </div>
                {isWinner && (
                  <div className="winner-message">
                    🎉 You got it right! 🎉
                  </div>
                )}
              </>
            )
          ) : (
            // MULTIPLE CHOICE MODE
            currentRound && !currentRound.isComplete ? (
              <>
                <div className="mc-options-grid">
                  {multipleChoiceOptions.map((option, index) => (
                    <button
                      key={index}
                      className={`mc-option ${selectedAnswer === option ? 'selected' : ''} ${hasAnswered ? 'disabled' : ''}`}
                      onClick={() => handleSelectAnswer(option)}
                      disabled={hasAnswered}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                      <span className="option-text">{option}</span>
                    </button>
                  ))}
                </div>
                <p className="mc-hint">
                  {hasAnswered ? 'Answer submitted! Waiting for round to end...' : 'Select the correct song title'}
                </p>
              </>
            ) : (
              <>
                <div className="waiting-indicator">
                  <div className="pulse"></div>
                  <p>Waiting for next song...</p>
                </div>
                {isWinner && (
                  <div className="winner-message">
                    🎉 You got it right! 🎉
                  </div>
                )}
              </>
            )
          )}
        </div>

        {/* Score info */}
        <div className="game-footer">
          <p className="status-text">
            {gameSession?.status === 'playing' ? '🎵 Game in Progress' : 'Waiting...'}
          </p>
        </div>
      </div>
    </div>
  );
}
