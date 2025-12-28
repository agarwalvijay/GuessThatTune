import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import { socketService } from '../services/socketService';
import './JoinPage.css';

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setParticipantName = useParticipantStore((state) => state.setParticipantName);
  const setSessionId = useParticipantStore((state) => state.setSessionId);
  const sessionId = searchParams.get('session');

  useEffect(() => {
    if (!sessionId) {
      alert('No session ID found in URL');
      return;
    }
    setSessionId(sessionId);
  }, [sessionId, setSessionId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!sessionId) {
      setError('No session ID found');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const result = await socketService.joinGame(sessionId, name.trim());

      if (result.success) {
        setParticipantName(name.trim());
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
          <p className="session-info">Session: {sessionId.substring(0, 8)}...</p>
        )}

        <form onSubmit={handleJoin} className="join-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="name-input"
            maxLength={20}
            autoFocus
            disabled={isJoining}
          />

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            className="join-button"
            disabled={isJoining || !name.trim()}
          >
            {isJoining ? 'Joining...' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}
