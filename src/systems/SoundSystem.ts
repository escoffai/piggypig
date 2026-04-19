// SoundSystem: synthesize SFX via WebAudio. Zero audio asset dependencies.

type Muted = { muted: boolean };

let ctx: AudioContext | null = null;
const flags: Muted = { muted: false };

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AC =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function setMuted(m: boolean): void {
  flags.muted = m;
}

export function isMuted(): boolean {
  return flags.muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', gain = 0.07): void {
  if (flags.muted) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => undefined);
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export function sfxShot(): void {
  tone(880 + Math.random() * 80, 0.05, 'square', 0.04);
}

export function sfxCubePop(): void {
  tone(220, 0.08, 'triangle', 0.08);
  tone(130, 0.1, 'sine', 0.05);
}

export function sfxPigPop(): void {
  tone(520, 0.1, 'sawtooth', 0.05);
  tone(220, 0.14, 'triangle', 0.05);
}

export function sfxCapacityBlocked(): void {
  tone(140, 0.08, 'sawtooth', 0.05);
}

export function sfxLevelClear(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => tone(n, 0.18, 'triangle', 0.07), i * 90);
  });
}

export function sfxFail(): void {
  tone(220, 0.18, 'sawtooth', 0.06);
  setTimeout(() => tone(165, 0.24, 'sawtooth', 0.06), 100);
}

export function sfxTap(): void {
  tone(440, 0.03, 'triangle', 0.035);
}

export function haptic(ms = 15): void {
  if (flags.muted) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
}
