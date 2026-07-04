// controller.js — headless game orchestration (no DOM), so it's testable.
// Holds the GameState + lexicon/trie, drives player & bot turns, and records
// the ScawBot analysis log (best-move-you-missed + a luck proxy). PRD §05/§08.

import { newGame, applyMove, pass, swap } from './engine/state.js';
import { validate } from './engine/rules.js';
import { scoreMove } from './engine/score.js';
import { makeLexicon } from './lexicon/lexicon.js';
import { buildTrie, generateMoves } from './ai/generate.js';
import { chooseMove, bestMove } from './ai/bot.js';

export function createGame(words, { seed = 'default', difficulty = 'expert' } = {}) {
  const lexicon = makeLexicon(words, 'ENABLE');
  const trie = buildTrie(words);
  let state = newGame(seed);

  const analysis = [];        // per player turn: { actual, best, bestWords }
  let playerBestTotal = 0;    // sum of player's best-available scores (luck proxy)
  let botBestTotal = 0;

  const api = {
    get state() { return state; },
    lexicon, difficulty,

    /** Legal moves available to the player right now (for hints/highlights). */
    playerMoves() { return generateMoves(state.board, state.racks.player, trie, lexicon); },

    /** Best move available to the player right now. */
    playerBest() { return bestMove(state.board, state.racks.player, trie, lexicon); },

    /** Dry-run a set of placements (no commit): live legality + score preview. */
    preview(placements) {
      const v = validate(state.board, placements, lexicon);
      if (!v.ok) return { ok: false, error: v.error };
      const s = scoreMove(state.board, placements);
      return { ok: true, score: s.score, words: s.words, isBingo: s.isBingo };
    },

    /** Attempt the player's move. Returns { ok, error?, move? }. */
    commit(placements) {
      if (state.turn !== 'player') return { ok: false, error: 'Not your turn.' };
      const best = bestMove(state.board, state.racks.player, trie, lexicon);
      const res = applyMove(state, { placements }, lexicon);
      if (res.ok) {
        playerBestTotal += best ? best.score : 0;
        analysis.push({ actual: res.move.score, best: best ? best.score : 0, bestWords: best ? best.words : [], words: res.move.words });
      }
      return res;
    },

    pass() { if (state.turn !== 'player') return { ok: false }; return pass(state); },
    swap(tiles) { if (state.turn !== 'player') return { ok: false }; return swap(state, tiles); },

    /** Run the bot's turn. Returns the move record, or null if it passed. */
    botTurn() {
      if (state.turn !== 'bot' || state.over) return null;
      const best = bestMove(state.board, state.racks.bot, trie, lexicon);
      botBestTotal += best ? best.score : 0;
      const move = chooseMove(state.board, state.racks.bot, trie, lexicon, difficulty);
      if (!move) { pass(state); return null; }
      const res = applyMove(state, { placements: move.placements }, lexicon);
      return res.ok ? res.move : (pass(state), null);
    },

    /** Final analysis summary — the ScawBot review. */
    review() {
      const scored = analysis.filter((a) => a.best > 0);
      const strategy = scored.length
        ? Math.round((scored.reduce((s, a) => s + Math.min(1, a.actual / a.best), 0) / scored.length) * 100)
        : 100;
      const luckDen = playerBestTotal + botBestTotal;
      const luck = luckDen ? Math.round((playerBestTotal / luckDen) * 100) : 50;
      let bestPlay = { actual: 0 }; // no `words` until a real move beats it → renders "—"
      let biggestMiss = { gap: -1 };
      for (const a of analysis) {
        if (a.actual > bestPlay.actual) bestPlay = a;
        const gap = a.best - a.actual;
        if (gap > biggestMiss.gap) biggestMiss = { ...a, gap };
      }
      return { strategy, luck, turns: analysis.slice(), bestPlay, biggestMiss };
    },
  };
  return api;
}
