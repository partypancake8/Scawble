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
    desc: 'Lay RETINAS across the centre for a 7-tile bingo (+50): confetti, settle, score chip.',
    rack: 'RETINAS', // all value-1, distinct -> deterministic 7x2 + 50 = 64 on the centre DW
  },
  {
    id: 'crossing',
    name: 'Crossing word',
    desc: 'HORNS is already on the board; hook a crossing play with PAINTER in your rack.',
    rack: 'PAINTER',
    setup: [{ word: 'HORNS', row: 7, col: 5, dir: 'H' }], // covers the centre so it is connected
  },
  {
    id: 'blank',
    name: 'Blank + hint',
    desc: 'Two blanks in the rack (test the blank picker); one Hint reveals the best play.',
    rack: 'AE__RST', // two blanks; still a rich rack to build from
  },
];

/** Look up a scenario by id (falls back to the first). */
export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}
