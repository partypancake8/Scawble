// ai.test.js — move generation + bot. Every generated move is re-checked
// against the tested engine, so this proves the bot only makes legal moves.

import { VALUE } from '../src/engine/tiles.js';
import { makeBoard } from '../src/engine/board.js';
import { validate } from '../src/engine/rules.js';
import { scoreMove } from '../src/engine/score.js';
import { STARTER_WORDS, makeLexicon } from '../src/lexicon/lexicon.js';
import { buildTrie, generateMoves } from '../src/ai/generate.js';
import { bestMove, chooseMove, rankMoves } from '../src/ai/bot.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));

const LEX = makeLexicon(STARTER_WORDS, 'STARTER');
const TRIE = buildTrie(STARTER_WORDS);
let idc = 0;
const rack = (str) => [...str].map((ch) => ({ id: `r${idc++}`, letter: ch, value: VALUE[ch] ?? 0 }));

// helper: commit a plain word to a board
const commit = (board, str, r, c0) => { [...str].forEach((ch, i) => (board[r][c0 + i].tile = { id: `b${idc++}`, letter: ch, value: VALUE[ch] })); };

// --- 1. empty board: generation finds legal, correctly-scored, center-crossing moves ---
{
  const b = makeBoard();
  const moves = generateMoves(b, rack('CATSERO'), TRIE, LEX);
  ok(moves.length > 0, 'generates at least one opening move');
  // every move must be legal per the engine and score must match
  let allLegal = true, allScored = true, allWords = true;
  for (const m of moves) {
    const v = validate(b, m.placements, LEX);
    if (!v.ok) allLegal = false;
    if (scoreMove(b, m.placements).score !== m.score) allScored = false;
    if (!m.words.every((w) => LEX.isWord(w))) allWords = false;
  }
  ok(allLegal, 'every generated opening move is legal');
  ok(allScored, 'reported scores match the engine');
  ok(allWords, 'every formed word is in the lexicon');
  // a known word should be reachable
  ok(moves.some((m) => m.words.includes('CAT')), 'finds CAT from rack CATSERO');
}

// --- 2. bestMove returns the true maximum ---
{
  const b = makeBoard();
  const moves = generateMoves(b, rack('CATSERO'), TRIE, LEX);
  const best = bestMove(b, rack('CATSERO'), TRIE, LEX);
  const maxScore = Math.max(...moves.map((m) => m.score));
  eq(best.score, maxScore, 'bestMove score equals max over all moves');
}

// --- 3. hooking: with CAT on the board, new moves must connect and stay legal ---
{
  const b = makeBoard();
  commit(b, 'CAT', 7, 6);
  const moves = generateMoves(b, rack('NSAORED'), TRIE, LEX);
  ok(moves.length > 0, 'generates hooking moves onto CAT');
  ok(moves.every((m) => validate(b, m.placements, LEX).ok), 'every hooking move is legal & connected');
  // 'AN' (N under the A) should be among them
  ok(moves.some((m) => m.words.includes('AN')), 'finds the AN hook under CAT');
}

// --- 4. blanks act as wildcards ---
{
  const b = makeBoard();
  const withBlank = rack('CA').concat([{ id: 'bk', letter: '_', value: 0 }]).concat(rack('SERO'));
  const best = bestMove(b, withBlank, TRIE, LEX);
  ok(best !== null, 'a blank still yields a playable move');
  ok(best.words.every((w) => LEX.isWord(w)), 'blank-formed words are valid');
}

// --- 5. difficulty tiers all return a legal move (or pass) ---
{
  const b = makeBoard();
  const r = rack('CATSERO');
  let seed = 42; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const diff of ['casual', 'skilled', 'expert', 'brutal']) {
    const m = chooseMove(b, r, TRIE, LEX, diff, rng);
    ok(m && validate(b, m.placements, LEX).ok, `${diff} tier returns a legal move`);
  }
  // expert should equal the top-ranked move
  const ranked = rankMoves(generateMoves(b, r, TRIE, LEX), r);
  const expert = chooseMove(b, r, TRIE, LEX, 'expert', rng);
  eq(expert.score, ranked[0].score, 'expert picks the top-ranked move');
}

console.log(`\nScawble AI tests: ${passed} passed, ${failed} failed`);
if (fails.length) { console.log('\nFailures:'); for (const f of fails) console.log('  ✗ ' + f); }
if (typeof process !== 'undefined' && process.exit) process.exit(failed ? 1 : 0);
