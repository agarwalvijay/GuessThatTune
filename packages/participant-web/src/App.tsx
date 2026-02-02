import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { JoinPage } from './pages/JoinPage';
import { WaitingRoom } from './pages/WaitingRoom';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { socketService } from './services/socketService';
import { analyticsService } from './services/analyticsService';
import './App.css';

// Redirect component to convert /join/:sessionId to /join?session=:sessionId
function JoinRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) {
    return <Navigate to="/join" replace />;
  }
  return <Navigate to={`/join?session=${sessionId}`} replace />;
}

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    analyticsService.pageView(location.pathname);
  }, [location]);

  return null;
}

function App() {
  // Initialize socket and analytics once when app loads
  useEffect(() => {
    socketService.initialize();
    analyticsService.initialize();
  }, []);

  return (
    <BrowserRouter>
      <AnalyticsTracker />
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
