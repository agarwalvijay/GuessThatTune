import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { JoinPage } from './pages/JoinPage';
import { WaitingRoom } from './pages/WaitingRoom';
import { GamePage } from './pages/GamePage';
import { ResultsPage } from './pages/ResultsPage';
import { socketService } from './services/socketService';
import './App.css';

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
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
