// score.js — score a move from its gathered words.
// Premium squares only count for tiles placed THIS turn. Letter multipliers
// apply to the tile; word multipliers multiply the whole word. Bingo = +50.
// See PRD §03/§07.

import { analyze } from './rules.js';
import { BINGO_BONUS, RACK_SIZE } from './tiles.js';

const LETTER_MULT = { DL: 2, TL: 3 };
const WORD_MULT = { DW: 2, TW: 3 };

/** Score one gathered word ({cells:[{tile,isNew,premium}]}). */
export function scoreWord(word) {
  let sum = 0;
  let wordMult = 1;
  for (const cell of word.cells) {
    let v = cell.tile.value; // blanks are 0
    if (cell.isNew && cell.premium && LETTER_MULT[cell.premium]) v *= LETTER_MULT[cell.premium];
    sum += v;
    if (cell.isNew && cell.premium && WORD_MULT[cell.premium]) wordMult *= WORD_MULT[cell.premium];
  }
  return sum * wordMult;
}

/**
 * Score a full move.
 * @returns {{score:number, words:string[], isBingo:boolean, ok:boolean, error?:string}}
 */
export function scoreMove(board, placements) {
  const a = analyze(board, placements);
  if (!a.ok) return { ok: false, error: a.error, score: 0, words: [], isBingo: false };

  let score = 0;
  for (const w of a.words) score += scoreWord(w);

  const isBingo = placements.length === RACK_SIZE;
  if (isBingo) score += BINGO_BONUS;

  return { ok: true, score, words: a.words.map((w) => w.text), isBingo };
}
