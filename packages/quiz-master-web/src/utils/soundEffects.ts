// Create a shared AudioContext to reuse across calls (better for mobile)
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Plays a triumphant rising arpeggio for correct answers
 */
export async function playCorrectSound() {
  try {
    console.log('✅ Playing correct answer sound');
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create oscillators for a rising arpeggio
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    osc3.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Rising major arpeggio (C-E-G) for triumphant sound
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523, ctx.currentTime); // C5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659, ctx.currentTime + 0.08); // E5

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(784, ctx.currentTime + 0.16); // G5

    // Bright, triumphant envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.08);
    osc3.start(ctx.currentTime + 0.16);

    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);
    osc3.stop(ctx.currentTime + 0.5);

    osc1.onended = () => {
      gainNode.disconnect();
      osc1.disconnect();
      osc2.disconnect();
      osc3.disconnect();
    };
  } catch (error) {
    console.error('Failed to play correct sound:', error);
  }
}

/**
 * Plays an unpleasant descending tone for incorrect answers
 */
export async function playIncorrectSound() {
  try {
    console.log('❌ Playing incorrect answer sound');
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Descending "sad trombone" effect (longer)
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, ctx.currentTime); // Start
    oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.6); // Descend slower

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);

    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
    };
  } catch (error) {
    console.error('Failed to play incorrect sound:', error);
  }
}

/**
 * Plays a buzz sound effect using Web Audio API
 * Creates a two-tone siren effect for noticeability
 */
export async function playBuzzSound() {
  try {
    console.log('🔊 Playing buzz sound');
    const ctx = getAudioContext();

    // Resume AudioContext if suspended (required on mobile)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create two oscillators for a siren-like buzz effect
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Connect both oscillators to the gain node
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure first tone (lower)
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(660, ctx.currentTime); // E5
    osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

    // Configure second tone (higher) with slight detune for richness
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15); // C#6

    // Configure volume envelope (reduced volume)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02); // Quieter
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3); // Sustain
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); // Quick fade

    // Play the sound
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);

    // Clean up
    osc1.onended = () => {
      gainNode.disconnect();
      osc1.disconnect();
      osc2.disconnect();
    };
  } catch (error) {
    console.error('Failed to play buzz sound:', error);
  }
}

/**
 * Plays a beep sound for countdown end
 */
export async function playBeepSound() {
  try {
    console.log('🔔 Playing beep sound');
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);

    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
    };
  } catch (error) {
    console.error('Failed to play beep sound:', error);
  }
}
