// bot.js — pick a move at a given difficulty, and expose bestMove for analysis.
// Evaluation = move score + a light "leave value" for the tiles kept back.
// Tiers reach different distances down the ranked list (PRD §08).

import { generateMoves } from './generate.js';
import { letterOf } from '../engine/tiles.js';

// crude leave values: keeping a blank or S is great; balance vowels/consonants.
const LEAVE = { _: 25, S: 8, E: 4, A: 3, R: 3, I: 2, N: 2, T: 2, O: 1, L: 1, D: 1, U: -1, G: -1, V: -3, W: -3, Q: -6 };

function leaveValue(tiles) {
  let v = 0;
  for (const t of tiles) v += LEAVE[t.letter] ?? 0;
  return v;
}

/** rack tiles not used by a move (by id). */
function remainder(rack, move) {
  const used = new Set(move.placements.map((p) => p.tile.id));
  return rack.filter((t) => !used.has(t.id));
}

/** Rank moves by score + leave value (desc). Returns a new array. */
export function rankMoves(moves, rack) {
  return moves
    .map((m) => ({ move: m, ev: m.score + leaveValue(remainder(rack, m)) }))
    .sort((a, b) => b.ev - a.ev || b.move.score - a.move.score)
    .map((x) => x.move);
}

export const DIFFICULTY = ['casual', 'skilled', 'expert', 'brutal'];

/**
 * Choose a move for the bot. Returns the move, or null if it must pass.
 * @param rng optional () => [0,1) for reproducible choices.
 */
export function chooseMove(board, rack, trie, lexicon, difficulty = 'expert', rng = Math.random) {
  const moves = generateMoves(board, rack, trie, lexicon);
  if (moves.length === 0) return null;
  const ranked = rankMoves(moves, rack);
  const n = ranked.length;
  let idx = 0;
  if (difficulty === 'casual') {
    const lo = Math.floor(n * 0.4), hi = Math.max(lo, Math.floor(n * 0.7));
    idx = lo + Math.floor(rng() * (hi - lo + 1));
  } else if (difficulty === 'skilled') {
    idx = Math.floor(rng() * Math.max(1, Math.ceil(n * 0.15)));
  } // expert & brutal => idx 0 (best). brutal will get 2-ply sim later.
  return ranked[Math.min(idx, n - 1)];
}

/** Highest-scoring legal move for a position — powers the CrossBot analysis. */
export function bestMove(board, rack, trie, lexicon) {
  const moves = generateMoves(board, rack, trie, lexicon);
  if (moves.length === 0) return null;
  return moves.reduce((a, b) => (b.score > a.score ? b : a));
}
