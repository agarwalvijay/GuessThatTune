import axios, { AxiosInstance } from 'axios';
import { SpotifyPlaylist, Song, SpotifyUser } from '@song-quiz/shared';
import config from '../config/environment';
import { spotifyAuthService } from './SpotifyAuthService';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.backendUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include Spotify access token
    this.client.interceptors.request.use(
      async (config) => {
        const accessToken = await spotifyAuthService.getAccessToken();
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        console.log('Access token available:', !!accessToken);
        if (accessToken) {
          console.log('Access token (first 20 chars):', accessToken.substring(0, 20) + '...');
          config.headers.Authorization = `Bearer ${accessToken}`;
        } else {
          console.warn('No access token available for request');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const newToken = await spotifyAuthService.refreshAccessToken();
          if (newToken) {
            // Retry the request with new token
            error.config.headers.Authorization = `Bearer ${newToken.accessToken}`;
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get user's Spotify playlists
   */
  async getPlaylists(): Promise<SpotifyPlaylist[]> {
    const response = await this.client.get<{ playlists: SpotifyPlaylist[] }>('/api/spotify/playlists');
    console.log('Backend response:', JSON.stringify(response.data, null, 2));
    return response.data.playlists;
  }

  /**
   * Get tracks from a specific playlist
   */
  async getPlaylistTracks(playlistId: string): Promise<Song[]> {
    const response = await this.client.get<{ songs: Song[]; count: number }>(
      `/api/spotify/playlist/${playlistId}/tracks`
    );
    return response.data.songs;
  }

  /**
   * Get current Spotify user profile
   */
  async getCurrentUser(): Promise<SpotifyUser> {
    const response = await this.client.get<{ user: SpotifyUser }>('/api/spotify/user');
    return response.data.user;
  }

  /**
   * Create a new game session
   */
  async createGameSession(songs: Song[], spotifyAccessToken: string, spotifyPlaylistId?: string) {
    const response = await this.client.post('/api/game/create', {
      songs,
      spotifyAccessToken,
      spotifyPlaylistId,
    });
    return response.data;
  }

  /**
   * Get game session details
   */
  async getGameSession(sessionId: string) {
    const response = await this.client.get(`/api/game/${sessionId}`);
    return response.data;
  }

  /**
   * Start the game
   */
  async startGame(sessionId: string) {
    const response = await this.client.post(`/api/game/${sessionId}/start`);
    return response.data;
  }

  /**
   * Start next round
   */
  async nextRound(sessionId: string) {
    const response = await this.client.post(`/api/game/${sessionId}/next`);
    return response.data;
  }

  /**
   * Award points to a participant
   */
  async awardPoints(sessionId: string, roundId: string, participantId: string) {
    const response = await this.client.post(`/api/game/${sessionId}/score`, {
      roundId,
      participantId,
    });
    return response.data;
  }

  /**
   * End the game
   */
  async endGame(sessionId: string) {
    const response = await this.client.post(`/api/game/${sessionId}/end`);
    return response.data;
  }

  /**
   * Restart the game with the same session ID
   */
  async restartGame(sessionId: string, songs: Song[]) {
    const response = await this.client.post(`/api/game/${sessionId}/restart`, {
      songs,
    });
    return response.data;
  }
}

export const apiService = new ApiService();
