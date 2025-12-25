import { authorize, refresh, AuthorizeResult } from 'react-native-app-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config/environment';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@spotify_access_token',
  REFRESH_TOKEN: '@spotify_refresh_token',
  EXPIRES_AT: '@spotify_expires_at',
};

export interface SpotifyAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class SpotifyAuthService {
  private authConfig = {
    clientId: config.spotify.clientId,
    redirectUrl: config.spotify.redirectUrl,
    scopes: config.spotify.scopes,
    serviceConfiguration: {
      authorizationEndpoint: 'https://accounts.spotify.com/authorize',
      tokenEndpoint: 'https://accounts.spotify.com/api/token',
    },
  };

  /**
   * Authenticate with Spotify using OAuth
   */
  async authenticate(): Promise<SpotifyAuthTokens> {
    try {
      const result: AuthorizeResult = await authorize(this.authConfig);

      const tokens: SpotifyAuthTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: Date.now() + (result.accessTokenExpirationDate ? new Date(result.accessTokenExpirationDate).getTime() - Date.now() : 3600 * 1000),
      };

      // Store tokens securely
      await this.storeTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('Spotify authentication error:', error);
      throw new Error('Failed to authenticate with Spotify');
    }
  }

  /**
   * Get current access token (refresh if expired)
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getStoredTokens();

    if (!tokens) {
      return null;
    }

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt - 60000) { // Refresh 1 min before expiry
      const newTokens = await this.refreshAccessToken();
      return newTokens?.accessToken || null;
    }

    return tokens.accessToken;
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<SpotifyAuthTokens | null> {
    try {
      const storedTokens = await this.getStoredTokens();

      if (!storedTokens?.refreshToken) {
        return null;
      }

      const result = await refresh(this.authConfig, {
        refreshToken: storedTokens.refreshToken,
      });

      const tokens: SpotifyAuthTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || storedTokens.refreshToken,
        expiresAt: Date.now() + 3600 * 1000, // 1 hour
      };

      await this.storeTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.clearTokens();
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getStoredTokens();
    return tokens !== null;
  }

  /**
   * Logout (clear stored tokens)
   */
  async logout(): Promise<void> {
    await this.clearTokens();
  }

  /**
   * Store tokens securely
   */
  private async storeTokens(tokens: SpotifyAuthTokens): Promise<void> {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken],
      [STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken],
      [STORAGE_KEYS.EXPIRES_AT, tokens.expiresAt.toString()],
    ]);
  }

  /**
   * Get stored tokens
   */
  private async getStoredTokens(): Promise<SpotifyAuthTokens | null> {
    try {
      const [[, accessToken], [, refreshToken], [, expiresAt]] = await AsyncStorage.multiGet([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.EXPIRES_AT,
      ]);

      if (!accessToken || !refreshToken || !expiresAt) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: parseInt(expiresAt, 10),
      };
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      return null;
    }
  }

  /**
   * Clear stored tokens
   */
  private async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.EXPIRES_AT,
    ]);
  }
}

export const spotifyAuthService = new SpotifyAuthService();
