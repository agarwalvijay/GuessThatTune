import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { apiService } from '../services/apiService';
import { spotifyAuthService } from '../services/spotifyAuthService';
import { spotifyPlaybackService } from '../services/spotifyPlaybackService';
import type { Playlist } from '../store/appStore';

export function PlaylistSelectionPage() {
  const navigate = useNavigate();
  const { accessToken, playlists, setPlaylists, setSelectedPlaylist, gameSettings, setGameSettings } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempGameMode, setTempGameMode] = useState<'buzzer' | 'multiple_choice'>(gameSettings.gameMode || 'buzzer');
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
    spotifyPlaybackService.disconnect(); // Clean up player on logout
    spotifyAuthService.logout();
    navigate('/');
  };

  const handleOpenSettings = async () => {
    setTempGameMode(gameSettings.gameMode || 'buzzer');
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
      gameMode: tempGameMode,
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

            {/* Game Mode Selector */}
            <div style={styles.settingGroup}>
              <label style={styles.settingLabel}>Game Mode</label>
              <p style={styles.settingDescription}>
                Choose how participants will answer
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setTempGameMode('multiple_choice')}
                  style={{
                    ...styles.gameModeButton,
                    ...(tempGameMode === 'multiple_choice' ? styles.gameModeButtonActive : {}),
                  }}
                >
                  📝 Multiple Choice
                  <div style={styles.gameModeDescription}>
                    Select from 4 options
                  </div>
                </button>
                <button
                  onClick={() => setTempGameMode('buzzer')}
                  style={{
                    ...styles.gameModeButton,
                    ...(tempGameMode === 'buzzer' ? styles.gameModeButtonActive : {}),
                  }}
                >
                  🔔 Buzzer Mode
                  <div style={styles.gameModeDescription}>
                    Press buzzer when you know the answer
                  </div>
                </button>
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
    backgroundColor: '#0a0a0a',
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
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
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
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#141414',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '24px',
    maxWidth: '400px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '24px',
    textAlign: 'center',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  settingGroup: {
    marginBottom: '24px',
  },
  settingLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '12px',
  },
  settingDescription: {
    fontSize: '13px',
    color: '#a7a7a7',
    marginTop: '-8px',
    marginBottom: '12px',
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '0',
    background: 'rgba(255, 255, 255, 0.1)',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#1DB954',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#a7a7a7',
    marginTop: '4px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '32px',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#a7a7a7',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  gameModeButton: {
    flex: 1,
    padding: '16px',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    color: '#ffffff',
    textTransform: 'none' as const,
  },
  gameModeButtonActive: {
    borderColor: '#1DB954',
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    color: '#1DB954',
  },
  gameModeDescription: {
    fontSize: '12px',
    fontWeight: 'normal',
    color: '#a7a7a7',
    marginTop: '4px',
    textTransform: 'none' as const,
  },
  loadingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '100px auto',
  },
  loadingText: {
    fontSize: '18px',
    color: '#a7a7a7',
  },
  error: {
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    border: '2px solid #ff3333',
    borderRadius: '0',
    padding: '16px',
    marginBottom: '20px',
    maxWidth: '1200px',
    margin: '0 auto 20px',
    textAlign: 'center',
    color: '#ff3333',
  },
  retryButton: {
    marginTop: '10px',
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    borderRadius: '0',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  playlistImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '200px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#ffffff',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCount: {
    fontSize: '14px',
    color: '#a7a7a7',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '0',
    cursor: 'pointer',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.2s',
  },
  radio: {
    cursor: 'pointer',
    width: '18px',
    height: '18px',
    accentColor: '#1DB954',
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
    color: '#ffffff',
  },
  deviceType: {
    fontSize: '12px',
    color: '#a7a7a7',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#a7a7a7',
  },
};
