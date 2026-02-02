// Spotify Web Playback SDK Type Definitions
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, callback: (data: any) => void): void;
  removeListener(event: string, callback?: (data: any) => void): void;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

interface SpotifyPlaybackState {
  context: {
    uri: string | null;
    metadata: any;
  };
  disallows: {
    pausing: boolean;
    peeking_next: boolean;
    peeking_prev: boolean;
    resuming: boolean;
    seeking: boolean;
    skipping_next: boolean;
    skipping_prev: boolean;
  };
  paused: boolean;
  position: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: {
      uri: string;
      id: string;
      type: string;
      media_type: string;
      name: string;
      is_playable: boolean;
      album: {
        uri: string;
        name: string;
        images: Array<{ url: string }>;
      };
      artists: Array<{ uri: string; name: string }>;
    };
    previous_tracks: any[];
    next_tracks: any[];
  };
}

class SpotifyPlaybackService {
  private accessToken: string | null = null;
  private player: SpotifyPlayer | null = null;
  private deviceId: string | null = null;
  private sdkReady: boolean = false;
  private maxInitializationAttempts: number = 3;

  /**
   * Initialize the playback service with access token
   */
  async initialize(accessToken: string): Promise<void> {
    this.accessToken = accessToken;

    // If player already exists and is ready, reuse it (fast path)
    if (this.player && this.deviceId) {
      console.log('♻️ Reusing existing player:', this.deviceId.substring(0, 8) + '...');
      return;
    }

    console.log('🎵 Initializing Spotify Web Playback SDK...');

    // Wait for SDK to be ready
    await this.waitForSDK();

    // Initialize the player with retry logic
    await this.initializePlayerWithRetry();
  }

  /**
   * Initialize player with retry logic (up to 3 attempts)
   */
  private async initializePlayerWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= this.maxInitializationAttempts; attempt++) {
      console.log(`🔄 Device initialization attempt ${attempt}/${this.maxInitializationAttempts}`);

      try {
        await this.initializePlayer();
        console.log(`✅ Device initialized successfully on attempt ${attempt}`);
        return; // Success!
      } catch (error) {
        console.error(`❌ Initialization attempt ${attempt} failed:`, error);

        // Clean up failed attempt
        if (this.player) {
          this.player.disconnect();
          this.player = null;
          this.deviceId = null;
        }

        // If this was the last attempt, throw
        if (attempt === this.maxInitializationAttempts) {
          throw new Error(`Failed to initialize Spotify player after ${this.maxInitializationAttempts} attempts. Please refresh the page and try again.`);
        }

        // Wait before next attempt
        console.log(`⏳ Waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  /**
   * Wait for Spotify SDK to be loaded
   */
  private waitForSDK(): Promise<void> {
    if (this.sdkReady || window.Spotify) {
      this.sdkReady = true;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log('✅ Spotify Web Playback SDK ready');
        this.sdkReady = true;
        resolve();
      };
    });
  }

  /**
   * Initialize the Web Playback SDK player
   */
  private async initializePlayer(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    if (!window.Spotify) {
      throw new Error('Spotify SDK not loaded');
    }

    // Create player instance
    this.player = new window.Spotify.Player({
      name: 'Hear and Guess Web Player',
      getOAuthToken: (cb: (token: string) => void) => {
        if (this.accessToken) {
          cb(this.accessToken);
        }
      },
      volume: 0.5,
    });

    // Set up event listeners
    this.setupPlayerListeners();

    // Connect to Spotify and wait for ready event
    const connected = await this.player.connect();
    if (!connected) {
      throw new Error('Failed to connect Spotify Web Player');
    }

    console.log('✅ Spotify Web Player connected, waiting for device registration...');

    // Wait for the device to be ready (ready event to fire)
    await this.waitForDeviceReady();
  }

  /**
   * Wait for device to be registered and ready
   */
  private async waitForDeviceReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already ready, continue with verification
      if (this.deviceId) {
        console.log('✅ Device ID received:', this.deviceId);
        // Add delay and verify
        setTimeout(async () => {
          await this.verifyDeviceRegistration();
          resolve();
        }, 2000); // 2 second delay for device to register with Spotify backend
        return;
      }

      // Set a timeout in case the ready event never fires
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Spotify player to be ready. Please ensure you have Spotify Premium.'));
      }, 15000); // 15 second timeout

      // Wait for ready event
      const checkReady = setInterval(() => {
        if (this.deviceId) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          console.log('✅ Device ID received:', this.deviceId);
          // Add delay and verify before resolving
          setTimeout(async () => {
            try {
              await this.verifyDeviceRegistration();
              resolve();
            } catch (error) {
              reject(error);
            }
          }, 2000); // 2 second delay for device to register with Spotify backend
        }
      }, 100);
    });
  }

  /**
   * Verify the device is actually registered with Spotify's backend
   */
  private async verifyDeviceRegistration(): Promise<void> {
    if (!this.accessToken || !this.deviceId) {
      throw new Error('Cannot verify device - missing token or device ID');
    }

    console.log('🔍 Verifying device registration with Spotify...');

    // Try verification twice
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch devices from Spotify');
        }

        const data = await response.json();
        const devices = data.devices || [];

        console.log(`📱 Available devices (attempt ${attempt}/2):`, devices.map((d: any) => `${d.name} (${d.id.substring(0, 8)}...)`).join(', ') || 'none');

        const ourDevice = devices.find((d: any) => d.id === this.deviceId);

        if (ourDevice) {
          console.log('✅ Device verified in Spotify backend:', ourDevice.name);
          return; // Success!
        } else {
          console.warn(`⚠️ Device ${this.deviceId?.substring(0, 8)}... not found (attempt ${attempt}/2)`);

          if (attempt === 1) {
            console.log('⏳ Waiting 2 seconds before retrying verification...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // Second attempt failed - throw error to trigger device recreation
            throw new Error('Device not found in Spotify backend after 2 verification attempts');
          }
        }
      } catch (error) {
        if (attempt === 2) {
          // Second attempt failed - rethrow to trigger device recreation
          throw error;
        }
        console.warn(`⚠️ Verification attempt ${attempt} error:`, error);
        console.log('⏳ Waiting 2 seconds before retrying verification...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  /**
   * Set up player event listeners
   */
  private setupPlayerListeners(): void {
    if (!this.player) return;

    // Ready event - player is ready to use
    this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
      console.log('🎵 Ready with Device ID:', device_id);
      this.deviceId = device_id;
    });

    // Not Ready event
    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('❌ Device ID has gone offline:', device_id);
    });

    // Player state changed
    this.player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
      if (!state) {
        console.log('⏹️ Playback stopped');
        return;
      }

      console.log('🎵 Player state changed:', {
        paused: state.paused,
        position: Math.floor(state.position / 1000) + 's',
        track: state.track_window.current_track.name,
      });
    });

    // Errors
    this.player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('❌ Initialization Error:', message);
    });

    this.player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('❌ Authentication Error:', message);
    });

    this.player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('❌ Account Error:', message);
    });

    this.player.addListener('playback_error', ({ message }: { message: string }) => {
      console.error('❌ Playback Error:', message);
    });
  }

  /**
   * Transfer playback to this device (activate it)
   */
  private async transferPlayback(): Promise<void> {
    if (!this.accessToken || !this.deviceId) {
      return;
    }

    try {
      console.log('🔄 Transferring playback to Web Player device...');
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [this.deviceId],
          play: false, // Don't start playing yet
        }),
      });

      if (response.ok || response.status === 204) {
        console.log('✅ Playback transferred to Web Player');
      } else {
        console.warn('⚠️ Could not transfer playback:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Error transferring playback:', error);
      // Don't throw - we'll try to play anyway
    }
  }

  /**
   * Play a song on the Web Player
   */
  async playSong(trackUri: string, startPositionMs: number = 0, retryCount: number = 0): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available. Please log in again.');
    }

    if (!this.deviceId) {
      throw new Error('Spotify Web Player not ready. Please refresh the page and try again.');
    }

    try {
      // Transfer playback to our device first (activate it)
      if (retryCount === 0) {
        await this.transferPlayback();
        // Wait a moment for transfer to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`🎵 Playing track (attempt ${retryCount + 1}/2):`, trackUri);
      console.log('📊 Start position:', Math.floor(startPositionMs / 1000), 'seconds');
      console.log('🎧 Device ID:', this.deviceId?.substring(0, 8) + '...');

      // Use Spotify Connect API to start playback on our Web Player device
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [trackUri],
            position_ms: startPositionMs,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Playback error:', error);

        // Retry once on 404 if this is the first attempt
        if (response.status === 404 && retryCount === 0) {
          console.log('⏳ Device not found, waiting 2 seconds and retrying...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.playSong(trackUri, startPositionMs, retryCount + 1);
        }

        // After 2 failures, reset player and suggest retry
        if (response.status === 404 && retryCount === 1) {
          console.error('❌ Device still not found after retry. Resetting player...');
          this.reset(); // Clear player so next initialize() will recreate
          throw new Error('Spotify player device not working. Please try starting the round again - a new device will be created automatically.');
        }

        // Provide better error messages for other errors
        if (response.status === 403) {
          throw new Error('Spotify Premium required. The Web Playback SDK only works with Spotify Premium accounts.');
        } else {
          throw new Error(`Failed to start playback: ${error.error?.message || error.error?.reason || 'Unknown error'}`);
        }
      }

      console.log('✅ Playback started successfully');
    } catch (error) {
      console.error('❌ Error playing song:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.player) {
      console.warn('⚠️ Player not initialized');
      return;
    }

    try {
      await this.player.pause();
      console.log('⏸️ Playback paused');
    } catch (error) {
      console.error('❌ Error pausing playback:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.player) {
      console.warn('⚠️ Player not initialized');
      return;
    }

    try {
      await this.player.resume();
      console.log('▶️ Playback resumed');
    } catch (error) {
      console.error('❌ Error resuming playback:', error);
      throw error;
    }
  }

  /**
   * Set volume (0 to 100)
   */
  async setVolume(volume: number): Promise<void> {
    if (!this.player) return;

    try {
      // Convert 0-100 to 0-1
      const volumeFraction = volume / 100;
      await this.player.setVolume(volumeFraction);
      console.log('🔊 Volume set to:', volume + '%');
    } catch (error) {
      console.error('❌ Error setting volume:', error);
    }
  }

  /**
   * Get current playback state
   */
  async getCurrentState(): Promise<SpotifyPlaybackState | null> {
    if (!this.player) return null;

    try {
      const state = await this.player.getCurrentState();
      return state;
    } catch (error) {
      console.error('❌ Error getting playback state:', error);
      return null;
    }
  }

  /**
   * Reset the player (force recreation on next initialize)
   */
  reset(): void {
    console.log('🔄 Resetting player for recreation...');
    if (this.player) {
      this.player.disconnect();
    }
    this.player = null;
    this.deviceId = null;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.player) {
      console.log('🔌 Disconnecting Spotify Web Player');
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
    }
  }

  /**
   * Check if player is ready
   */
  isReady(): boolean {
    return this.player !== null && this.deviceId !== null;
  }
}

export const spotifyPlaybackService = new SpotifyPlaybackService();
