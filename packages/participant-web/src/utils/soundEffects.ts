/**
 * Plays a buzz sound effect using Web Audio API
 */
export function playBuzzSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create oscillator for the buzz sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure buzz sound (low frequency for buzzer effect)
    oscillator.type = 'square'; // Square wave for buzzer sound
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3 note

    // Configure volume envelope (quick attack and decay)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3); // Decay

    // Play the sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);

    // Clean up
    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
      audioContext.close();
    };
  } catch (error) {
    console.error('Failed to play buzz sound:', error);
  }
}
