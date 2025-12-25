import axios from 'axios';
import { spotifyAuthService } from './SpotifyAuthService';

interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

interface PlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item?: {
    uri: string;
    duration_ms: number;
  };
}

class SpotifyPlaybackService {
  private stopTimer: NodeJS.Timeout | null = null;
  private currentTrackUri: string | null = null;

  /**
   * Get available Spotify devices
   */
  async getDevices(): Promise<SpotifyDevice[]> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.data.devices || [];
    } catch (error) {
      console.error('Error getting devices:', error);
      throw error;
    }
  }

  /**
   * Play a track on Spotify with optional start position
   * @param trackUri - Spotify track URI (e.g., spotify:track:xxx)
   * @param deviceId - Optional device ID to play on
   * @param startPositionMs - Start position in milliseconds
   * @param durationSeconds - How long to play for (will auto-pause after this duration)
   */
  async play(
    trackUri: string,
    deviceId?: string,
    startPositionMs: number = 0,
    durationSeconds?: number
  ): Promise<void> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) {
      throw new Error('No access token available');
    }

    try {
      // Stop any existing playback timer
      this.stop();

      this.currentTrackUri = trackUri;

      // Get available devices
      const devices = await this.getDevices();

      if (devices.length === 0) {
        throw new Error('No Spotify devices found. Please open Spotify on your phone or computer first.');
      }

      // Find an active device or use the first available one
      let targetDevice = deviceId
        ? devices.find(d => d.id === deviceId)
        : devices.find(d => d.is_active) || devices[0];

      if (!targetDevice) {
        throw new Error('No suitable Spotify device found.');
      }

      console.log('🎵 Using Spotify device:', targetDevice.name);

      // If device is not active, we need to transfer playback to it first
      if (!targetDevice.is_active) {
        console.log('📱 Transferring playback to device:', targetDevice.name);
        await this.transferPlayback(targetDevice.id, true);
        // Wait a moment for transfer to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Start playback
      const url = `https://api.spotify.com/v1/me/player/play?device_id=${targetDevice.id}`;

      await axios.put(
        url,
        {
          uris: [trackUri],
          position_ms: startPositionMs,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Playback started:', trackUri);
      console.log('Start position:', startPositionMs / 1000, 'seconds');

      // Set up auto-pause if duration is specified
      if (durationSeconds) {
        console.log('Will auto-pause after:', durationSeconds, 'seconds');
        this.stopTimer = setTimeout(() => {
          console.log('⏸️ Auto-pausing after duration');
          this.pause();
        }, durationSeconds * 1000);
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Spotify Premium is required for playback control.');
      }
      console.error('Error starting playback:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Transfer playback to a specific device
   */
  private async transferPlayback(deviceId: string, play: boolean = false): Promise<void> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) return;

    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player',
        {
          device_ids: [deviceId],
          play,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Error transferring playback:', error);
      throw error;
    }
  }

  /**
   * Pause current playback
   */
  async pause(): Promise<void> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) return;

    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/pause',
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      console.log('⏸️ Playback paused');
    } catch (error) {
      console.error('Error pausing playback:', error);
      throw error;
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) return;

    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        {},
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      console.log('▶️ Playback resumed');
    } catch (error) {
      console.error('Error resuming playback:', error);
      throw error;
    }
  }

  /**
   * Stop playback and cleanup
   */
  stop(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.currentTrackUri = null;
  }

  /**
   * Get current playback state
   */
  async getPlaybackState(): Promise<PlaybackState | null> {
    const accessToken = await spotifyAuthService.getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.status === 204) {
        // No content - no active playback
        return null;
      }

      return {
        is_playing: response.data.is_playing,
        progress_ms: response.data.progress_ms,
        item: response.data.item ? {
          uri: response.data.item.uri,
          duration_ms: response.data.item.duration_ms,
        } : undefined,
      };
    } catch (error) {
      console.error('Error getting playback state:', error);
      return null;
    }
  }
}

export const spotifyPlaybackService = new SpotifyPlaybackService();
