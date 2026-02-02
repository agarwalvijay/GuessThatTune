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
        console.log('🔐 Processing OAuth callback...');
        const token = await spotifyAuthService.handleCallback();
        if (token) {
          console.log('✅ Token received, navigating to playlists');
          setAccessToken(token);
          navigate('/playlists');
        } else {
          console.error('❌ Failed to get access token from callback');
          alert('Failed to authenticate with Spotify. Please try again.');
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
        <img src="/logo.png" alt="Hear and Guess" style={styles.logo} />
        <h1 style={styles.title}>Hear and Guess</h1>
        <p style={styles.subtitle}>Quiz Master</p>

        <div style={styles.content}>
          <p style={styles.description}>
            Welcome to Hear and Guess Connect your Spotify account to create and host music quiz games.
          </p>

          <button onClick={handleLogin} style={styles.button}>
            Connect with Spotify
          </button>

          <p style={styles.infoLink}>
            <a href="/info" style={styles.link}>
              How to Play • Privacy • Terms
            </a>
          </p>
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
  logo: {
    width: '180px',
    height: 'auto',
    margin: '0 auto 20px',
    display: 'block',
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
  infoLink: {
    textAlign: 'center' as const,
    margin: 0,
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
};
