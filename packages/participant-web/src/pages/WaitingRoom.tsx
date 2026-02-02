import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import { useWakeLock } from '../hooks/useWakeLock';
import './WaitingRoom.css';

export function WaitingRoom() {
  const navigate = useNavigate();
  const participantName = useParticipantStore((state) => state.participantName);
  const sessionId = useParticipantStore((state) => state.sessionId);
  const gameSession = useParticipantStore((state) => state.gameSession);
  const isConnected = useParticipantStore((state) => state.isConnected);

  // Keep screen awake while waiting for game to start
  useWakeLock(true);

  useEffect(() => {
    if (!participantName || !sessionId) {
      navigate('/');
      return;
    }
  }, [participantName, sessionId, navigate]);

  useEffect(() => {
    // When game starts, navigate to game page
    if (gameSession?.status === 'playing') {
      navigate('/game');
    }
  }, [gameSession?.status, navigate]);

  const participantCount = gameSession?.participantIds?.length || 0;

  return (
    <div className="waiting-room">
      <div className="waiting-container">
        <img src="/logo.png" alt="Hear and Guess" className="app-logo" />
        <h2 className="waiting-subtitle">Waiting for Game to Start</h2>

        <div className="participant-info">
          <p className="your-name">Welcome, <strong>{participantName}</strong>!</p>
          <p className="connection-status">
            {isConnected ? '🟢 Connected' : '🔴 Connecting...'}
          </p>
        </div>

        <div className="participants-count">
          <p className="count-number">{participantCount}</p>
          <p className="count-label">
            {participantCount === 1 ? 'Participant' : 'Participants'} Joined
          </p>
        </div>

        <div className="waiting-animation">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>

        <p className="waiting-message">
          Get ready! The quiz master will start the game soon...
        </p>

        <div className="session-info-box">
          <p className="session-label">Session</p>
          <p className="session-id">{sessionId?.substring(0, 8)}</p>
        </div>
      </div>
    </div>
  );
}
