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

  /**
   * Initialize the playback service with access token
   */
  async initialize(accessToken: string): Promise<void> {
    this.accessToken = accessToken;
    console.log('🎵 Initializing Spotify Web Playback SDK...');

    // If already initialized, just reconnect with new token
    if (this.player) {
      console.log('♻️ Reconnecting existing player...');
      return;
    }

    // Wait for SDK to be ready
    await this.waitForSDK();

    // Initialize the player
    await this.initializePlayer();
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
  private waitForDeviceReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already ready, resolve immediately
      if (this.deviceId) {
        console.log('✅ Device already ready:', this.deviceId);
        resolve();
        return;
      }

      // Set a timeout in case the ready event never fires
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Spotify player to be ready. Please ensure you have Spotify Premium.'));
      }, 10000); // 10 second timeout

      // Wait for ready event
      const checkReady = setInterval(() => {
        if (this.deviceId) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          console.log('✅ Device ready:', this.deviceId);
          resolve();
        }
      }, 100);
    });
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
   * Play a song on the Web Player
   */
  async playSong(trackUri: string, startPositionMs: number = 0): Promise<void> {
    if (!this.accessToken) {
      throw new Error('No access token available. Please log in again.');
    }

    if (!this.deviceId) {
      throw new Error('Spotify Web Player not ready. Please refresh the page and try again.');
    }

    try {
      console.log('🎵 Playing track:', trackUri);
      console.log('📊 Start position:', Math.floor(startPositionMs / 1000), 'seconds');
      console.log('🎧 Device ID:', this.deviceId);

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

        // Provide better error messages
        if (response.status === 404) {
          throw new Error('Spotify player device not found. This usually means:\n\n1. You need Spotify Premium (required for playback)\n2. The player may need a moment to activate - please wait and try again\n3. Try refreshing the page\n\nIf the problem persists, please check that you have an active Spotify Premium subscription.');
        } else if (response.status === 403) {
          throw new Error('Spotify Premium required. The Web Playback SDK only works with Spotify Premium accounts.');
        } else {
          throw new Error(`Failed to start playback: ${error.error?.message || error.error?.reason || 'Unknown error'}`);
        }
      }

      console.log('✅ Playback started');
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
