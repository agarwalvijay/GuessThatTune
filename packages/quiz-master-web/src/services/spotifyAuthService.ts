import { config } from '../config/environment';

class SpotifyAuthService {
  private static readonly TOKEN_KEY = 'spotify_access_token';
  private static readonly EXPIRY_KEY = 'spotify_token_expiry';
  private static readonly REFRESH_KEY = 'spotify_refresh_token';
  private static readonly CODE_VERIFIER_KEY = 'spotify_code_verifier';
  // Refresh when the token has less than this much life left
  private static readonly REFRESH_THRESHOLD_MS = 60_000;

  private refreshInFlight: Promise<string | null> | null = null;

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
      const refreshToken = data.refresh_token;

      if (accessToken && expiresIn) {
        const expiryTime = Date.now() + expiresIn * 1000;
        this.saveToken(accessToken, expiryTime, refreshToken);

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
  private saveToken(token: string, expiryTime: number, refreshToken?: string): void {
    localStorage.setItem(SpotifyAuthService.TOKEN_KEY, token);
    localStorage.setItem(SpotifyAuthService.EXPIRY_KEY, expiryTime.toString());
    if (refreshToken) {
      localStorage.setItem(SpotifyAuthService.REFRESH_KEY, refreshToken);
    }
  }

  /**
   * Synchronously read the cached token without refreshing.
   * Returns null if missing or fully expired (no grace window).
   */
  getAccessToken(): string | null {
    const token = localStorage.getItem(SpotifyAuthService.TOKEN_KEY);
    const expiry = localStorage.getItem(SpotifyAuthService.EXPIRY_KEY);

    if (!token || !expiry) {
      return null;
    }

    if (Date.now() > parseInt(expiry)) {
      // Don't clear here — caller may want to refresh. ensureAccessToken handles that.
      return null;
    }

    return token;
  }

  /**
   * Returns a usable access token, refreshing in the background when it's
   * within REFRESH_THRESHOLD_MS of expiry. Use this in long-running flows
   * (e.g. mid-game playback) instead of getAccessToken().
   */
  async ensureAccessToken(): Promise<string | null> {
    const token = localStorage.getItem(SpotifyAuthService.TOKEN_KEY);
    const expiry = localStorage.getItem(SpotifyAuthService.EXPIRY_KEY);

    if (token && expiry) {
      const msLeft = parseInt(expiry) - Date.now();
      if (msLeft > SpotifyAuthService.REFRESH_THRESHOLD_MS) {
        return token;
      }
    }

    return this.refreshAccessToken();
  }

  /**
   * Exchange the stored refresh token for a fresh access token. Coalesces
   * concurrent calls so we don't burn through Spotify's refresh quota.
   */
  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = localStorage.getItem(SpotifyAuthService.REFRESH_KEY);
    if (!refreshToken) {
      return null;
    }

    this.refreshInFlight = (async () => {
      try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: config.spotify.clientId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Token refresh failed:', errorData);
          // Spotify can rotate or invalidate refresh tokens; force re-login.
          this.clearToken();
          return null;
        }

        const data = await response.json();
        const accessToken = data.access_token;
        const expiresIn = data.expires_in;
        // Spotify may or may not return a new refresh_token; reuse old if not.
        const newRefresh = data.refresh_token || refreshToken;

        if (accessToken && expiresIn) {
          const expiryTime = Date.now() + expiresIn * 1000;
          this.saveToken(accessToken, expiryTime, newRefresh);
          return accessToken;
        }

        return null;
      } catch (error) {
        console.error('Error refreshing token:', error);
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  /**
   * Fetch the user's profile to determine product tier ('premium' | 'free' | 'open').
   * Spotify Connect playback (`/me/player/play`) requires premium, so this lets
   * us warn up-front instead of failing mid-game.
   */
  async fetchUserProduct(): Promise<string | null> {
    const token = await this.ensureAccessToken();
    if (!token) return null;
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.product || null;
    } catch (error) {
      console.error('Error fetching user product:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null
      || localStorage.getItem(SpotifyAuthService.REFRESH_KEY) !== null;
  }

  /**
   * Clear stored token
   */
  clearToken(): void {
    localStorage.removeItem(SpotifyAuthService.TOKEN_KEY);
    localStorage.removeItem(SpotifyAuthService.EXPIRY_KEY);
    localStorage.removeItem(SpotifyAuthService.REFRESH_KEY);
  }

  /**
   * Logout user
   */
  logout(): void {
    this.clearToken();
  }
}

export const spotifyAuthService = new SpotifyAuthService();
