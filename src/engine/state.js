// state.js — game state + reducer (new game, apply move, swap, pass).
// Implements Crossplay's "fair endgame": once the bag empties, both sides get
// an equal number of final turns before the game ends. See PRD §07.

import { makeBoard } from './board.js';
import { makeBag, draw, makeRng, RACK_SIZE } from './tiles.js';
import { validate } from './rules.js';
import { scoreMove } from './score.js';

/**
 * @typedef {Object} GameState
 * @property {Array} board
 * @property {Array} bag
 * @property {{player:Array, bot:Array}} racks
 * @property {{player:number, bot:number}} scores
 * @property {'player'|'bot'} turn
 * @property {Array} history
 * @property {string} seed
 * @property {boolean} over
 * @property {number} passes  consecutive passes/exchanges
 * @property {?number} finalCountdown  plies left once the bag emptied
 */

/** Start a new game. Player moves first. */
export function newGame(seed = 'default') {
  const bag = makeBag(seed);
  const player = draw(bag, RACK_SIZE);
  const bot = draw(bag, RACK_SIZE);
  return {
    board: makeBoard(),
    bag,
    racks: { player, bot },
    scores: { player: 0, bot: 0 },
    turn: 'player',
    history: [],
    seed: String(seed),
    over: false,
    passes: 0,
    finalCountdown: null,
  };
}

const other = (who) => (who === 'player' ? 'bot' : 'player');

/** Remove tiles (by id) from a rack; returns removed or null if any missing. */
function takeFromRack(rack, tiles) {
  const ids = new Set(tiles.map((t) => t.id));
  if (new Set(tiles.map((t) => t.id)).size !== tiles.length) return null; // dup ids
  for (const t of tiles) if (!rack.find((r) => r.id === t.id)) return null;
  for (const id of ids) {
    const i = rack.findIndex((r) => r.id === id);
    rack.splice(i, 1);
  }
  return tiles;
}

/** Advance endgame bookkeeping and flip the turn (or end the game). */
function endPly(state) {
  if (state.finalCountdown !== null) {
    state.finalCountdown -= 1;
    if (state.finalCountdown <= 0) { finishGame(state); return; }
  } else if (state.bag.length === 0) {
    state.finalCountdown = 2; // one more turn for each side
  }
  state.turn = other(state.turn);
}

/** Subtract each side's unplayed tile values from their score. */
function finishGame(state) {
  state.over = true;
  for (const who of ['player', 'bot']) {
    const left = state.racks[who].reduce((s, t) => s + t.value, 0);
    state.scores[who] -= left;
  }
}

/**
 * Apply a move for the side whose turn it is.
 * @param move {{placements:Array}}  placements use tiles currently in that rack.
 * @param lexicon object with isWord(str)
 * @returns {{ok:boolean, error?:string, state:GameState, move?:object}}
 */
export function applyMove(state, move, lexicon) {
  if (state.over) return { ok: false, error: 'Game over.', state };
  const rack = state.racks[state.turn];

  // every placed tile must be in the current rack
  const placedTiles = move.placements.map((p) => p.tile);
  if (!placedTiles.every((t) => rack.find((r) => r.id === t.id)))
    return { ok: false, error: 'Tile not in rack.', state };

  const v = validate(state.board, move.placements, lexicon);
  if (!v.ok) return { ok: false, error: v.error, state };

  const s = scoreMove(state.board, move.placements);
  if (!s.ok) return { ok: false, error: s.error, state };

  // commit: place on board, remove from rack, score, refill
  for (const p of move.placements) state.board[p.row][p.col].tile = p.tile;
  takeFromRack(rack, placedTiles);
  state.scores[state.turn] += s.score;
  const record = { by: state.turn, placements: move.placements, words: s.words, score: s.score, isBingo: s.isBingo };
  state.history.push(record);
  rack.push(...draw(state.bag, RACK_SIZE - rack.length));
  state.passes = 0;

  endPly(state);
  return { ok: true, state, move: record };
}

/** Pass the turn. Four passes in a row ends the game. */
export function pass(state) {
  if (state.over) return { ok: false, error: 'Game over.', state };
  state.passes += 1;
  state.history.push({ by: state.turn, pass: true, score: 0 });
  if (state.passes >= 4) { finishGame(state); return { ok: true, state }; }
  endPly(state);
  return { ok: true, state };
}

/** Exchange tiles: only if the bag holds at least as many tiles as you swap. */
export function swap(state, tiles) {
  if (state.over) return { ok: false, error: 'Game over.', state };
  if (state.bag.length < tiles.length) return { ok: false, error: 'Not enough tiles left in the bag to swap that many.', state };
  const rack = state.racks[state.turn];
  if (!takeFromRack(rack, tiles)) return { ok: false, error: 'Tile not in rack.', state };
  rack.push(...draw(state.bag, tiles.length)); // draw replacements before returning the old tiles
  state.bag.push(...tiles);
  // reshuffle so exchanged tiles aren't drawn straight back; seeded to stay deterministic
  const rng = makeRng(`${state.seed}:swap:${state.history.length}`);
  for (let i = state.bag.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [state.bag[i], state.bag[j]] = [state.bag[j], state.bag[i]]; }
  state.passes += 1;
  state.history.push({ by: state.turn, swap: tiles.length, score: 0 });
  endPly(state);
  return { ok: true, state };
}
