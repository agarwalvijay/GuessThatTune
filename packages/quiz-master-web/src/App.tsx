import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpotifyLoginPage } from './pages/SpotifyLoginPage';
import { PlaylistSelectionPage } from './pages/PlaylistSelectionPage';
import { GameSetupPage } from './pages/GameSetupPage';
import { GameControlPage } from './pages/GameControlPage';
import { ResultsPage } from './pages/ResultsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SpotifyLoginPage />} />
        <Route path="/callback" element={<SpotifyLoginPage />} />
        <Route path="/playlists" element={<PlaylistSelectionPage />} />
        <Route path="/game-setup" element={<GameSetupPage />} />
        <Route path="/game-control" element={<GameControlPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
