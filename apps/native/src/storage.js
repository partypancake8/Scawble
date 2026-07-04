// storage.js — persistence for settings + stats (mirrors the web app's localStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'scawble.settings';
const STATS_KEY = 'scawble.stats';

export const DEFAULT_SETTINGS = { sound: true, haptics: true, motion: 'auto', theme: 'auto', difficulty: 'expert' };

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export async function saveSettings(s) {
  try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export async function loadStats() {
  try { const raw = await AsyncStorage.getItem(STATS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
export async function recordResult(won) {
  const s = await loadStats();
  s.games = (s.games || 0) + 1;
  s.wins = (s.wins || 0) + (won ? 1 : 0);
  s.streak = won ? (s.streak || 0) + 1 : 0;
  s.best = Math.max(s.best || 0, s.streak);
  try { await AsyncStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
  return s;
}
