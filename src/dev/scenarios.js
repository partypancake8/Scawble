// scenarios.js — opt-in DEV/testing setups that rig a game so every feature can
// be demoed on demand (a guaranteed bingo, a crossing-word hook, etc.). Pure
// data: each `rack` is dealt to the player via newGame(seed, { rack }) and each
// `rack` is a real ENABLE word so the play is always legal. `setup` (optional)
// pre-places committed words on the board via placeCommitted(). Reached only
// through the hidden dev menu; normal play and the daily are untouched.

export const SCENARIOS = [
  {
    id: 'bingo',
    name: 'Bingo opening',
    desc: 'RETINAS is pre-placed across the centre — just hit Submit for a 7-tile bingo (+50).',
    rack: 'RETINAS', // all value-1, distinct -> deterministic 7x2 + 50 = 64 on the centre DW
    autoPlay: true,  // pre-place the best play as a draft; you only confirm
  },
  {
    id: 'crossing',
    name: 'Crossing word',
    desc: 'HORNS is on the board and PAINTER is pre-placed as a crossing play — just Submit.',
    rack: 'PAINTER',
    setup: [{ word: 'HORNS', row: 7, col: 5, dir: 'H' }], // covers the centre so it is connected
    autoPlay: true,
  },
  {
    id: 'blank',
    name: 'Blank + hint',
    desc: 'Two blanks in the rack (test the blank picker); one Hint reveals the best play.',
    rack: 'AE__RST', // two blanks; placed manually to exercise the blank picker
  },
  {
    id: 'demo',
    name: 'Auto-play demo',
    desc: 'Sit back — the game plays itself end to end so you can watch every animation, bingo, and the final ScawBot review.',
    autoDemo: true,
  },
];

/** Look up a scenario by id (falls back to the first). */
export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}
