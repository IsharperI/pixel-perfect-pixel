/**
 * Tiny synthesized sound effects (no audio files to load or license).
 * The AudioContext is created lazily on the first sound, which always follows
 * a key press, so browsers' autoplay rules are satisfied.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // Browsers block audio until the user has interacted with the page (e.g. the
  // landing as the level loads), so stay silent until then.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(a: AudioContext) {
  if (!noise) {
    noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

/** A short rising "boing" chirp. */
export function playJump(volume: number) {
  const a = audio();
  if (!a || volume <= 0) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(720, t + 0.11);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * volume, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.18);
}

/** A soft thud. `strength` 0–1: harder landings are louder, brighter and lower. */
export function playLand(volume: number, strength: number) {
  const a = audio();
  if (!a || volume <= 0) return;
  const t = a.currentTime;
  const k = Math.min(Math.max(strength, 0), 1);

  // Scuff: filtered noise burst
  const n = a.createBufferSource();
  n.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 350 + k * 900;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime((0.12 + 0.3 * k) * volume, t + 0.005);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + 0.1 * k);
  n.connect(f).connect(ng).connect(a.destination);
  n.start(t);
  n.stop(t + 0.3);

  // Thump: quick falling sine
  const o = a.createOscillator();
  const og = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140 - 40 * k, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime((0.15 + 0.35 * k) * volume, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  o.connect(og).connect(a.destination);
  o.start(t);
  o.stop(t + 0.17);
}

/** A soft, airy "fwup" for each float flap. */
export function playFlap(volume: number) {
  const a = audio();
  if (!a || volume <= 0) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(620, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 * volume, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.14);
}

/** A breathy "pff" when exhaling out of a float. */
export function playExhale(volume: number) {
  const a = audio();
  if (!a || volume <= 0) return;
  const t = a.currentTime;
  const n = a.createBufferSource();
  n.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1400;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18 * volume, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(f).connect(g).connect(a.destination);
  n.start(t);
  n.stop(t + 0.25);
}
