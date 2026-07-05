// wav.js — build a 16-bit PCM mono WAV (as bytes / base64) for a short
// synthesized tone. PURE + dependency-free so the byte layout is unit-tested.
// A build script (scripts/build-sfx.mjs) uses this to emit the app's SFX assets;
// the native sound layer just plays the resulting files. No Node/Buffer deps.

function writeStr(b, off, s) { for (let i = 0; i < s.length; i++) b[off + i] = s.charCodeAt(i); }
function writeU32(b, off, v) { b[off] = v & 255; b[off + 1] = (v >>> 8) & 255; b[off + 2] = (v >>> 16) & 255; b[off + 3] = (v >>> 24) & 255; }
function writeU16(b, off, v) { b[off] = v & 255; b[off + 1] = (v >>> 8) & 255; }

// One waveform sample in [-1, 1] for a normalized phase in [0, 1).
export function wave(type, phase) {
  if (type === 'square') return phase < 0.5 ? 1 : -1;
  if (type === 'triangle') return 4 * Math.abs(phase - 0.5) - 1;
  if (type === 'saw') return 2 * phase - 1;
  return Math.sin(phase * Math.PI * 2); // sine (default)
}

/**
 * Render a tone to a WAV byte array.
 * opts: { freq, ms, type, volume, sampleRate, attackMs, releaseMs }
 * A short attack + release envelope avoids clicks.
 */
export function toneWav({ freq = 440, ms = 120, type = 'sine', volume = 0.5, sampleRate = 22050, attackMs = 4, releaseMs = 60 } = {}) {
  const n = Math.max(1, Math.floor((sampleRate * ms) / 1000));
  const bytes = new Uint8Array(44 + n * 2);
  // RIFF / WAVE header
  writeStr(bytes, 0, 'RIFF'); writeU32(bytes, 4, 36 + n * 2); writeStr(bytes, 8, 'WAVE');
  writeStr(bytes, 12, 'fmt '); writeU32(bytes, 16, 16); writeU16(bytes, 20, 1); writeU16(bytes, 22, 1);
  writeU32(bytes, 24, sampleRate); writeU32(bytes, 28, sampleRate * 2); writeU16(bytes, 32, 2); writeU16(bytes, 34, 16);
  writeStr(bytes, 36, 'data'); writeU32(bytes, 40, n * 2);
  const atk = Math.max(1, (sampleRate * attackMs) / 1000);
  const rel = Math.max(1, (sampleRate * releaseMs) / 1000);
  for (let i = 0; i < n; i++) {
    const phase = ((i * freq) / sampleRate) % 1;
    let env = 1;
    if (i < atk) env = i / atk;
    if (i > n - rel) env = Math.max(0, (n - i) / rel);
    const s = wave(type, phase) * volume * env;
    const v = (Math.max(-1, Math.min(1, s)) * 32767) | 0;
    writeU16(bytes, 44 + i * 2, v & 0xffff);
  }
  return bytes;
}

// Portable base64 (no Buffer/atob) so the same code runs in Node and RN.
export function bytesToBase64(bytes) {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += T[b0 >> 2];
    out += T[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += i + 1 < bytes.length ? T[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)] : '=';
    out += i + 2 < bytes.length ? T[b2 & 63] : '=';
  }
  return out;
}
