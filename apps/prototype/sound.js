// sound.js — tiny WebAudio SFX, pitch-randomized so repeats never feel canned
// (PRD §04). No audio assets; everything is synthesized.

let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }
export function resume() { // call from a user gesture
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function blip({ freq = 440, type = 'sine', dur = 0.08, gain = 0.08, slide = 0 }) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}
const jitter = (f, pct = 0.05) => f * (1 + (Math.random() * 2 - 1) * pct);

export const sfx = {
  pickup: () => blip({ freq: jitter(520), type: 'triangle', dur: 0.06, gain: 0.05 }),
  place:  () => blip({ freq: jitter(320), type: 'square', dur: 0.05, gain: 0.05, slide: -60 }),
  invalid:() => blip({ freq: 120, type: 'sawtooth', dur: 0.18, gain: 0.06, slide: -30 }),
  tick:   (i = 0) => blip({ freq: 440 + i * 60, type: 'sine', dur: 0.05, gain: 0.05 }),
  score:  () => blip({ freq: jitter(660), type: 'triangle', dur: 0.12, gain: 0.07, slide: 220 }),
  bingo:  () => { [0, 90, 180].forEach((ms, i) => setTimeout(() => blip({ freq: 523 + i * 130, type: 'triangle', dur: 0.16, gain: 0.09 }), ms)); },
};

export function haptic(pattern, on = true) {
  if (on && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
}
