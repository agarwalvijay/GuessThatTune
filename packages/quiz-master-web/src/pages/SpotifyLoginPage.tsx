import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { spotifyAuthService } from '../services/spotifyAuthService';

export function SpotifyLoginPage() {
  const navigate = useNavigate();
  const { setAccessToken } = useAppStore();
  const [premiumWarning, setPremiumWarning] = useState<string | null>(null);

  useEffect(() => {
    let handled = false;

    // Spotify Connect playback (used by this app) requires Premium. Warn the
    // user up-front so they don't discover this mid-game.
    const proceedAfterAuth = async (token: string) => {
      setAccessToken(token);
      const product = await spotifyAuthService.fetchUserProduct();
      if (product && product !== 'premium') {
        setPremiumWarning(
          `Your Spotify account tier is "${product}". This game needs Spotify Premium to control playback — playback will fail when a round starts.`
        );
        return;
      }
      navigate('/playlists');
    };

    const handleAuth = async () => {
      if (handled) return;
      handled = true;

      // Check if we're returning from Spotify OAuth
      if (window.location.search.includes('code=')) {
        console.log('🔐 Processing OAuth callback...');
        const token = await spotifyAuthService.handleCallback();
        if (token) {
          console.log('✅ Token received, checking account tier');
          await proceedAfterAuth(token);
        } else {
          console.error('❌ Failed to get access token from callback');
          alert('Failed to authenticate with Spotify. Please try again.');
        }
      } else {
        // Already authenticated? Refresh if needed, then check tier.
        const token = await spotifyAuthService.ensureAccessToken();
        if (token) {
          await proceedAfterAuth(token);
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

          {premiumWarning && (
            <div style={styles.premiumWarning}>
              <strong style={styles.premiumWarningTitle}>Spotify Premium required</strong>
              <p style={styles.premiumWarningText}>{premiumWarning}</p>
              <button
                style={styles.premiumWarningButton}
                onClick={() => {
                  spotifyAuthService.logout();
                  setAccessToken(null);
                  setPremiumWarning(null);
                }}
              >
                Use a different account
              </button>
              <button
                style={{ ...styles.premiumWarningButton, ...styles.premiumWarningContinue }}
                onClick={() => navigate('/playlists')}
              >
                Continue anyway
              </button>
            </div>
          )}

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
    backgroundColor: '#0a0a0a',
    padding: '20px',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '0',
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
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
    color: '#a7a7a7',
    marginBottom: '32px',
    textAlign: 'center',
    textTransform: 'uppercase' as const,
    letterSpacing: '2px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  description: {
    fontSize: '16px',
    color: '#a7a7a7',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1DB954',
    color: '#0a0a0a',
    border: '2px solid #1DB954',
    borderRadius: '0',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  infoLink: {
    textAlign: 'center' as const,
    margin: 0,
  },
  link: {
    color: '#1DB954',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  premiumWarning: {
    border: '2px solid #ffa500',
    backgroundColor: 'rgba(255, 165, 0, 0.08)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  premiumWarningTitle: {
    color: '#ffa500',
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  premiumWarningText: {
    color: '#ffffff',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: 0,
  },
  premiumWarningButton: {
    backgroundColor: 'transparent',
    color: '#ffa500',
    border: '2px solid #ffa500',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  premiumWarningContinue: {
    color: '#a7a7a7',
    borderColor: '#555',
  },
};
