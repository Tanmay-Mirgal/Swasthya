/**
 * lib/sound/cheer.ts
 *
 * The sound of a finished set: a soft "pop" and a rising chime, made with the Web Audio API so there is no file to
 * load and nothing to go missing offline. Quiet on purpose (it sits under the voice, never over it), and everything
 * fails silently: no sound is never an error.
 *
 * Browsers only allow audio after a tap, so `primeCheer()` is called from a button press early in the session.
 */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function audio(): Ctx | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap. Makes no sound. */
export function primeCheer(): void {
  try {
    void audio()?.resume();
  } catch {
    /* ignore */
  }
}

/** Notes of a C major arpeggio, in Hz. Bigger celebrations climb higher. */
const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.5];

/** A short noise burst through a band-pass filter: the "pop". */
function pop(c: Ctx, at: number, gain: number) {
  const length = Math.floor(c.sampleRate * 0.09);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1400;
  band.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  src.connect(band).connect(g).connect(c.destination);
  src.start(at);
}

function note(c: Ctx, freq: number, at: number, gain: number) {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.5);
}

/**
 * `level` 1 = a set, 2 = a milestone or an exercise, 3 = today's routine. `volume` is the person's own setting (0..1).
 * Returns true if a sound was scheduled.
 */
export function playCheer(level: 1 | 2 | 3, volume: number): boolean {
  const c = audio();
  const v = Math.max(0, Math.min(1, volume));
  if (!c || v === 0) return false;
  try {
    if (c.state === "suspended") void c.resume();
    const t = c.currentTime + 0.02;
    const loud = 0.22 * v;
    pop(c, t, loud);
    const count = level === 1 ? 3 : level === 2 ? 4 : 5;
    for (let i = 0; i < count; i++) note(c, NOTES[i], t + 0.08 + i * 0.09, loud * 0.55);
    return true;
  } catch {
    return false;
  }
}

/** A short buzz on phones that support it. Never the only signal. */
export function buzz(level: 1 | 2 | 3): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(level === 1 ? 30 : level === 2 ? [30, 50, 60] : [40, 60, 40, 60, 90]);
  } catch {
    /* ignore */
  }
}
