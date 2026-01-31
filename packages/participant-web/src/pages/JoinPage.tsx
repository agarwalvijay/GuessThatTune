import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import { socketService } from '../services/socketService';
import './JoinPage.css';

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [manualSessionId, setManualSessionId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setParticipantName = useParticipantStore((state) => state.setParticipantName);
  const setSessionId = useParticipantStore((state) => state.setSessionId);
  const urlSessionId = searchParams.get('session');

  // Use session ID from URL if available, otherwise use manually entered one
  const sessionId = urlSessionId || manualSessionId;

  useEffect(() => {
    if (urlSessionId) {
      setSessionId(urlSessionId);
    }
  }, [urlSessionId, setSessionId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionId || !sessionId.trim()) {
      setError('Please enter a session code');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const normalizedSessionId = sessionId.trim().toUpperCase();
      const result = await socketService.joinGame(normalizedSessionId, name.trim());

      if (result.success) {
        setParticipantName(name.trim());
        setSessionId(normalizedSessionId);
        navigate('/waiting');
      } else {
        setError(result.error || 'Failed to join game');
        setIsJoining(false);
      }
    } catch (err) {
      setError('An error occurred while joining');
      setIsJoining(false);
    }
  };

  return (
    <div className="join-page">
      <div className="join-container">
        <img src="/logo.png" alt="Guess That Tune!" className="app-logo" />
        <h1 className="join-title">Guess That Tune!</h1>
        <p className="join-subtitle">Join the fun!</p>

        {sessionId && (
          <p className="session-info">Session: {sessionId}</p>
        )}

        <form onSubmit={handleJoin} className="join-form">
          {/* Show session ID input if not provided in URL */}
          {!urlSessionId && (
            <input
              type="text"
              value={manualSessionId}
              onChange={(e) => setManualSessionId(e.target.value.toUpperCase())}
              placeholder="Enter session code"
              className="name-input"
              maxLength={5}
              autoFocus
              disabled={isJoining}
            />
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="name-input"
            maxLength={20}
            autoFocus={!!urlSessionId}
            disabled={isJoining}
          />

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="join-button"
            disabled={isJoining || !name.trim() || !sessionId}
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
