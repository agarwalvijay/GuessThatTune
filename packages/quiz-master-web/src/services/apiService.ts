import axios, { type AxiosInstance } from 'axios';
import { config } from '../config/environment';
import type { Song, GameSession, Playlist } from '../store/appStore';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.backendUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch user's Spotify playlists
   */
  async fetchPlaylists(accessToken: string): Promise<Playlist[]> {
    const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      params: {
        limit: 50,
      },
    });

    return response.data.items.map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      images: playlist.images,
      tracks: { total: playlist.tracks.total },
    }));
  }

  /**
   * Fetch songs from a playlist
   */
  async fetchPlaylistSongs(playlistId: string, accessToken: string): Promise<Song[]> {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          limit: 100,
          market: 'from_token', // Use user's market
        },
      }
    );

    const allTracks = response.data.items
      .filter((item: any) => {
        // Filter out null tracks, podcasts, and unplayable tracks
        if (!item.track || !item.track.id) {
          console.log('⏭️ Skipping: null track');
          return false;
        }
        if (item.track.type !== 'track') {
          console.log('⏭️ Skipping: not a track (type:', item.track.type, ')');
          return false;
        }
        if (item.track.is_playable === false) {
          console.log('⏭️ Skipping unplayable track:', item.track.name);
          return false;
        }
        return true;
      })
      .map((item: any) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists[0]?.name || 'Unknown',
        album: item.track.album.name,
        spotifyUri: item.track.uri,
        previewUrl: item.track.preview_url || undefined,
        durationMs: item.track.duration_ms,
      }));

    console.log(`✅ Found ${allTracks.length} playable tracks in playlist`);
    return allTracks;
  }

  /**
   * Create a new game session
   */
  async createGameSession(data: {
    hostName: string;
    playlistId: string;
    playlistName: string;
    songs: Song[];
    settings: {
      songDuration: number;
      numberOfSongs: number;
    };
  }): Promise<GameSession> {
    // Transform songs to match backend expected format
    const transformedSongs = data.songs.map(song => ({
      id: song.id,
      spotifyTrackId: song.id,
      spotifyUri: song.spotifyUri,
      metadata: {
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: Math.floor(song.durationMs / 1000), // Convert ms to seconds
      },
      answer: {
        title: song.title,
        artist: song.artist,
      },
      previewUrl: song.previewUrl,
    }));

    const response = await this.api.post('/api/game/create', {
      ...data,
      songs: transformedSongs,
    });
    return response.data.session;
  }

  /**
   * Start a game session
   */
  async startGameSession(sessionId: string): Promise<void> {
    await this.api.post(`/api/game/${sessionId}/start`);
  }

  /**
   * Get game session details
   */
  async getGameSession(sessionId: string): Promise<GameSession> {
    const response = await this.api.get(`/api/game/${sessionId}`);
    return response.data.session;
  }

  /**
   * Submit an answer for the current round
   */
  async submitAnswer(sessionId: string, participantId: string, answer: string): Promise<void> {
    await this.api.post(`/api/game/${sessionId}/answer`, {
      participantId,
      answer,
    });
  }

  /**
   * Award points to a participant for a round
   */
  async awardPoints(sessionId: string, roundId: string, participantId: string): Promise<void> {
    await this.api.post(`/api/game/${sessionId}/score`, {
      roundId,
      participantId,
    });
  }

  /**
   * Advance to the next round
   */
  async nextRound(sessionId: string): Promise<{ gameComplete: boolean }> {
    const response = await this.api.post(`/api/game/${sessionId}/next`);
    return response.data;
  }

  /**
   * End the game session
   */
  async endGameSession(sessionId: string): Promise<void> {
    await this.api.post(`/api/game/${sessionId}/end`);
  }
}

export const apiService = new ApiService();
