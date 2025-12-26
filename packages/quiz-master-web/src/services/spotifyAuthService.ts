import { config } from '../config/environment';

class SpotifyAuthService {
  private static readonly TOKEN_KEY = 'spotify_access_token';
  private static readonly EXPIRY_KEY = 'spotify_token_expiry';
  private static readonly CODE_VERIFIER_KEY = 'spotify_code_verifier';

  /**
   * Generate random string for PKCE
   */
  private generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], '');
  }

  /**
   * Generate code challenge from verifier
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Initiate Spotify OAuth flow with PKCE
   */
  async login(): Promise<void> {
    const codeVerifier = this.generateRandomString(64);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    localStorage.setItem(SpotifyAuthService.CODE_VERIFIER_KEY, codeVerifier);

    const scope = config.spotify.scopes.join(' ');
    const authUrl = new URL('https://accounts.spotify.com/authorize');

    authUrl.searchParams.append('client_id', config.spotify.clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', config.spotify.redirectUri);
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);

    window.location.href = authUrl.toString();
  }

  /**
   * Handle OAuth callback and exchange code for token
   */
  async handleCallback(): Promise<string | null> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return null;
    }

    if (!code) {
      return null;
    }

    // Exchange code for access token
    const codeVerifier = localStorage.getItem(SpotifyAuthService.CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      console.error('Code verifier not found');
      return null;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.spotify.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: config.spotify.redirectUri,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange failed:', errorData);
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;
      const expiresIn = data.expires_in;

      if (accessToken && expiresIn) {
        const expiryTime = Date.now() + expiresIn * 1000;
        this.saveToken(accessToken, expiryTime);

        // Clean up
        localStorage.removeItem(SpotifyAuthService.CODE_VERIFIER_KEY);
        window.history.replaceState(null, '', window.location.pathname);

        return accessToken;
      }

      return null;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return null;
    }
  }

  /**
   * Save token to localStorage
   */
  private saveToken(token: string, expiryTime: number): void {
    localStorage.setItem(SpotifyAuthService.TOKEN_KEY, token);
    localStorage.setItem(SpotifyAuthService.EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Get access token from localStorage
   */
  getAccessToken(): string | null {
    const token = localStorage.getItem(SpotifyAuthService.TOKEN_KEY);
    const expiry = localStorage.getItem(SpotifyAuthService.EXPIRY_KEY);

    if (!token || !expiry) {
      return null;
    }

    // Check if token is expired
    if (Date.now() > parseInt(expiry)) {
      this.clearToken();
      return null;
    }

    return token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null;
  }

  /**
   * Clear stored token
   */
  clearToken(): void {
    localStorage.removeItem(SpotifyAuthService.TOKEN_KEY);
    localStorage.removeItem(SpotifyAuthService.EXPIRY_KEY);
  }

  /**
   * Logout user
   */
  logout(): void {
    this.clearToken();
  }
}

export const spotifyAuthService = new SpotifyAuthService();
