import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import { socketService } from '../services/socketService';
import { useWakeLock } from '../hooks/useWakeLock';
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

  const handleBuzz = async () => {
    if (buzzerDisabled || hasBuzzed || !sessionId) return;

    try {
      await socketService.buzzIn(sessionId);
      // The socket service will set buzzed to true if successful
    } catch (err) {
      console.error('Failed to buzz:', err);
    }
  };

  const currentSongNumber = (gameSession?.currentRoundIndex || 0) + 1;
  const totalSongs = gameSession?.songs?.length || 0;
  const roundWinner = currentRound?.winnerId;
  const isWinner = roundWinner && roundWinner === participantId;

  // Get current song metadata
  const currentSong = gameSession?.songs?.[gameSession.currentRoundIndex];
  const songMetadata = currentSong?.metadata;

  return (
    <div className="game-page">
      <div className="game-container">
        {/* Header */}
        <div className="game-header">
          <div className="player-info">
            <p className="player-name">{participantName}</p>
            <p className="player-score">{myScore} points</p>
          </div>
          <div className="round-info">
            <p className="round-number">
              Song {currentSongNumber} of {totalSongs}
            </p>
          </div>
        </div>

        {/* Song Info Card - Shows after round complete */}
        {currentRound?.isComplete && songMetadata && (
          <div className="song-info-card">
            {songMetadata.imageUrl && (
              <img
                src={songMetadata.imageUrl}
                alt="Album artwork"
                className="album-artwork"
              />
            )}
            <div className="song-details">
              <h3 className="song-title">{songMetadata.title}</h3>
              <p className="song-artist">{songMetadata.artist}</p>
              <p className="song-album">{songMetadata.album}</p>
            </div>
          </div>
        )}

        {/* Buzzer */}
        <div className="buzzer-container">
          {currentRound && !currentRound.isComplete ? (
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
