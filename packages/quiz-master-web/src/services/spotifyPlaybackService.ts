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
  private onDebugLog: ((msg: string) => void) | null = null;
  private keepAliveInterval: number | null = null;
  private recoveryInProgress: Promise<void> | null = null;

  /**
   * Set a callback to receive debug logs (shown in on-screen debug panel)
   */
  setDebugCallback(cb: ((msg: string) => void) | null): void {
    this.onDebugLog = cb;
  }

  /**
   * Log to both console and debug panel
   */
  private debugLog(msg: string): void {
    console.log(msg);
    if (this.onDebugLog) this.onDebugLog(msg);
  }

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

    // Start keep-alive: periodically touch the SDK to prevent idle disconnection
    this.startKeepAlive();
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

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Spotify SDK to load. Please refresh the page.'));
      }, 10000); // 10 second timeout

      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
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
      this.debugLog(`✅ SDK ready, device: ${device_id.substring(0, 8)}...`);
      this.deviceId = device_id;
    });

    // Not Ready event - device has gone offline temporarily
    this.player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      this.debugLog(`⚠️ SDK not_ready: ${device_id.substring(0, 8)}... - waiting for auto-reconnect`);
      // Don't clear deviceId - let SDK self-heal. ready event will update if ID changes.
    });

    // Player state changed
    // Note: SDK fires this event very frequently during transitions
    let lastLoggedState: string | null = null;
    this.player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
      if (!state) {
        console.log('⏹️ Playback stopped');
        lastLoggedState = null;
        return;
      }

      // Only log when paused state or track actually changes
      const stateKey = `${state.paused}-${state.track_window.current_track.uri}`;
      if (stateKey !== lastLoggedState) {
        console.log('🎵 Player state changed:', {
          paused: state.paused,
          position: Math.floor(state.position / 1000) + 's',
          track: state.track_window.current_track.name,
        });
        lastLoggedState = stateKey;
      }
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
      // Ignore "no list was loaded" error - happens during first round loading
      // when continuous pause loop tries to pause before song is loaded
      if (message.includes('no list was loaded')) {
        return;
      }
      console.error('❌ Playback Error:', message);
    });
  }

  /**
   * Keep the SDK connection alive by periodically making a lightweight SDK call.
   * Mobile browsers (especially Samsung) aggressively kill idle WebSocket connections.
   */
  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = window.setInterval(async () => {
      if (this.player) {
        try {
          await this.player.getVolume(); // Lightweight SDK call via WebSocket
        } catch {
          // Ignore - just a keep-alive ping
        }
      }
    }, 10000); // Every 10 seconds
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Fast player reinitialization for inline recovery during playback.
   * Skips the 2s delay and device verification for speed.
   * Only used when we KNOW the device is gone (404 from play API).
   */
  private async reinitializePlayerInline(): Promise<void> {
    this.debugLog('🔄 Fast reinit: creating new player...');
    this.stopKeepAlive();

    if (this.player) {
      this.player.disconnect();
    }
    this.player = null;
    this.deviceId = null;

    if (!this.accessToken || !window.Spotify) {
      throw new Error('Cannot reinitialize - missing token or SDK');
    }

    this.player = new window.Spotify.Player({
      name: 'Hear and Guess Web Player',
      getOAuthToken: (cb: (token: string) => void) => {
        if (this.accessToken) cb(this.accessToken);
      },
      volume: 0.5,
    });

    this.setupPlayerListeners();

    const connected = await this.player.connect();
    if (!connected) {
      throw new Error('Failed to connect player during recovery');
    }

    // Wait for ready event with 10s timeout, then just 500ms for propagation
    // (skips the normal 2s delay + verification for speed)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for device during recovery'));
      }, 10000);

      const check = setInterval(() => {
        if (this.deviceId) {
          clearInterval(check);
          clearTimeout(timeout);
          setTimeout(() => resolve(), 500);
        }
      }, 100);
    });

    this.debugLog('✅ Fast reinit complete: ' + String(this.deviceId).substring(0, 8) + '...');
    this.startKeepAlive();
  }

  /**
   * Find our Web Player device in Spotify's backend.
   * Returns the device ID if found, null otherwise.
   * This queries the ACTUAL backend state, not our local cache.
   */
  private async findOurDevice(): Promise<string | null> {
    if (!this.accessToken) return null;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const devices = data.devices || [];

      // Look for our device by name
      const ourDevice = devices.find((d: any) =>
        d.name === 'Hear and Guess Web Player'
      );

      if (ourDevice) {
        console.log('🔍 Found our device:', ourDevice.id.substring(0, 8) + '...', 'active:', ourDevice.is_active);
        return ourDevice.id;
      }

      console.log('🔍 Our device not found among', devices.length, 'device(s):', devices.map((d: any) => d.name).join(', ') || 'none');
      return null;
    } catch (error) {
      console.warn('⚠️ Error finding our device:', error);
      return null;
    }
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
   * Proactively re-establish Spotify device after a WebSocket disruption.
   * Call this when Socket.IO reconnects — the Spotify SDK WebSocket likely
   * died at the same time, so the device may be de-registered.
   */
  async reestablishDevice(): Promise<void> {
    // Track recovery so playSong() can wait for it
    this.recoveryInProgress = this.doReestablishDevice();
    try {
      await this.recoveryInProgress;
    } finally {
      this.recoveryInProgress = null;
    }
  }

  private async doReestablishDevice(): Promise<void> {
    if (!this.accessToken) {
      this.debugLog('⚠️ reestablishDevice: no access token');
      return;
    }

    this.debugLog('🔄 WebSocket disruption — re-establishing Spotify device...');

    try {
      // Check if our device still exists in Spotify's backend
      const deviceId = await this.findOurDevice();

      if (deviceId) {
        // Device exists — update our ID if it changed and re-activate
        if (deviceId !== this.deviceId) {
          this.debugLog(`📱 Device ID changed: ${this.deviceId?.substring(0, 8)} → ${deviceId.substring(0, 8)}`);
          this.deviceId = deviceId;
        }
        await this.transferPlayback();
        this.debugLog('✅ Device re-established via transfer');
        return;
      }

      // Device gone — try fast reinit first
      this.debugLog('❌ Device gone from Spotify — reinitializing...');
      try {
        await this.reinitializePlayerInline();
        this.debugLog('✅ Device re-registered via fast reinit');
        return;
      } catch (err: any) {
        this.debugLog(`⚠️ Fast reinit failed: ${err.message || 'unknown'}, trying full init...`);
      }

      // Last resort — full initialization from scratch
      this.reset();
      await this.initialize(this.accessToken!);
      this.debugLog('✅ Device re-registered via full init');
    } catch (err: any) {
      this.debugLog(`❌ All recovery attempts failed: ${err.message || 'unknown'}`);
    }
  }

  /**
   * Play a song on the Web Player
   */
  async playSong(trackUri: string, startPositionMs: number = 0, retryCount: number = 0): Promise<void> {
    // Wait for any in-progress device recovery before attempting to play
    if (this.recoveryInProgress) {
      this.debugLog('⏳ Waiting for device recovery to complete before playing...');
      try {
        await this.recoveryInProgress;
        this.debugLog('✅ Recovery complete, proceeding to play');
      } catch {
        this.debugLog('⚠️ Recovery failed, attempting to play anyway');
      }
    }

    if (!this.accessToken) {
      throw new Error('No access token available. Please log in again.');
    }

    if (!this.deviceId) {
      throw new Error('Spotify Web Player not ready. Please refresh the page and try again.');
    }

    try {
      // 1. Re-grab hardware focus via activateElement (if available)
      if (this.player && typeof (this.player as any).activateElement === 'function') {
        await (this.player as any).activateElement();
      }

      // 2. Pre-play diagnostic: check if our device exists in Spotify's backend
      if (retryCount === 0) {
        const preCheckId = await this.findOurDevice();
        if (preCheckId) {
          this.debugLog(`📱 Pre-play: device ${preCheckId === this.deviceId ? 'MATCH' : 'ID CHANGED!'}`);
          if (preCheckId !== this.deviceId) {
            this.debugLog(`🔄 Updating device ID: ${this.deviceId?.substring(0, 8)}→${preCheckId.substring(0, 8)}`);
            this.deviceId = preCheckId;
          }
          // Ensure device is active
          await this.transferPlayback();
        } else {
          this.debugLog(`📱 Pre-play: device NOT FOUND in backend! Will reinit on failure.`);
        }
      }

      // 3. Volume health check
      if (this.player) {
        const volume = await this.player.getVolume();
        if (volume === 0) {
          await this.player.setVolume(0.5);
        }
      }

      this.debugLog(`🎵 Play attempt ${retryCount + 1}, device: ${this.deviceId?.substring(0, 8)}...`);

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
        const errorBody = await response.json().catch(() => ({}));
        const errorMsg = errorBody.error?.message || errorBody.error?.reason || 'Unknown';
        this.debugLog(`❌ Play API ${response.status}: ${errorMsg}`);

        // On 404: device is gone from Spotify's backend.
        if (response.status === 404 && retryCount === 0) {
          this.debugLog('🔄 404 recovery: fast reinit...');

          // Fast reinit: create new player and device
          try {
            await this.reinitializePlayerInline();
            this.debugLog(`✅ New device: ${String(this.deviceId).substring(0, 8)}...`);
            return this.playSong(trackUri, startPositionMs, retryCount + 1);
          } catch (reinitError: any) {
            this.debugLog(`❌ Reinit failed: ${reinitError.message || 'unknown'}`);
            this.reset();
            throw new Error('Spotify player device not working. Please try starting the round again.');
          }
        }

        // On 5xx: transient server error, device likely still exists - just wait and retry
        if (response.status >= 500 && retryCount === 0) {
          console.log(`⏳ Server error (${response.status}), waiting 2s and retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.playSong(trackUri, startPositionMs, retryCount + 1);
        }

        // Safety net: if retry after recovery still fails
        if (response.status === 404 && retryCount === 1) {
          console.error('❌ Play still failing after recovery.');
          this.reset();
          throw new Error('Spotify player device not working. Please try starting the round again - a new device will be created automatically.');
        }

        if (response.status === 403) {
          throw new Error('Spotify Premium required. The Web Playback SDK only works with Spotify Premium accounts.');
        } else {
          throw new Error(`Failed to start playback: ${errorBody.error?.message || errorBody.error?.reason || 'Unknown error'}`);
        }
      }

      console.log('✅ Playback started successfully');

      // 4. Quick verification at 300ms - if SDK is stuck in paused state, force resume
      setTimeout(async () => {
        if (this.player) {
          const state = await this.player.getCurrentState();
          if (state) {
            const volume = await this.player.getVolume();
            if (volume === 0) {
              console.warn('⚠️ Volume still 0 after play, restoring...');
              await this.player.setVolume(0.5);
            }
            if (state.paused) {
              console.warn('⚠️ SDK stuck in paused state, forcing resume...');
              await this.player.resume();
            }
          } else {
            console.warn('⚠️ No playback state at 300ms check');
          }
        }
      }, 300);
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
    } catch (error: any) {
      // Ignore "no list was loaded" error - happens during first round loading
      // when continuous pause loop tries to pause before song is loaded
      if (error?.message?.includes('no list was loaded')) {
        return;
      }
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
   * Get current volume (0 to 100)
   */
  async getVolume(): Promise<number | null> {
    if (!this.player) return null;

    try {
      const volumeFraction = await this.player.getVolume();
      // Convert 0-1 to 0-100
      return Math.round(volumeFraction * 100);
    } catch (error) {
      console.error('❌ Error getting volume:', error);
      return null;
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
    this.stopKeepAlive();
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
    this.stopKeepAlive();
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
