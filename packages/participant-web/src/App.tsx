import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { JoinPage } from './pages/JoinPage';
import { WaitingRoom } from './pages/WaitingRoom';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { socketService } from './services/socketService';
import './App.css';

// Redirect component to convert /join/:sessionId to /join?session=:sessionId
function JoinRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) {
    return <Navigate to="/join" replace />;
  }
  return <Navigate to={`/join?session=${sessionId}`} replace />;
}

function App() {
  // Initialize socket once when app loads
  useEffect(() => {
    socketService.initialize();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:sessionId" element={<JoinRedirect />} />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
