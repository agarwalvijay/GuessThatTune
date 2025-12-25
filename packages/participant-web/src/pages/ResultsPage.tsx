import { useNavigate } from 'react-router-dom';
import { useParticipantStore } from '../store/participantStore';
import './ResultsPage.css';

export function ResultsPage() {
  const navigate = useNavigate();
  const participantId = useParticipantStore((state) => state.participantId);
  const gameSession = useParticipantStore((state) => state.gameSession);
  const myScore = useParticipantStore((state) => state.myScore);
  const reset = useParticipantStore((state) => state.reset);

  // Get final scores sorted by score descending
  const finalScores = gameSession?.participants
    ?.map((p) => ({
      id: p.id,
      name: p.name,
      score: gameSession.scores[p.id] || 0,
    }))
    .sort((a, b) => b.score - a.score) || [];

  const myRank = finalScores.findIndex(p => p.id === participantId) + 1;
  const winner = finalScores[0];
  const isWinner = winner?.id === participantId;

  const handlePlayAgain = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="results-page">
      <div className="results-container">
        <div className="results-header">
          <h1 className="results-title">Game Over!</h1>
          {isWinner && <div className="winner-crown">👑</div>}
        </div>

        <div className="my-result">
          <p className="result-label">Your Score</p>
          <p className="result-score">{myScore} pts</p>
          <p className="result-rank">
            {myRank === 1 && '🥇 1st Place!'}
            {myRank === 2 && '🥈 2nd Place'}
            {myRank === 3 && '🥉 3rd Place'}
            {myRank > 3 && `#${myRank}`}
          </p>
        </div>

        <div className="final-scores">
          <h2 className="scores-title">Final Scores</h2>
          <div className="scores-list">
            {finalScores.map((participant, index) => (
              <div
                key={participant.id}
                className={`score-item ${index === 0 ? 'winner' : ''} ${participant.id === participantId ? 'me' : ''}`}
              >
                <div className="score-rank">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </div>
                <div className="score-name">
                  {participant.name}
                  {participant.id === participantId && ' (You)'}
                </div>
                <div className="score-points">{participant.score} pts</div>
              </div>
            ))}
          </div>
        </div>

        <button className="play-again-button" onClick={handlePlayAgain}>
          Join Another Game
        </button>
      </div>
    </div>
  );
}
