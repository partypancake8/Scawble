// sfx.js — the sound design table: which tone each game event makes, and how to
// vary it on playback. PURE so the event->spec mapping and enable/jitter logic
// are unit-tested. Two consumers: the build script (reads `tone` to synthesize
// each asset once) and the native player (reads `rate`/`volume` + pickSound()).

// tone  = how to synthesize the asset (see wav.toneWav)
// rate/rateJitter = playback speed variance so repeats don't sound identical
// volume = per-event playback gain
export const SFX = {
  pickup:  { tone: { freq: 540, ms: 70,  type: 'sine',     volume: 0.35, releaseMs: 55 },  rate: 1.0, rateJitter: 0.06, volume: 0.55 },
  place:   { tone: { freq: 300, ms: 95,  type: 'triangle', volume: 0.5,  releaseMs: 75 },  rate: 1.0, rateJitter: 0.05, volume: 0.8 },
  invalid: { tone: { freq: 150, ms: 170, type: 'square',   volume: 0.32, releaseMs: 130 }, rate: 1.0, rateJitter: 0.0,  volume: 0.65 },
  tick:    { tone: { freq: 680, ms: 45,  type: 'sine',     volume: 0.3,  releaseMs: 38 },  rate: 1.0, rateJitter: 0.09, volume: 0.5 },
  score:   { tone: { freq: 500, ms: 120, type: 'triangle', volume: 0.4,  releaseMs: 95 },  rate: 1.0, rateJitter: 0.03, volume: 0.7 },
  bingo:   { tone: { freq: 660, ms: 300, type: 'triangle', volume: 0.5,  releaseMs: 230 }, rate: 1.0, rateJitter: 0.0,  volume: 0.9 },
};

export const SFX_EVENTS = Object.keys(SFX);

/**
 * Resolve playback params for an event, or null when muted / unknown.
 * @returns {{event, file, rate, volume} | null}
 */
export function pickSound(event, { enabled = true, rng = Math.random } = {}) {
  if (!enabled) return null;
  const spec = SFX[event];
  if (!spec) return null;
  const jitter = spec.rateJitter ? (rng() * 2 - 1) * spec.rateJitter : 0;
  const rate = Math.max(0.5, Math.min(2, spec.rate + jitter));
  return { event, file: event, rate: +rate.toFixed(4), volume: spec.volume };
}
