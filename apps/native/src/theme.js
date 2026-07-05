// theme.js — Soft & Cute design tokens ported 1:1 from apps/prototype/style.css.
// Light + dark palettes; premium-square colors + labels live here too.

export const LIGHT = {
  paper: '#F1F5EE', grad2: '#E7F0E6', surface: '#FFFFFF', card: '#E7EFE5', cellBg: '#F6F9F4',
  ink: '#33383A', inkSoft: '#5C6466', muted: '#98A0A0', line: '#E1E8DE', lineSoft: '#EDF1EA',
  accent: '#FF7A6B', accentPress: '#F0685A', accent2: '#2FB3A6', good: '#3DBB8B', warn: '#E8A13A',
  tileFace: '#FFFDF6', tileInk: '#3A3A44', tileLip: '#EAE2CE', tileShadow: 'rgba(70,70,80,0.18)',
  dl: '#CDE8F2', tl: '#A6D8EA', dw: '#FBD9D3', tw: '#FBC4B4', star: '#FBD3CB', premInk: '#5F6D72',
};

export const DARK = {
  paper: '#16201F', grad2: '#0F1716', surface: '#1E2A28', card: '#1A2624', cellBg: '#26322F',
  ink: '#ECEFEA', inkSoft: '#C4CCC9', muted: '#7E8987', line: '#2C3A38', lineSoft: '#233230',
  accent: '#FF8B7D', accentPress: '#F07C6E', accent2: '#4FC2B4', good: '#4ECB9B', warn: '#E8A13A',
  tileFace: '#F4EEE1', tileInk: '#33313A', tileLip: '#D8CFB9', tileShadow: 'rgba(0,0,0,0.42)',
  // poppier premium squares on the dark base: bright coral triple-word, vivid teal
  // letters, rich rose double-word; near-white labels for punch.
  dl: '#357C8C', tl: '#3FA6BC', dw: '#B45266', tw: '#E06A4E', star: '#8A4048', premInk: '#F4F7F5',
};

export function getTheme(scheme) {
  return scheme === 'dark' ? DARK : LIGHT;
}

// premium type -> board cell background token key
export const PREMIUM_BG = { DL: 'dl', TL: 'tl', DW: 'dw', TW: 'tw' };
// premium type -> the short label the web app shows
export const PREMIUM_LABEL = { DL: '2L', TL: '3L', DW: '2W', TW: '3W' };

export const FONT = 'Fredoka_400Regular';
export const FONT_SEMI = 'Fredoka_600SemiBold';
