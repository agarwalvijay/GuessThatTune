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
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.26, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (error) {
    console.error('Failed to play buzz sound:', error);
  }
}

/**
 * Plays a short tap sound when sending reactions
 */
export async function playReactionTapSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(740, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.09);

    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.11);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch (error) {
    console.error('Failed to play reaction tap sound:', error);
  }
}

/**
 * Plays a quick stinger when a new round/song starts
 */
export async function playRoundStartCueSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(494, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (error) {
    console.error('Failed to play round start cue sound:', error);
  }
}

/**
 * Plays a short positive cue for a correct multiple-choice answer
 */
export async function playCorrectGuessSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(780, ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (error) {
    console.error('Failed to play correct guess sound:', error);
  }
}

/**
 * Plays a short negative cue for an incorrect multiple-choice answer
 */
export async function playIncorrectGuessSound() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(300, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(240, ctx.currentTime + 0.16);
    osc2.frequency.setValueAtTime(220, ctx.currentTime + 0.03);
    osc2.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime + 0.03);
    osc1.stop(ctx.currentTime + 0.22);
    osc2.stop(ctx.currentTime + 0.22);
  } catch (error) {
    console.error('Failed to play incorrect guess sound:', error);
  }
}
