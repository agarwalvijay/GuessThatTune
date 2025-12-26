import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { spotifyAuthService } from '../services/spotifyAuthService';

export function SpotifyLoginPage() {
  const navigate = useNavigate();
  const { setAccessToken } = useAppStore();

  useEffect(() => {
    let handled = false;

    const handleAuth = async () => {
      if (handled) return;
      handled = true;

      // Check if we're returning from Spotify OAuth
      if (window.location.search.includes('code=')) {
        const token = await spotifyAuthService.handleCallback();
        if (token) {
          setAccessToken(token);
          navigate('/playlists');
        } else {
          console.error('Failed to get access token from callback');
        }
      } else {
        // Check if already authenticated
        const token = spotifyAuthService.getAccessToken();
        if (token) {
          setAccessToken(token);
          navigate('/playlists');
        }
      }
    };

    handleAuth();
  }, [setAccessToken, navigate]);

  const handleLogin = async () => {
    await spotifyAuthService.login();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Song Quiz Game</h1>
        <p style={styles.subtitle}>Quiz Master</p>

        <div style={styles.content}>
          <p style={styles.description}>
            Welcome to Song Quiz Game! Connect your Spotify account to create and host music quiz games.
          </p>

          <button onClick={handleLogin} style={styles.button}>
            Connect with Spotify
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: '8px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '18px',
    color: '#666',
    marginBottom: '32px',
    textAlign: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  description: {
    fontSize: '16px',
    color: '#333',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1DB954',
    color: 'white',
    border: 'none',
    borderRadius: '24px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
