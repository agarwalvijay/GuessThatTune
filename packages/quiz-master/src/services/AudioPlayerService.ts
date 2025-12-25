import Sound from 'react-native-sound';

// Enable playback in silence mode
Sound.setCategory('Playback');

export class AudioPlayerService {
  private sound: Sound | null = null;
  private stopTimer: NodeJS.Timeout | null = null;

  /**
   * Play a song from a URL with optional start offset
   * @param url - The audio URL (preview URL or full song URL)
   * @param startOffset - Offset in seconds to start playing from
   * @param duration - Duration in seconds to play for (if provided, will auto-stop)
   */
  async play(url: string, startOffset: number = 0, duration?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop any existing playback
      this.stop();

      console.log('🎵 Loading audio:', url);
      console.log('Start offset:', startOffset, 'seconds');
      if (duration) {
        console.log('Play duration:', duration, 'seconds');
      }

      this.sound = new Sound(url, '', (error) => {
        if (error) {
          console.error('Failed to load sound:', error);
          reject(error);
          return;
        }

        if (!this.sound) {
          reject(new Error('Sound object is null'));
          return;
        }

        const soundDuration = this.sound.getDuration();
        console.log('Sound loaded. Duration:', soundDuration, 'seconds');

        // Ensure start offset doesn't exceed song duration
        const actualStartOffset = Math.min(startOffset, soundDuration - 1);

        // Set the current time to start offset
        this.sound.setCurrentTime(actualStartOffset);

        // Play the sound
        this.sound.play((success) => {
          if (!success) {
            console.error('Playback failed');
          } else {
            console.log('Playback finished');
          }
          this.cleanup();
        });

        // If duration is specified, set up auto-stop timer
        if (duration) {
          const stopAfterMs = duration * 1000;
          this.stopTimer = setTimeout(() => {
            console.log('Auto-stopping playback after', duration, 'seconds');
            this.stop();
          }, stopAfterMs);
        }

        resolve();
      });
    });
  }

  /**
   * Pause the current playback
   */
  pause(): void {
    if (this.sound) {
      this.sound.pause();
      console.log('⏸️  Playback paused');
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.sound) {
      this.sound.play((success) => {
        if (!success) {
          console.error('Resume failed');
        }
        this.cleanup();
      });
      console.log('▶️  Playback resumed');
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

    if (this.sound) {
      this.sound.stop(() => {
        this.cleanup();
      });
      console.log('⏹️  Playback stopped');
    }
  }

  /**
   * Get current playback state
   */
  isPlaying(): boolean {
    return this.sound?.isPlaying() || false;
  }

  /**
   * Get current playback position in seconds
   */
  getCurrentTime(callback: (seconds: number) => void): void {
    if (this.sound) {
      this.sound.getCurrentTime(callback);
    } else {
      callback(0);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.sound) {
      this.sound.release();
      this.sound = null;
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  /**
   * Release all resources (call when component unmounts)
   */
  release(): void {
    this.stop();
    this.cleanup();
  }
}

// Singleton instance
export const audioPlayerService = new AudioPlayerService();
