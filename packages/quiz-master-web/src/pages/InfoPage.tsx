import { useNavigate } from 'react-router-dom';

export function InfoPage() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Hear and Guess" style={styles.logo} />
          <h1 style={styles.title}>Hear and Guess</h1>
        </div>

        <button onClick={() => navigate('/')} style={styles.backButton}>
          ← Back to Home
        </button>

        {/* How to Play */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>How to Play</h2>
          <p style={styles.text}>
            Hear and Guess is a fun multiplayer music quiz game where you test your knowledge of songs!
          </p>

          <h3 style={styles.subTitle}>Getting Started (Quiz Master)</h3>
          <ol style={styles.list}>
            <li style={styles.listItem}>
              <strong>Prepare Spotify:</strong> Open Spotify on your phone, tablet, or computer and play any song for 1-2 seconds.
              This activates your device so the game can control playback.
            </li>
            <li style={styles.listItem}>
              <strong>Login:</strong> Click "Login with Spotify" and authorize the app to access your playlists and control playback.
            </li>
            <li style={styles.listItem}>
              <strong>Configure Settings:</strong> Click the settings icon (⚙️) to adjust:
              <ul style={styles.subList}>
                <li>Song duration (10-60 seconds)</li>
                <li>Number of songs (5-30)</li>
                <li>Wrong answer penalty (0-100%)</li>
                <li>Buzzer countdown timer (1-10 seconds)</li>
                <li>Spotify playback device</li>
              </ul>
            </li>
            <li style={styles.listItem}>
              <strong>Select a Playlist:</strong> Choose any of your Spotify playlists to use for the game.
            </li>
            <li style={styles.listItem}>
              <strong>Share the Game:</strong> Show participants the QR code or share the join link.
            </li>
            <li style={styles.listItem}>
              <strong>Start Playing:</strong> Once everyone has joined, start the game and control playback from your screen.
            </li>
          </ol>

          <h3 style={styles.subTitle}>For Participants</h3>
          <ol style={styles.list}>
            <li style={styles.listItem}>Visit the join link or scan the QR code</li>
            <li style={styles.listItem}>Enter your name</li>
            <li style={styles.listItem}>Wait for the quiz master to start the game</li>
            <li style={styles.listItem}>Press the buzz button when you recognize a song</li>
            <li style={styles.listItem}>Answer correctly to earn points!</li>
          </ol>

          <h3 style={styles.subTitle}>Scoring</h3>
          <p style={styles.text}>
            Points are awarded based on how quickly you buzz in. The faster you answer, the more points you earn!
            Wrong answers result in a penalty based on the game settings.
          </p>
        </section>

        {/* Privacy Policy */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Privacy Policy</h2>
          <p style={styles.legalText}><em>Last updated: February 2, 2026</em></p>

          <h3 style={styles.legalSubTitle}>Information We Collect</h3>
          <p style={styles.legalText}>
            When you use Hear and Guess, we collect:
          </p>
          <ul style={styles.list}>
            <li style={styles.legalListItem}>
              <strong>Spotify Account Information:</strong> We access your Spotify user ID, email, and playlists
              to allow you to select music for games.
            </li>
            <li style={styles.legalListItem}>
              <strong>Game Data:</strong> We temporarily store game sessions, participant names, and scores
              while games are in progress.
            </li>
            <li style={styles.legalListItem}>
              <strong>Analytics:</strong> We use Google Analytics to understand how people use the app,
              including page views and game events (games created, started, ended).
            </li>
          </ul>

          <h3 style={styles.legalSubTitle}>How We Use Your Information</h3>
          <ul style={styles.list}>
            <li style={styles.legalListItem}>To provide the game functionality (access playlists, control Spotify playback)</li>
            <li style={styles.legalListItem}>To manage game sessions and track scores</li>
            <li style={styles.legalListItem}>To improve the app based on usage patterns</li>
          </ul>

          <h3 style={styles.legalSubTitle}>Data Storage and Security</h3>
          <p style={styles.legalText}>
            Game sessions are stored temporarily on our servers and are automatically deleted after completion.
            We do not permanently store your Spotify credentials - you authenticate directly with Spotify using OAuth.
          </p>

          <h3 style={styles.legalSubTitle}>Third-Party Services</h3>
          <p style={styles.legalText}>
            We use the following third-party services:
          </p>
          <ul style={styles.list}>
            <li style={styles.legalListItem}>
              <strong>Spotify:</strong> For authentication and music playback control.
              See <a href="https://www.spotify.com/privacy" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Spotify's Privacy Policy
              </a>.
            </li>
            <li style={styles.legalListItem}>
              <strong>Google Analytics:</strong> For usage analytics.
              See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Google's Privacy Policy
              </a>.
            </li>
          </ul>

          <h3 style={styles.legalSubTitle}>Your Rights</h3>
          <p style={styles.legalText}>
            You can revoke the app's access to your Spotify account at any time through your
            <a href="https://www.spotify.com/account/apps/" target="_blank" rel="noopener noreferrer" style={styles.link}>
              {' '}Spotify account settings
            </a>.
          </p>
        </section>

        {/* Terms of Service */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Terms of Service</h2>
          <p style={styles.legalText}><em>Last updated: February 2, 2026</em></p>

          <h3 style={styles.legalSubTitle}>Acceptance of Terms</h3>
          <p style={styles.legalText}>
            By using Hear and Guess, you agree to these Terms of Service. If you don't agree, please don't use the app.
          </p>

          <h3 style={styles.legalSubTitle}>Service Description</h3>
          <p style={styles.legalText}>
            Hear and Guess is a music quiz game that uses your Spotify account to play songs from your playlists.
            The service is provided free of charge for personal, non-commercial use.
          </p>

          <h3 style={styles.legalSubTitle}>Spotify Requirements</h3>
          <p style={styles.legalText}>
            You must have a Spotify account to use this app. Spotify Premium is recommended for the best experience,
            as free accounts have limitations on playback control.
          </p>

          <h3 style={styles.legalSubTitle}>Acceptable Use</h3>
          <p style={styles.legalText}>You agree to:</p>
          <ul style={styles.list}>
            <li style={styles.legalListItem}>Use the app only for lawful purposes</li>
            <li style={styles.legalListItem}>Not attempt to hack, reverse engineer, or compromise the service</li>
            <li style={styles.legalListItem}>Not use the app to infringe on music copyrights (all music is played through Spotify)</li>
            <li style={styles.legalListItem}>Respect other players and not use offensive language or names</li>
          </ul>

          <h3 style={styles.legalSubTitle}>Disclaimer</h3>
          <p style={styles.legalText}>
            Hear and Guess is provided "as is" without warranties of any kind. We are not responsible for:
          </p>
          <ul style={styles.list}>
            <li style={styles.legalListItem}>Interruptions in service or Spotify playback</li>
            <li style={styles.legalListItem}>Loss of game data or scores</li>
            <li style={styles.legalListItem}>Issues with your Spotify account</li>
            <li style={styles.legalListItem}>Any damages resulting from use of the app</li>
          </ul>

          <h3 style={styles.legalSubTitle}>Changes to Terms</h3>
          <p style={styles.legalText}>
            We may update these terms at any time. Continued use of the app constitutes acceptance of any changes.
          </p>

          <h3 style={styles.legalSubTitle}>Contact</h3>
          <p style={styles.legalText}>
            Questions about these terms? Contact us at: <a href="mailto:kj3yihkvm@mozmail.com" style={styles.link}>
              kj3yihkvm@mozmail.com
            </a>
          </p>
        </section>

        {/* Copyright & License */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Copyright & License</h2>
          <p style={styles.legalText}>
            Copyright © 2026 hearandguess.com. All rights reserved.
          </p>
          <p style={styles.legalText}>
            This software is proprietary. Unauthorized use, copying, or distribution is prohibited.
            For licensing inquiries, please contact{' '}
            <a href="mailto:kj3yihkvm@mozmail.com" style={styles.link}>
              kj3yihkvm@mozmail.com
            </a>
          </p>
        </section>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Hear and Guess &copy; 2026 hearandguess.com. All rights reserved.
          </p>
          <p style={styles.footerText}>
            Not affiliated with Spotify.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e0e0e0',
  },
  logo: {
    height: '60px',
    width: 'auto',
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#667eea',
    margin: 0,
  },
  backButton: {
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'background-color 0.2s',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '16px',
    paddingTop: '20px',
    borderTop: '2px solid #e0e0e0',
  },
  subTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#555',
    marginTop: '20px',
    marginBottom: '12px',
  },
  text: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#666',
    marginBottom: '16px',
  },
  legalText: {
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#666',
    marginBottom: '8px',
  },
  list: {
    marginLeft: '20px',
    marginBottom: '16px',
  },
  listItem: {
    fontSize: '16px',
    lineHeight: '1.8',
    color: '#666',
    marginBottom: '12px',
  },
  legalListItem: {
    fontSize: '12px',
    lineHeight: '1.4',
    color: '#666',
    marginBottom: '6px',
  },
  legalSubTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#555',
    marginTop: '12px',
    marginBottom: '8px',
  },
  subList: {
    marginLeft: '20px',
    marginTop: '8px',
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
  },
  footer: {
    marginTop: '60px',
    paddingTop: '20px',
    borderTop: '2px solid #e0e0e0',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '14px',
    color: '#999',
    marginBottom: '8px',
  },
};
