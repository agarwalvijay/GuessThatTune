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
  const [tempNegativePointsPercentage, setTempNegativePointsPercentage] = useState(gameSettings.negativePointsPercentage);
  const [tempBuzzerCountdownSeconds, setTempBuzzerCountdownSeconds] = useState(gameSettings.buzzerCountdownSeconds);
  const [spotifyDevices, setSpotifyDevices] = useState<any[]>([]);
  const [tempSelectedDeviceId, setTempSelectedDeviceId] = useState<string | undefined>(gameSettings.selectedDeviceId);
  const [loadingDevices, setLoadingDevices] = useState(false);

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

  const handleOpenSettings = async () => {
    setTempSongDuration(gameSettings.songDuration);
    setTempNumberOfSongs(gameSettings.numberOfSongs);
    setTempNegativePointsPercentage(gameSettings.negativePointsPercentage);
    setTempBuzzerCountdownSeconds(gameSettings.buzzerCountdownSeconds);
    setTempSelectedDeviceId(gameSettings.selectedDeviceId);
    setShowSettings(true);

    // Fetch Spotify devices
    if (accessToken) {
      setLoadingDevices(true);
      try {
        const devices = await apiService.getSpotifyDevices(accessToken);
        setSpotifyDevices(devices);
        // If no device selected, auto-select the active one
        if (!tempSelectedDeviceId && devices.length > 0) {
          const activeDevice = devices.find((d: any) => d.is_active);
          if (activeDevice) {
            setTempSelectedDeviceId(activeDevice.id);
          }
        }
      } catch (error) {
        console.error('Error fetching devices:', error);
      } finally {
        setLoadingDevices(false);
      }
    }
  };

  const handleSaveSettings = () => {
    setGameSettings({
      songDuration: tempSongDuration,
      numberOfSongs: tempNumberOfSongs,
      negativePointsPercentage: tempNegativePointsPercentage,
      buzzerCountdownSeconds: tempBuzzerCountdownSeconds,
      selectedDeviceId: tempSelectedDeviceId,
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
          <img src="/logo.png" alt="Hear and Guess" style={styles.logo} />
          <h1 style={styles.title}>Select a Playlist</h1>
        </div>
        <div style={styles.headerRight}>
          <button onClick={handleOpenSettings} style={styles.settingsButton} title="Settings">
            ⚙️
          </button>
          <button onClick={handleLogout} style={styles.logoutButton} title="Logout">
            🚪
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

            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>
                Wrong Answer Penalty: {tempNegativePointsPercentage}%
              </label>
              <p style={styles.settingDescription}>
                Deduct this percentage of potential points when participants answer incorrectly
              </p>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={tempNegativePointsPercentage}
                onChange={(e) => setTempNegativePointsPercentage(Number(e.target.value))}
                style={styles.slider}
              />
              <div style={styles.sliderLabels}>
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>
                Buzzer Countdown: {tempBuzzerCountdownSeconds} seconds
              </label>
              <p style={styles.settingDescription}>
                Countdown timer shown after someone buzzes in
              </p>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={tempBuzzerCountdownSeconds}
                onChange={(e) => setTempBuzzerCountdownSeconds(Number(e.target.value))}
                style={styles.slider}
              />
              <div style={styles.sliderLabels}>
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>

            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>
                Spotify Playback Device
              </label>
              <p style={styles.settingDescription}>
                Select which device to use for playing music
              </p>
              {loadingDevices ? (
                <p style={styles.settingDescription}>Loading devices...</p>
              ) : spotifyDevices.length > 0 ? (
                <div style={styles.deviceList}>
                  {spotifyDevices.map((device: any) => (
                    <label key={device.id} style={styles.deviceOption}>
                      <input
                        type="radio"
                        name="device"
                        value={device.id}
                        checked={tempSelectedDeviceId === device.id}
                        onChange={() => setTempSelectedDeviceId(device.id)}
                        style={styles.radio}
                      />
                      <div style={styles.deviceInfo}>
                        <span style={styles.deviceName}>{device.name}</span>
                        <span style={styles.deviceType}>
                          {device.type} {device.is_active && '• Active'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p style={styles.settingDescription}>
                  No devices found. Open Spotify on your phone/computer and play a song.
                </p>
              )}
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
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    border: '1px solid white',
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: '24px',
    maxWidth: '400px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
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
  settingDescription: {
    fontSize: '13px',
    color: '#666',
    marginTop: '-8px',
    marginBottom: '12px',
  },
  deviceList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginTop: '8px',
  },
  deviceOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s',
  },
  radio: {
    cursor: 'pointer',
    width: '18px',
    height: '18px',
    accentColor: '#667eea',
  },
  deviceInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    flex: 1,
  },
  deviceName: {
    fontSize: '15px',
    fontWeight: '600' as const,
    color: '#333',
  },
  deviceType: {
    fontSize: '12px',
    color: '#666',
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
