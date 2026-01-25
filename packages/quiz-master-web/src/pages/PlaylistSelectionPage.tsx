import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { spotifyAuthService } from '../services/spotifyAuthService';
import type { Playlist } from '../store/appStore';

export function PlaylistSelectionPage() {
  const navigate = useNavigate();
  const { accessToken, playlists, setPlaylists, setSelectedPlaylist, gameSettings, setGameSettings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempSongDuration, setTempSongDuration] = useState(gameSettings.songDuration);
  const [tempNumberOfSongs, setTempNumberOfSongs] = useState(gameSettings.numberOfSongs);

  useEffect(() => {
    if (!accessToken) {
      navigate('/');
      return;
    }

    loadPlaylists();
  }, [accessToken, navigate]);

  const loadPlaylists = async () => {
    if (!accessToken) {
      console.error('❌ No access token available');
      return;
    }

    try {
      console.log('📋 Fetching playlists...');
      setLoading(true);
      setError(null);
      const data = await apiService.fetchPlaylists(accessToken);
      console.log('✅ Playlists loaded:', data.length);
      setPlaylists(data);
    } catch (err: any) {
      console.error('Error loading playlists:', err);
      const errorMessage = err.response?.data?.error?.message
        || err.response?.data?.message
        || err.message
        || 'Failed to load playlists. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    navigate('/game-setup');
  };

  const handleLogout = () => {
    spotifyAuthService.logout();
    navigate('/');
  };

  const handleOpenSettings = () => {
    setTempSongDuration(gameSettings.songDuration);
    setTempNumberOfSongs(gameSettings.numberOfSongs);
    setShowSettings(true);
  };

  const handleSaveSettings = () => {
    setGameSettings({
      songDuration: tempSongDuration,
      numberOfSongs: tempNumberOfSongs,
    });
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <p style={styles.loadingText}>Loading playlists...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/logo.png" alt="Guess That Tune!" style={styles.logo} />
          <h1 style={styles.title}>Select a Playlist</h1>
        </div>
        <div style={styles.headerRight}>
          <button onClick={handleOpenSettings} style={styles.settingsButton}>
            ⚙️ Settings
          </button>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={styles.modalOverlay} onClick={handleCancelSettings}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Game Settings</h2>

            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>
                Song Duration: {tempSongDuration} seconds
              </label>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={tempSongDuration}
                onChange={(e) => setTempSongDuration(Number(e.target.value))}
                style={styles.slider}
              />
              <div style={styles.sliderLabels}>
                <span>10s</span>
                <span>60s</span>
              </div>
            </div>

            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>
                Number of Songs: {tempNumberOfSongs}
              </label>
              <input
                type="range"
                min="5"
                max="30"
                step="1"
                value={tempNumberOfSongs}
                onChange={(e) => setTempNumberOfSongs(Number(e.target.value))}
                style={styles.slider}
              />
              <div style={styles.sliderLabels}>
                <span>5</span>
                <span>30</span>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={handleCancelSettings} style={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSaveSettings} style={styles.saveButton}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={styles.error}>
          <p>{error}</p>
          <button onClick={loadPlaylists} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.playlistGrid}>
        {playlists.map((playlist) => (
          <div
            key={playlist.id}
            onClick={() => handlePlaylistSelect(playlist)}
            style={styles.playlistCard}
          >
            {playlist.images && playlist.images.length > 0 ? (
              <img
                src={playlist.images[0].url}
                alt={playlist.name}
                style={styles.playlistImage}
              />
            ) : (
              <div style={styles.placeholderImage}>
                <span style={styles.placeholderIcon}>🎵</span>
              </div>
            )}
            <div style={styles.playlistInfo}>
              <h3 style={styles.playlistName}>{playlist.name}</h3>
              <p style={styles.trackCount}>{playlist.tracks.total} tracks</p>
            </div>
          </div>
        ))}
      </div>

      {playlists.length === 0 && !loading && !error && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No playlists found</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto 30px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    height: '40px',
    width: 'auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'white',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  settingsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '1px solid white',
    borderRadius: '20px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '1px solid white',
    borderRadius: '20px',
    padding: '10px 20px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '24px',
    textAlign: 'center',
  },
  settingGroup: {
    marginBottom: '24px',
  },
  settingLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '12px',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: '#e0e0e0',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#667eea',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '32px',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loadingCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '100px auto',
  },
  loadingText: {
    fontSize: '18px',
    color: '#666',
  },
  error: {
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
    maxWidth: '1200px',
    margin: '0 auto 20px',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: '10px',
    backgroundColor: '#1DB954',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    padding: '8px 16px',
    cursor: 'pointer',
  },
  playlistGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    justifyContent: 'center',
  },
  playlistCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  playlistImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '200px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: '48px',
  },
  playlistInfo: {
    padding: '16px',
  },
  playlistName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCount: {
    fontSize: '14px',
    color: '#666',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyText: {
    fontSize: '18px',
    color: 'white',
  },
};
