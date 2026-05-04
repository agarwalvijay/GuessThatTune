import axios from 'axios';
import { spotifyAuthService } from './spotifyAuthService';

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
}

interface LastPlayed {
  uri: string;
  // Position within the track (ms) at the moment we last started/resumed playback.
  positionMs: number;
  // wall-clock ms when that position was current — used to estimate position on resume fallback.
  startedAtWallMs: number;
}

class SpotifyPlaybackService {
  private selectedDeviceId: string | null = null;
  private lastPlayed: LastPlayed | null = null;

  /**
   * Initialize the playback service. Token is fetched on demand from
   * spotifyAuthService so it always reflects the latest refresh.
   */
  async initialize(_accessToken?: string): Promise<void> {
    console.log('✅ Spotify playback service initialized');
  }

  setSelectedDevice(deviceId: string): void {
    this.selectedDeviceId = deviceId;
    console.log('🎵 Selected device:', deviceId);
  }

  getSelectedDeviceId(): string | null {
    return this.selectedDeviceId;
  }

  private async getToken(): Promise<string> {
    const token = await spotifyAuthService.ensureAccessToken();
    if (!token) {
      throw new Error('Spotify session expired. Please log in again.');
    }
    return token;
  }

  /**
   * Get available Spotify devices
   */
  async getDevices(): Promise<SpotifyDevice[]> {
    const token = await this.getToken();
    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player/devices', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return response.data.devices;
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  }

  /**
   * Filter the device list to those we can actually play on. Restricted devices
   * (cars, some smart speakers) reject /me/player/play, so they're never useful.
   * Inactive in-browser SDK players are kept only as a last resort.
   */
  private usableDevices(devices: SpotifyDevice[]): SpotifyDevice[] {
    const playable = devices.filter(d => !d.is_restricted);
    const real = playable.filter(d => !this.looksLikeIdleWebPlayer(d));
    return real.length > 0 ? real : playable;
  }

  private looksLikeIdleWebPlayer(d: SpotifyDevice): boolean {
    if (d.is_active) return false;
    // The Spotify Web Playback SDK registers as type "Computer" with a name set
    // by the page that loaded it. We don't run the SDK, so any inactive web
    // player belongs to a stale tab and won't accept transfers.
    return d.type === 'Computer' && /web player/i.test(d.name);
  }

  /**
   * Transfer playback to a specific device
   */
  private async transferPlayback(deviceId: string, play: boolean = false): Promise<void> {
    const token = await this.getToken();
    try {
      console.log('🔄 Transferring playback to device:', deviceId);
      await axios.put(
        'https://api.spotify.com/v1/me/player',
        { device_ids: [deviceId], play },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('✅ Playback transferred successfully');
    } catch (error: any) {
      console.error('❌ Could not transfer playback:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Pick the device we should play on, given the current device list and the
   * user's selection. Returns null if nothing usable is available.
   */
  private chooseDevice(devices: SpotifyDevice[]): SpotifyDevice | null {
    const usable = this.usableDevices(devices);
    if (usable.length === 0) return null;

    if (this.selectedDeviceId) {
      const match = usable.find(d => d.id === this.selectedDeviceId);
      if (match) return match;
      console.warn('⚠️ Selected device not in usable list, falling back');
    }

    return usable.find(d => d.is_active) || usable[0];
  }

  /**
   * Play a song on user's Spotify device
   */
  async playSong(trackUri: string, startPositionMs: number = 0): Promise<void> {
    const token = await this.getToken();

    try {
      const trackId = trackUri.split(':')[2];
      const trackResponse = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const trackDurationMs = trackResponse.data.duration_ms;
      const trackName = trackResponse.data.name;
      console.log('🎵 Track:', trackName, '-', trackDurationMs / 1000 + 's');

      if (startPositionMs >= trackDurationMs) {
        console.warn('⚠️ Start position exceeds track duration, adjusting to 0');
        startPositionMs = 0;
      }

      let devices = await this.getDevices();
      console.log('📱 Available devices:', devices.length);
      devices.forEach(d => console.log(`  - ${d.name} (${d.type}) - Active: ${d.is_active}, Restricted: ${d.is_restricted}`));

      if (devices.length === 0) {
        throw new Error('No Spotify devices found. Please open Spotify on your phone or computer and try again.');
      }

      let targetDevice = this.chooseDevice(devices);
      if (!targetDevice) {
        const deviceList = devices.map(d => `${d.name} (${d.type}${d.is_restricted ? ', restricted' : ''})`).join(', ');
        throw new Error(`No usable Spotify devices found.\n\nDetected devices: ${deviceList}\n\nPlease:\n1. Keep Spotify app open and playing\n2. Try again`);
      }

      console.log('🎵 Using device:', targetDevice.name, `(${targetDevice.type})`);

      // Transfer with play:true to wake the device — particularly important on iOS Connect.
      await this.transferPlayback(targetDevice.id, true);

      const playbackPayload = {
        uris: [trackUri],
        position_ms: startPositionMs,
      };
      console.log('▶️ Starting playback', JSON.stringify(playbackPayload));

      // Robust retry: Spotify needs anywhere from a few hundred ms to a couple of
      // seconds after a transfer before /me/player/play succeeds, especially when
      // the target device is on cellular or has been idle. Backoff and re-fetch
      // the device list on each retry in case the device's id changed.
      const backoffsMs = [250, 500, 1000, 1500, 2000];
      let lastError: any = null;
      let activeDeviceId = targetDevice.id;

      for (let attempt = 0; attempt < backoffsMs.length; attempt++) {
        try {
          const playToken = await this.getToken();
          await axios.put(
            `https://api.spotify.com/v1/me/player/play?device_id=${activeDeviceId}`,
            playbackPayload,
            {
              headers: {
                'Authorization': `Bearer ${playToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
          lastError = null;
          targetDevice = { ...targetDevice, id: activeDeviceId };
          break;
        } catch (error: any) {
          lastError = error;
          const status = error.response?.status;
          console.warn(`⚠️ Play attempt ${attempt + 1} failed (status ${status})`, error.response?.data || error.message);
          await new Promise(resolve => setTimeout(resolve, backoffsMs[attempt]));

          // Re-fetch device list and re-pick — the device may have re-registered
          // under a new id while we waited, or come online if it was waking up.
          if (attempt < backoffsMs.length - 1) {
            const refreshed = await this.getDevices();
            const repicked = this.chooseDevice(refreshed);
            if (repicked) {
              if (repicked.id !== activeDeviceId) {
                console.log('🔄 Device id changed, switching to:', repicked.name);
                activeDeviceId = repicked.id;
                try {
                  await this.transferPlayback(activeDeviceId, true);
                } catch {
                  // fall through to next play attempt
                }
              }
            }
          }
        }
      }

      if (lastError) throw lastError;

      this.selectedDeviceId = activeDeviceId;
      this.lastPlayed = {
        uri: trackUri,
        positionMs: startPositionMs,
        startedAtWallMs: Date.now(),
      };
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
    let token: string;
    try {
      token = await this.getToken();
    } catch {
      // no session — nothing to pause
      return;
    }

    try {
      const url = this.selectedDeviceId
        ? `https://api.spotify.com/v1/me/player/pause?device_id=${this.selectedDeviceId}`
        : 'https://api.spotify.com/v1/me/player/pause';
      await axios.put(url, {}, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      // Snapshot position so resume() can replay if Spotify dropped the context.
      if (this.lastPlayed) {
        const elapsed = Date.now() - this.lastPlayed.startedAtWallMs;
        this.lastPlayed = {
          ...this.lastPlayed,
          positionMs: this.lastPlayed.positionMs + elapsed,
          startedAtWallMs: Date.now(),
        };
      }

      console.log('⏸️ Playback paused');
    } catch (error: any) {
      // 404 and 403 are normal — no active playback or already paused
      const status = error.response?.status;
      if (status !== 404 && status !== 403) {
        console.error('Error pausing playback:', error);
      }
    }
  }

  /**
   * Resume playback. Sends device_id so Spotify knows where to resume; if the
   * device has since lost the playback context (404), replays the last known
   * track at the position we paused at.
   */
  async resume(): Promise<void> {
    const token = await this.getToken();

    const tryResume = async (): Promise<boolean> => {
      try {
        const url = this.selectedDeviceId
          ? `https://api.spotify.com/v1/me/player/play?device_id=${this.selectedDeviceId}`
          : 'https://api.spotify.com/v1/me/player/play';
        await axios.put(url, {}, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        console.log('▶️ Playback resumed');
        return true;
      } catch (error: any) {
        const status = error.response?.status;
        if (status === 404) {
          console.warn('⚠️ Resume got 404 — playback context lost on device');
          return false;
        }
        console.error('Error resuming playback:', error);
        throw error;
      }
    };

    if (await tryResume()) return;

    // Fallback: replay the last track we started, from the saved position.
    if (this.lastPlayed) {
      console.log('🔁 Falling back to replay last track at saved position');
      await this.playSong(this.lastPlayed.uri, this.lastPlayed.positionMs);
      return;
    }

    throw new Error('Could not resume playback (no prior track to replay).');
  }

  /**
   * Set volume (0 to 100)
   */
  async setVolume(volume: number): Promise<void> {
    let token: string;
    try {
      token = await this.getToken();
    } catch {
      return;
    }

    try {
      await axios.put(
        `https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  /**
   * Get current playback state
   */
  async getCurrentState(): Promise<any> {
    let token: string;
    try {
      token = await this.getToken();
    } catch {
      return null;
    }

    try {
      const response = await axios.get('https://api.spotify.com/v1/me/player', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.status === 204) return null;
      return response.data;
    } catch (error) {
      console.error('Error getting playback state:', error);
      return null;
    }
  }

  disconnect(): void {
    this.selectedDeviceId = null;
    this.lastPlayed = null;
  }
}

export const spotifyPlaybackService = new SpotifyPlaybackService();
