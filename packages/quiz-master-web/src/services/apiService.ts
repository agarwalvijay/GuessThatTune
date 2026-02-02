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
   * Fetch user's Spotify playlists (including followed playlists)
   */
  async fetchPlaylists(accessToken: string): Promise<Playlist[]> {
    let allPlaylists: any[] = [];
    let url = 'https://api.spotify.com/v1/me/playlists';
    let hasMore = true;

    // Fetch all pages of playlists
    while (hasMore && url) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          limit: 50,
        },
      });

      allPlaylists = allPlaylists.concat(response.data.items);

      // Check if there are more pages
      url = response.data.next;
      hasMore = !!url;
    }

    console.log(`✅ Fetched ${allPlaylists.length} total playlists (owned and followed)`);

    return allPlaylists.map((playlist: any) => ({
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
        imageUrl: item.track.album.images?.[0]?.url || undefined, // Album artwork
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
      negativePointsPercentage: number;
    };
  }): Promise<GameSession> {
    // Transform songs to match backend expected format
    const transformedSongs = data.songs.map(song => ({
      id: song.id,
      spotifyTrackId: song.id,
      spotifyUri: song.spotifyUri,
      metadata: {
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        duration: song.durationMs ? Math.floor(song.durationMs / 1000) : 180, // Convert ms to seconds
        imageUrl: song.imageUrl || undefined,
      },
      answer: {
        title: song.title || '',
        artist: song.artist || '',
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
   * Mark an answer as incorrect and deduct points
   */
  async markIncorrect(sessionId: string, roundId: string, participantId: string): Promise<void> {
    await this.api.post(`/api/game/${sessionId}/incorrect`, {
      roundId,
      participantId,
    });
  }

  /**
   * Advance to the next round
   */
  async nextRound(sessionId: string): Promise<{ gameComplete: boolean; session?: GameSession }> {
    const response = await this.api.post(`/api/game/${sessionId}/next`);
    return response.data;
  }

  /**
   * End the game session
   */
  async endGameSession(sessionId: string): Promise<{ session: GameSession; finalScores: any[] }> {
    const response = await this.api.post(`/api/game/${sessionId}/end`);
    return response.data;
  }

  /**
   * Restart a game session with the same participants
   */
  async restartGameSession(sessionId: string, songs: Song[]): Promise<GameSession> {
    // Transform songs to match backend expected format
    const transformedSongs = songs.map(song => ({
      id: song.id,
      spotifyTrackId: song.id,
      spotifyUri: song.spotifyUri,
      metadata: {
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        duration: song.durationMs ? Math.floor(song.durationMs / 1000) : 180,
        imageUrl: song.imageUrl || undefined,
      },
      answer: {
        title: song.title || '',
        artist: song.artist || '',
      },
      previewUrl: song.previewUrl,
    }));

    const response = await this.api.post(`/api/game/${sessionId}/restart`, {
      songs: transformedSongs,
    });
    return response.data.session;
  }
}

export const apiService = new ApiService();
