// Create a shared AudioContext to reuse across calls (better for mobile)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Plays a buzz sound effect using Web Audio API
 */
export async function playBuzzSound() {
  try {
    console.log('🔊 Playing buzz sound');
    const ctx = getAudioContext();

    // Resume AudioContext if suspended (required on mobile)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create oscillator for the buzz sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure buzz sound (higher frequency for more noticeable buzzer)
    oscillator.type = 'square'; // Square wave for buzzer sound
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note - higher and more noticeable

    // Configure volume envelope (louder and slightly longer)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01); // Louder volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4); // Slightly longer

    // Play the sound
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    // Clean up oscillator and gain node (but keep AudioContext)
    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
    };
  } catch (error) {
    console.error('Failed to play buzz sound:', error);
  }
}
