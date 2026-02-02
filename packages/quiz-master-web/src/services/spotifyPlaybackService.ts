import axios from 'axios';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
}

class SpotifyPlaybackService {
  private accessToken: string | null = null;
  private selectedDeviceId: string | null = null;

  /**
   * Initialize the playback service with access token
   */
  async initialize(accessToken: string): Promise<void> {
    this.accessToken = accessToken;
    console.log('✅ Spotify playback service initialized');
  }

  /**
   * Set the selected device ID
   */
  setSelectedDevice(deviceId: string): void {
    this.selectedDeviceId = deviceId;
    console.log('🎵 Selected device:', deviceId);
  }

  /**
   * Get available Spotify devices
   */
  async getDevices(): Promise<SpotifyDevice[]> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.data.devices;
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  }

  /**
   * Transfer playback to a specific device
   */
  private async transferPlayback(deviceId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      console.log('🔄 Transferring playback to device:', deviceId);
      await axios.put(
        'https://api.spotify.com/v1/me/player',
        {
          device_ids: [deviceId],
          play: false, // Don't start playing yet
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ Playback transferred successfully');
    } catch (error: any) {
      // Log but don't throw - we'll try to play anyway
      console.warn('⚠️ Could not transfer playback:', error.response?.data || error.message);
    }
  }

  /**
   * Play a song on user's Spotify device
   */
  async playSong(trackUri: string, startPositionMs: number = 0): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      // Get track details to validate duration
      const trackId = trackUri.split(':')[2];
      const trackResponse = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
      });

      const trackDurationMs = trackResponse.data.duration_ms;
      const trackName = trackResponse.data.name;

      console.log('🎵 Track:', trackName, '-', trackDurationMs / 1000 + 's');

      // Adjust start position if it exceeds track duration
      if (startPositionMs >= trackDurationMs) {
        console.warn('⚠️ Start position exceeds track duration, adjusting to 0');
        startPositionMs = 0;
      }

      // Get available devices
      let devices = await this.getDevices();
      console.log('📱 Available devices:', devices.length);

      // Log all detected devices for debugging
      devices.forEach(d => {
        console.log(`  - ${d.name} (${d.type}) - Active: ${d.is_active}`);
      });

      if (devices.length === 0) {
        throw new Error('No Spotify devices found. Please open Spotify on your phone or computer and try again.');
      }

      // Filter out inactive web players (they don't work for remote playback)
      const physicalDevices = devices.filter(d => {
        // Skip Computer type devices that look like web players
        if (d.type === 'Computer' && (d.name.includes('Web Player') || d.name.includes('Quiz'))) {
          console.log('⏭️ Skipping inactive web player:', d.name);
          return false;
        }
        return true;
      });

      console.log('📱 Physical devices available:', physicalDevices.length);

      if (physicalDevices.length === 0) {
        const deviceList = devices.map(d => `${d.name} (${d.type})`).join(', ');
        throw new Error(`No usable Spotify devices found.\n\nDetected devices: ${deviceList}\n\nPlease:\n1. Keep Spotify app open and playing\n2. Try again`);
      }

      // Find an active device or use the first available one
      let targetDevice = this.selectedDeviceId
        ? physicalDevices.find(d => d.id === this.selectedDeviceId)
        : physicalDevices.find(d => d.is_active) || physicalDevices[0];

      // If selected device not found, it might have become stale
      if (!targetDevice && this.selectedDeviceId) {
        console.warn('⚠️ Selected device not found, it may have become inactive');
        console.log('💡 Tip: Play a song briefly on your Spotify device to reactivate it');

        // Try to use any available device as fallback
        targetDevice = physicalDevices.find(d => d.is_active) || physicalDevices[0];

        if (targetDevice) {
          console.log('🔄 Using fallback device:', targetDevice.name);
        }
      }

      if (!targetDevice) {
        targetDevice = physicalDevices[0];
      }

      console.log('🎵 Using device:', targetDevice.name, `(${targetDevice.type})`);

      // Transfer playback to the device first to "wake it up"
      // This helps prevent mobile devices from becoming stale
      await this.transferPlayback(targetDevice.id);

      // Verify the position doesn't exceed track duration
      if (startPositionMs >= trackDurationMs) {
        console.warn('⚠️ Start position exceeds track duration, setting to 0');
        startPositionMs = 0;
      }

      // Start playback on the device
      console.log('▶️ Starting playback on device...');
      console.log('📊 Track URI:', trackUri);
      console.log('📊 Start position:', startPositionMs, 'ms (', Math.floor(startPositionMs / 1000), 'seconds )');
      console.log('📊 Track duration:', trackDurationMs, 'ms (', Math.floor(trackDurationMs / 1000), 'seconds )');

      const playbackPayload = {
        uris: [trackUri],
        position_ms: startPositionMs,
      };
      console.log('📤 Sending to Spotify:', JSON.stringify(playbackPayload, null, 2));

      await axios.put(
        `https://api.spotify.com/v1/me/player/play?device_id=${targetDevice.id}`,
        playbackPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.selectedDeviceId = targetDevice.id;
      console.log('✅ Playback command sent to', targetDevice.name);
    } catch (error: any) {
      console.error('❌ Error playing song:', error);
      if (error.response) {
        console.error('Spotify API Error:', {
          status: error.response.status,
          data: error.response.data,
        });
      }
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/pause',
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );
      console.log('⏸️ Playback paused');
    } catch (error: any) {
      // 404 and 403 are normal - means no active playback or already paused
      const status = error.response?.status;
      if (status !== 404 && status !== 403) {
        console.error('Error pausing playback:', error);
      }
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      await axios.put(
        'https://api.spotify.com/v1/me/player/play',
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
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
   * Set volume (0 to 100)
   */
  async setVolume(volume: number): Promise<void> {
    if (!this.accessToken) return;

    try {
      await axios.put(
        `https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  /**
   * Get current playback state
   */
  async getCurrentState(): Promise<any> {
    if (!this.accessToken) return null;

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204) {
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('Error getting playback state:', error);
      return null;
    }
  }

  /**
   * Disconnect - cleanup
   */
  disconnect(): void {
    this.selectedDeviceId = null;
  }
}

export const spotifyPlaybackService = new SpotifyPlaybackService();
