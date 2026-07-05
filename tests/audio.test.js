// audio.test.js — zero-dependency tests for the sound synthesis + SFX mapping.
// Run: `node tests/audio.test.js`

import { toneWav, wave, bytesToBase64 } from '../src/audio/wav.js';
import { SFX, SFX_EVENTS, pickSound } from '../src/audio/sfx.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const str = (bytes, off, len) => String.fromCharCode(...bytes.slice(off, off + len));
const u32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);

// --- wav header + framing ---
const sr = 22050, ms = 100;
const w = toneWav({ freq: 440, ms, sampleRate: sr });
const n = Math.floor((sr * ms) / 1000);
ok(w.length === 44 + n * 2, 'wav byte length = 44 header + 16-bit samples');
ok(str(w, 0, 4) === 'RIFF', 'RIFF magic');
ok(str(w, 8, 4) === 'WAVE', 'WAVE magic');
ok(str(w, 12, 4) === 'fmt ', 'fmt chunk');
ok(str(w, 36, 4) === 'data', 'data chunk');
ok(u32(w, 24) === sr, 'sample rate encoded in header');
ok(u32(w, 40) === n * 2, 'data chunk size = samples * 2');
ok(u32(w, 4) === 36 + n * 2, 'RIFF chunk size correct');
ok((w[22] | (w[23] << 8)) === 1, 'mono (1 channel)');
ok((w[34] | (w[35] << 8)) === 16, '16 bits per sample');

// deterministic + non-silent
const w2 = toneWav({ freq: 440, ms, sampleRate: sr });
ok(w.length === w2.length && w.every((v, i) => v === w2[i]), 'tone synthesis is deterministic');
let nonZero = false;
for (let i = 44; i < w.length; i++) if (w[i] !== 0) { nonZero = true; break; }
ok(nonZero, 'tone has non-silent samples');

// waveforms in range and shaped right
ok(Math.abs(wave('sine', 0.25) - 1) < 1e-9, 'sine peaks at quarter phase');
ok(wave('square', 0.25) === 1 && wave('square', 0.75) === -1, 'square flips at half phase');
ok(Math.abs(wave('triangle', 0) - 1) < 1e-9, 'triangle peaks at the phase edges');
ok(Math.abs(wave('triangle', 0.5) + 1) < 1e-9, 'triangle troughs at mid phase');
let inRange = true;
for (const ty of ['sine', 'square', 'triangle', 'saw']) for (let ph = 0; ph < 1; ph += 0.05) { const v = wave(ty, ph); if (v < -1.0001 || v > 1.0001) inRange = false; }
ok(inRange, 'all waveforms stay within [-1, 1]');

// base64 length is the expected padded size
const b64 = bytesToBase64(w);
ok(b64.length === Math.ceil(w.length / 3) * 4, 'base64 length is 4*ceil(bytes/3)');
ok(bytesToBase64(new Uint8Array([77, 97, 110])) === 'TWFu', 'base64 encodes a known vector');

// --- sfx mapping ---
ok(SFX_EVENTS.length === 6, 'six SFX events defined');
ok(SFX_EVENTS.every((e) => SFX[e].tone && SFX[e].tone.freq > 0), 'every event has a valid tone spec');

ok(pickSound('place', { enabled: false }) === null, 'muted => no sound');
ok(pickSound('nope', { enabled: true }) === null, 'unknown event => no sound');
const s = pickSound('place', { enabled: true, rng: () => 0.5 });
ok(s && s.file === 'place' && s.volume === SFX.place.volume, 'valid event resolves file + volume');
// rng=0.5 => zero jitter => exact base rate
ok(pickSound('place', { rng: () => 0.5 }).rate === SFX.place.rate, 'centered rng gives base rate');
// jitter stays within the configured band
const lo = pickSound('pickup', { rng: () => 0 }).rate;
const hi = pickSound('pickup', { rng: () => 1 }).rate;
ok(lo === +(SFX.pickup.rate - SFX.pickup.rateJitter).toFixed(4), 'min jitter = rate - jitter');
ok(hi === +(SFX.pickup.rate + SFX.pickup.rateJitter).toFixed(4), 'max jitter = rate + jitter');
// zero-jitter event is exact regardless of rng
ok(pickSound('invalid', { rng: () => 0 }).rate === SFX.invalid.rate, 'no-jitter event ignores rng');

console.log(`\nScawble audio tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
