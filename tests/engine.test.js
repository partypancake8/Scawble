// engine.test.js — zero-dependency test runner for the Scawble engine.
// Run: `node tests/engine.test.js`  (also loadable in a browser module).
// Covers PRD §11 Definition-of-Done: engine gate.

import { VALUE, makeBag, TOTAL_TILES } from '../src/engine/tiles.js';
import { makeBoard } from '../src/engine/board.js';
import { scoreMove } from '../src/engine/score.js';
import { validate } from '../src/engine/rules.js';
import { newGame, applyMove, pass } from '../src/engine/state.js';
import { starterLexicon as LEX } from '../src/lexicon/lexicon.js';

// --- tiny harness ---
let passed = 0, failed = 0; const fails = [];
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));

// helpers
let idc = 0;
const T = (letter, r, c) => ({ tile: { id: `t${idc++}`, letter, value: VALUE[letter] }, row: r, col: c });
const Blank = (assigned, r, c) => ({ tile: { id: `t${idc++}`, letter: '_', value: 0, assigned }, row: r, col: c });
const word = (str, r, c0, horiz = true) => [...str].map((ch, i) => T(ch, horiz ? r : r + i, horiz ? c0 + i : c0));

// --- 1. bag integrity ---
ok(TOTAL_TILES === 100, `bag total should be 100, got ${TOTAL_TILES}`);
eq(makeBag('seed').length, 100, 'makeBag length');
// deterministic
eq(makeBag('abc').map(t => t.letter).join(''), makeBag('abc').map(t => t.letter).join(''), 'bag is deterministic by seed');
ok(makeBag('abc').map(t => t.letter).join('') !== makeBag('xyz').map(t => t.letter).join(''), 'different seeds differ');

// --- 2. first move CAT across center = (2+1+1)*2 = 8 ---
{
  const b = makeBoard();
  const s = scoreMove(b, word('CAT', 7, 6));
  ok(s.ok, 'CAT valid geometry');
  eq(s.score, 8, 'CAT center double-word score');
  eq(s.isBingo, false, 'CAT not a bingo');
}

// --- 3. blank scores zero: blank-C + A + T over center = (0+1+1)*2 = 4 ---
{
  const b = makeBoard();
  const s = scoreMove(b, [Blank('C', 7, 6), T('A', 7, 7), T('T', 7, 8)]);
  eq(s.score, 4, 'blank contributes 0 points');
}

// --- 4. letter + word premium stacking: OATEN cols3..7, O on DL(7,3), center DW ---
{
  const b = makeBoard();
  const s = scoreMove(b, word('OATEN', 7, 3)); // O A T E N at cols 3,4,5,6,7
  // O:1*2(DL)=2, A1,T1,E1,N1 => 6, then *2 (center DW) => 12
  eq(s.score, 12, 'DL + DW stacking');
}

// --- 5. cross-word scoring: CAT, then AN downward off the A ---
{
  const b = makeBoard();
  scoreMoveCommit(b, word('CAT', 7, 6));           // place CAT
  const s = scoreMove(b, [T('N', 8, 7)]);          // N under A(7,7) => "AN"
  ok(s.ok, 'AN valid');
  eq(s.words, ['AN'], 'forms AN vertically');
  eq(s.score, 2, 'AN = A1 + N1');
}

// --- 6. bingo: FRIENDS (7 tiles) across center: sum 10 *2(DW) +50 = 70 ---
{
  const b = makeBoard();
  const s = scoreMove(b, word('FRIENDS', 7, 4)); // cols 4..10 covers center 7
  eq(s.isBingo, true, 'FRIENDS is a bingo');
  eq(s.score, 70, 'FRIENDS bingo score');
}

// --- 7. first move must cross center ---
{
  const b = makeBoard();
  const v = validate(b, word('CAT', 0, 0), LEX);
  ok(!v.ok && /center/i.test(v.error), 'first move off-center rejected');
}

// --- 8. non-first move must connect ---
{
  const b = makeBoard();
  scoreMoveCommit(b, word('CAT', 7, 6));
  const v = validate(b, word('AT', 0, 0), LEX);
  ok(!v.ok && /connect/i.test(v.error), 'disconnected move rejected');
}

// --- 9. illegal words rejected ---
{
  const b = makeBoard();
  const v = validate(b, word('AZ', 7, 7), LEX); // AZ not in lexicon
  ok(!v.ok && /not a word/i.test(v.error), 'non-word rejected');
}

// --- 10. gap in word rejected ---
{
  const b = makeBoard();
  const v = validate(b, [T('C', 7, 6), T('T', 7, 8)], LEX); // gap at 7,7
  ok(!v.ok && /gap/i.test(v.error), 'gapped placement rejected');
}

// --- 11. applyMove end-to-end (custom rack) ---
{
  const g = newGame('game1');
  g.racks.player = word('CAT', 7, 6).map(p => p.tile); // rack = C,A,T
  const before = g.bag.length;
  const res = applyMove(g, { placements: word('CAT', 7, 6).map((p, i) => ({ tile: g.racks.player[i], row: 7, col: 6 + i })) }, LEX);
  ok(res.ok, `applyMove ok (${res.error || ''})`);
  eq(g.scores.player, 8, 'score applied to player');
  eq(g.turn, 'bot', 'turn passes to bot');
  eq(g.racks.player.length, 7, 'rack refilled to 7');
  ok(g.bag.length === before - 7, 'bag drew 7 to refill an emptied rack');
  ok(!!g.board[7][7].tile, 'tile committed to board');
}

// --- 12. fair endgame: once bag empty, both sides get one final turn ---
{
  const g = newGame('end');
  g.bag = []; // simulate empty bag
  pass(g); ok(g.finalCountdown === 2 && !g.over, 'countdown armed on empty bag');
  pass(g); ok(g.finalCountdown === 1 && !g.over, 'one final ply consumed');
  pass(g); ok(g.over, 'game ends after equal final turns');
  ok(g.scores.player <= 0 && g.scores.bot <= 0, 'leftover racks deducted at end');
}

// commit helper: place a move's tiles onto the board (test scaffolding)
function scoreMoveCommit(board, placements) {
  const s = scoreMove(board, placements);
  if (!s.ok) throw new Error('commit of invalid move: ' + s.error);
  for (const p of placements) board[p.row][p.col].tile = p.tile;
  return s;
}

// --- report ---
console.log(`\nScawble engine tests: ${passed} passed, ${failed} failed`);
if (fails.length) { console.log('\nFailures:'); for (const f of fails) console.log('  ✗ ' + f); }
if (typeof process !== 'undefined' && process.exit) process.exit(failed ? 1 : 0);
