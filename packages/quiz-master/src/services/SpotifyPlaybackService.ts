import axios from 'axios';
import { Linking } from 'react-native';
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
      console.log('🔍 Fetching Spotify devices...');
      const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const devices = response.data.devices || [];
      console.log('✅ Devices API response:', devices.length, 'devices found');
      return devices;
    } catch (error: any) {
      console.error('❌ Error getting devices:', error.response?.status, error.response?.data || error.message);
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

      // Get track details to validate duration
      const trackId = trackUri.split(':')[2];
      const trackResponse = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const trackDurationMs = trackResponse.data.duration_ms;
      const trackDurationSec = trackDurationMs / 1000;
      const requestedStartSec = startPositionMs / 1000;

      console.log('📊 Track duration:', trackDurationSec, 'seconds');
      console.log('📊 Requested start:', requestedStartSec, 'seconds');

      // If requested start position is beyond the track duration, adjust it
      if (startPositionMs >= trackDurationMs) {
        console.warn('⚠️ Start position exceeds track duration, adjusting to 0');
        startPositionMs = 0;
      } else if (startPositionMs + (durationSeconds || 0) * 1000 > trackDurationMs) {
        // If start + duration exceeds track length, adjust start position
        const maxStartMs = Math.max(0, trackDurationMs - (durationSeconds || 30) * 1000);
        console.warn(`⚠️ Start position + duration exceeds track, adjusting to ${maxStartMs / 1000}s`);
        startPositionMs = maxStartMs;
      }

      // Get available devices
      let devices = await this.getDevices();
      console.log('📱 Available Spotify devices:', devices.length);
      devices.forEach(device => {
        console.log(`  - ${device.name} (${device.type}) - Active: ${device.is_active}`);
      });

      // If no devices found, try to open Spotify and check again
      if (devices.length === 0) {
        console.log('🎵 No devices found, attempting to open Spotify...');

        try {
          // Open Spotify app
          const spotifyUrl = 'spotify://';
          const canOpen = await Linking.canOpenURL(spotifyUrl);

          if (canOpen) {
            await Linking.openURL(spotifyUrl);
            console.log('✅ Opened Spotify app, waiting for device to be available...');

            // Poll for devices with multiple retries
            let attempts = 0;
            const maxAttempts = 6;

            while (attempts < maxAttempts && devices.length === 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              devices = await this.getDevices();
              attempts++;
              console.log(`🔄 Retry ${attempts}/${maxAttempts}: ${devices.length} devices found`);
            }

            if (devices.length === 0) {
              throw new Error('Spotify is open but no devices detected.\n\nPlease:\n1. Make sure you\'re logged into the same account\n2. Play any song in Spotify briefly\n3. Then return here and try again');
            }

            console.log('✅ Device found after', attempts, 'attempts');
          } else {
            throw new Error('Spotify app is not installed on this device.\n\nPlease install Spotify or open it on another device (phone/computer).');
          }
        } catch (launchError: any) {
          if (launchError.message.includes('Spotify')) {
            throw launchError;
          }
          throw new Error('Could not open Spotify automatically.\n\nPlease open Spotify manually and try again.');
        }
      }

      // Find an active device or use the first available one
      let targetDevice = deviceId
        ? devices.find(d => d.id === deviceId)
        : devices.find(d => d.is_active) || devices[0];

      if (!targetDevice) {
        throw new Error('No suitable Spotify device found.');
      }

      console.log('🎵 Using Spotify device:', targetDevice.name);

      // Always transfer playback to ensure device is ready, even if marked as active
      console.log('📱 Transferring playback to device:', targetDevice.name);
      await this.transferPlayback(targetDevice.id, false);
      console.log('⏳ Waiting for device to be ready...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start playback with retry logic
      const url = `https://api.spotify.com/v1/me/player/play?device_id=${targetDevice.id}`;
      let playbackStarted = false;
      let lastError;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
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
          playbackStarted = true;
          break;
        } catch (error: any) {
          lastError = error;
          if (error.response?.status === 404 && attempt === 1) {
            console.log('⚠️ 404 error, device not ready yet. Retrying...');
            // Device exists but not ready, wait and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

      if (!playbackStarted && lastError) {
        throw lastError;
      }

      console.log('✅ Playback started:', trackUri);
      console.log('Start position:', startPositionMs / 1000, 'seconds');

      // Verify playback actually started by checking state
      setTimeout(async () => {
        const state = await this.getPlaybackState();
        if (state) {
          console.log('🔊 Playback verification - is_playing:', state.is_playing);
          console.log('🔊 Current progress:', state.progress_ms / 1000, 'seconds');
        } else {
          console.log('⚠️ No playback state found after starting');
        }
      }, 1000);

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
    } catch (error: any) {
      // 404 means no active playback - this is fine, nothing to pause
      if (error.response?.status === 404) {
        console.log('ℹ️ No active playback to pause (404) - this is fine');
        return;
      }
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
