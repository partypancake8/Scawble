// sound.js — SFX playback for the native app, wired to the pure sound-design
// table (core/audio/sfx.js) and the pre-synthesized WAV assets (npm run build-sfx).
//
// Design notes:
//  - GUARDED: if the audio runtime isn't available (e.g. a stripped Expo Go),
//    every call no-ops instead of throwing. Sound is juice, never load-bearing —
//    it must never crash the game.
//  - Honors the Sound setting via `soundOn` (was previously a dead toggle).
//  - Rate jitter + per-event volume come from the SAME pickSound() logic the unit
//    tests cover, so on-device behavior matches what's tested.
import { pickSound, SFX_EVENTS } from './core/audio/sfx.js';

// Lazy, guarded handle to expo-audio so a missing native module can't crash import.
let AudioMod = null;
try { AudioMod = require('expo-audio'); } catch { AudioMod = null; }

// Each SFX is a bundled asset (Metro treats .wav as an asset by default).
const FILES = {
  pickup: require('../assets/sfx/pickup.wav'),
  place: require('../assets/sfx/place.wav'),
  invalid: require('../assets/sfx/invalid.wav'),
  tick: require('../assets/sfx/tick.wav'),
  score: require('../assets/sfx/score.wav'),
  bingo: require('../assets/sfx/bingo.wav'),
};

const players = {};
let inited = false;
let available = false;

/** Create one AudioPlayer per SFX. Safe to call repeatedly; runs once. */
export function initSound() {
  if (inited) return available;
  inited = true;
  if (!AudioMod || typeof AudioMod.createAudioPlayer !== 'function') return false;
  try {
    for (const name of SFX_EVENTS) players[name] = AudioMod.createAudioPlayer(FILES[name]);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/**
 * Play the SFX for a game event, honoring the Sound setting. Never throws.
 * @param event one of SFX_EVENTS
 * @param soundOn the user's Sound setting
 */
export function playSfx(event, soundOn = true) {
  const spec = pickSound(event, { enabled: soundOn });
  if (!spec) return;                 // muted or unknown event
  if (!inited) initSound();
  if (!available) return;            // no audio runtime -> silently skip
  const player = players[spec.file];
  if (!player) return;
  try {
    player.volume = spec.volume;
    if (typeof player.setPlaybackRate === 'function') player.setPlaybackRate(spec.rate);
    player.seekTo(0);                // rewind so rapid repeats retrigger
    player.play();
  } catch {
    // a transient playback error must never bubble into gameplay
  }
}
