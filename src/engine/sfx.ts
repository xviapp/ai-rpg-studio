export type SfxName = 'blip' | 'confirm' | 'coin' | 'step' | 'bump' | 'teleport' | 'heal';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function beep(
  ctx: AudioContext,
  freq: number,
  duration: number,
  type: OscillatorType,
  gainValue: number,
  delay = 0,
  endFreq?: number
) {
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
  }
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

export function playSfx(name: SfxName) {
  const ctx = getAudioContext();
  if (!ctx) return;

  switch (name) {
    case 'blip':
      beep(ctx, 520, 0.045, 'square', 0.04, 0, 600);
      break;
    case 'confirm':
      beep(ctx, 660, 0.06, 'square', 0.05);
      beep(ctx, 880, 0.09, 'square', 0.05, 0.05);
      break;
    case 'coin':
      beep(ctx, 988, 0.07, 'square', 0.055);
      beep(ctx, 1318, 0.16, 'square', 0.055, 0.07);
      break;
    case 'step':
      beep(ctx, 140, 0.03, 'triangle', 0.035, 0, 90);
      break;
    case 'bump':
      beep(ctx, 120, 0.08, 'sawtooth', 0.045, 0, 75);
      break;
    case 'teleport':
      beep(ctx, 320, 0.18, 'sine', 0.06, 0, 960);
      beep(ctx, 640, 0.16, 'triangle', 0.05, 0.08, 1280);
      break;
    case 'heal':
      beep(ctx, 523, 0.08, 'triangle', 0.06, 0);
      beep(ctx, 659, 0.08, 'triangle', 0.06, 0.08);
      beep(ctx, 784, 0.14, 'triangle', 0.06, 0.16);
      break;
  }
}
