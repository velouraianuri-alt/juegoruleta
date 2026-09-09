"use client";

// Every cue here is synthesized with the Web Audio API — no downloaded audio
// assets — so there's nothing to license or fetch. Sounds are only ever
// created lazily on first use (browsers block audio contexts before a user
// gesture) and gated by the localStorage-persisted mute toggle.

const STORAGE_KEY = "prive-sound-enabled";
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore (private browsing etc.)
  }
  window.dispatchEvent(new CustomEvent("prive-sound-toggle", { detail: enabled }));
}

function tone(
  freq: number,
  duration: number,
  {
    type = "sine",
    gain = 0.15,
    delay = 0,
    freqEnd,
  }: { type?: OscillatorType; gain?: number; delay?: number; freqEnd?: number } = {},
) {
  if (!isSoundEnabled()) return;
  const audioCtx = getContext();
  if (!audioCtx) return;

  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, duration / 4));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noiseBurst(duration: number, { gain = 0.08, delay = 0 }: { gain?: number; delay?: number } = {}) {
  if (!isSoundEnabled()) return;
  const audioCtx = getContext();
  if (!audioCtx) return;

  const start = audioCtx.currentTime + delay;
  const bufferSize = Math.floor(audioCtx.sampleRate * duration);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(gain, start);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1800;

  source.connect(filter).connect(gainNode).connect(audioCtx.destination);
  source.start(start);
}

/** Soft continuous whirring tone for the body of a spin — frequency and a lowpass
 * cutoff both ramp down over `durationMs` to track the wheel's own deceleration
 * (easeOutQuint), then fade out just before the ball settles. */
function wheelHum(durationMs: number) {
  if (!isSoundEnabled()) return;
  const audioCtx = getContext();
  if (!audioCtx) return;

  const dur = durationMs / 1000;
  const start = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, start);
  osc.frequency.exponentialRampToValueAtTime(55, start + dur * 0.9);

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, start);
  filter.frequency.exponentialRampToValueAtTime(220, start + dur * 0.9);

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(0.05, start + 0.3);
  gainNode.gain.setValueAtTime(0.05, start + dur * 0.75);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.95);

  osc.connect(filter).connect(gainNode).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur);
}

export const sound = {
  chip: () => tone(720, 0.08, { type: "square", gain: 0.06 }),
  cardFlip: () => noiseBurst(0.12, { gain: 0.1 }),
  spinStart: () => {
    tone(180, 0.9, { type: "sawtooth", gain: 0.05, freqEnd: 420 });
  },
  wheelHum,
  ballTick: () => tone(1400, 0.03, { type: "square", gain: 0.03 }),
  /** Heavier than ballTick — the ball actually striking a separator, a few times
   * near the end of the bounce window rather than the whole skipping run. */
  ballBounce: (delay = 0) => {
    tone(220, 0.06, { type: "sine", gain: 0.09, delay, freqEnd: 120 });
    noiseBurst(0.05, { gain: 0.05, delay });
  },
  /** Final thunk the instant the ball settles into its pocket. */
  settle: () => {
    tone(140, 0.18, { type: "sine", gain: 0.12, freqEnd: 60 });
    noiseBurst(0.1, { gain: 0.06 });
  },
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(freq, 0.35, { type: "triangle", gain: 0.12, delay: i * 0.09 }),
    );
  },
  lose: () => tone(160, 0.4, { type: "sine", gain: 0.08, freqEnd: 90 }),
  click: () => tone(500, 0.05, { type: "sine", gain: 0.05 }),
};
