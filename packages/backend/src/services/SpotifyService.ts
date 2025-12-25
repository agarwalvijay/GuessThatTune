import { SpotifyApi, AccessToken } from '@spotify/web-api-ts-sdk';
import {
  SpotifyPlaylist,
  SpotifyTrack,
  Song,
  SongMetadata,
} from '@song-quiz/shared';
import { randomUUID } from 'crypto';

export class SpotifyService {
  /**
   * Create Spotify API client with access token provided by the Quiz Master app
   */
  private createApiClient(accessToken: string): SpotifyApi {
    // Client ID not needed when using an existing access token
    return SpotifyApi.withAccessToken('', {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '',
    } as AccessToken);
  }

  /**
   * Get current user's playlists
   */
  async getUserPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
    const api = this.createApiClient(accessToken);
    console.log('Fetching playlists from Spotify API...');
    const response = await api.currentUser.playlists.playlists(50);
    console.log('Spotify API returned', response.items.length, 'playlists');
    console.log('Total playlists:', response.total);

    return response.items.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || undefined,
      images: playlist.images,
      tracks: {
        total: playlist.tracks?.total || 0,
      },
      owner: {
        id: playlist.owner.id,
        display_name: playlist.owner.display_name || 'Unknown',
      },
    }));
  }

  /**
   * Get tracks from a playlist
   */
  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<SpotifyTrack[]> {
    const api = this.createApiClient(accessToken);

    // Fetch all tracks (handle pagination)
    const tracks: SpotifyTrack[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const response = await api.playlists.getPlaylistItems(playlistId, undefined, undefined, limit, offset);

      response.items.forEach(item => {
        if (item.track && 'id' in item.track && item.track.id) {
          const track = item.track;
          tracks.push({
            id: track.id,
            uri: track.uri,
            name: track.name,
            artists: track.artists.map(artist => ({
              id: artist.id,
              name: artist.name,
            })),
            album: {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images,
            },
            duration_ms: track.duration_ms,
            preview_url: track.preview_url || undefined,
          });
        }
      });

      offset += limit;
      hasMore = response.items.length === limit;
    }

    return tracks;
  }

  /**
   * Convert Spotify tracks to Song objects
   */
  convertTracksToSongs(spotifyTracks: SpotifyTrack[]): Song[] {
    return spotifyTracks.map(track => {
        const artistNames = track.artists.map(a => a.name).join(', ');
        const imageUrl = track.album.images[0]?.url;

        const metadata: SongMetadata = {
          title: track.name,
          artist: artistNames,
          album: track.album.name,
          duration: Math.floor(track.duration_ms / 1000), // Convert to seconds
          imageUrl,
        };

        const song: Song = {
          id: randomUUID(),
          spotifyTrackId: track.id,
          spotifyUri: track.uri,
          metadata,
          answer: {
            title: track.name,
            artist: artistNames,
          },
          previewUrl: track.preview_url!,
        };

        return song;
      });
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(accessToken: string) {
    const api = this.createApiClient(accessToken);
    const user = await api.currentUser.profile();

    return {
      id: user.id,
      display_name: user.display_name || 'Unknown User',
      email: user.email,
      images: user.images || [],
    };
  }

}

// Singleton instance - no initialization needed since we don't handle OAuth
export const spotifyService = new SpotifyService();
