import TrackPlayer, { Capability, State } from 'react-native-track-player';

class SpotifyPlaybackService {
  private isSetup = false;

  async setup() {
    if (this.isSetup) return;

    try {
      await TrackPlayer.setupPlayer();

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
        ],
      });

      this.isSetup = true;
      console.log('✅ Track Player setup complete');
    } catch (error) {
      console.error('Error setting up Track Player:', error);
    }
  }

  async playSpotifyTrack(spotifyUri: string, previewUrl?: string) {
    try {
      await this.setup();

      // Clear any existing tracks
      await TrackPlayer.reset();

      // For Spotify, we need to use the preview URL since react-native-track-player
      // doesn't directly support Spotify URIs
      if (previewUrl) {
        await TrackPlayer.add({
          url: previewUrl,
          title: 'Song Preview',
          artist: 'Unknown',
        });

        await TrackPlayer.play();
        console.log('▶️  Playing preview:', previewUrl);
      } else {
        console.warn('⚠️  No preview URL available. Cannot play this track.');
        throw new Error('No preview URL available for this track');
      }
    } catch (error) {
      console.error('Error playing track:', error);
      throw error;
    }
  }

  async play() {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause() {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async stop() {
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
    } catch (error) {
      console.error('Error stopping:', error);
    }
  }

  async getState(): Promise<State> {
    try {
      return await TrackPlayer.getState();
    } catch (error) {
      console.error('Error getting state:', error);
      return State.None;
    }
  }

  async getPosition(): Promise<number> {
    try {
      return await TrackPlayer.getPosition();
    } catch (error) {
      console.error('Error getting position:', error);
      return 0;
    }
  }
}

export const spotifyPlaybackService = new SpotifyPlaybackService();
