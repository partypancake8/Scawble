// dev.test.js — the opt-in dev/scenario rig: dealRack, rigged newGame,
// placeCommitted, and the SCENARIOS data. Run: `node tests/dev.test.js`

import { makeBag, dealRack, VALUE } from '../src/engine/tiles.js';
import { newGame, applyMove, placeCommitted } from '../src/engine/state.js';
import { scoreMove } from '../src/engine/score.js';
import { makeLexicon } from '../src/lexicon/lexicon.js';
import { SCENARIOS, scenarioById } from '../src/dev/scenarios.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));

// --- dealRack ---
{
  const bag = makeBag('rig');
  const before = bag.length;
  const rack = dealRack(bag, 'RETINAS');
  eq(rack.map((t) => t.letter).join(''), 'RETINAS', 'dealRack returns letters in order');
  eq(bag.length, before - 7, 'dealRack removes exactly 7 from the bag');
  eq(new Set(rack.map((t) => t.id)).size, 7, 'rigged tiles have unique ids');
  ok(rack.every((t) => t.value === VALUE[t.letter]), 'rigged tiles carry correct values');
  ok(!bag.some((t) => rack.some((r) => r.id === t.id)), 'rigged tiles are gone from the bag');
}
{
  let threw = false;
  try { dealRack(makeBag('x'), 'ZZZ'); } catch { threw = true; } // only one Z exists
  ok(threw, 'dealRack throws when a letter is exhausted');
}
{
  const r = dealRack(makeBag('b'), 'AE__RST');
  eq(r.filter((t) => t.letter === '_').length, 2, 'dealRack can pull blanks');
}

// --- rigged newGame vs the untouched default path ---
{
  const g = newGame('rig', { rack: 'RETINAS' });
  eq(g.racks.player.map((t) => t.letter).join(''), 'RETINAS', 'player rack is rigged');
  eq(g.racks.bot.length, 7, 'bot still dealt 7');
  const ids = [...g.bag, ...g.racks.player, ...g.racks.bot].map((t) => t.id);
  eq(new Set(ids).size, 100, 'tile conservation: 100 unique ids');
  eq(g.bag.length, 100 - 14, 'bag = 100 - 14 after the rigged deal');
}
{
  eq(newGame('same').racks.player.map((t) => t.letter).join(''),
     newGame('same').racks.player.map((t) => t.letter).join(''), 'unrigged deal deterministic by seed');
  eq(newGame('same').racks.player.length, 7, 'unrigged deal still 7 tiles (daily untouched)');
}

// --- end-to-end: the rigged opening is a legal centre bingo ---
{
  const g = newGame('rig', { rack: 'RETINAS' });
  const placements = g.racks.player.map((tile, i) => ({ tile, row: 7, col: 4 + i }));
  const s = scoreMove(g.board, placements);
  ok(s.isBingo, 'rigged RETINAS opening is a bingo');
  eq(s.score, 64, 'RETINAS across the centre = 7*2 (centre DW) + 50 = 64');
  const res = applyMove(g, { placements }, makeLexicon(['RETINAS']));
  ok(res.ok, 'rigged bingo is a legal opening move');
}

// --- placeCommitted (crossing scenario scaffolding) ---
{
  const g = newGame('cross', { rack: 'PAINTER' });
  placeCommitted(g, { word: 'HORNS', row: 7, col: 5, dir: 'H' });
  eq([5, 6, 7, 8, 9].map((c) => g.board[7][c].tile.letter).join(''), 'HORNS', 'placeCommitted lays the word on the board');
  const all = [...g.bag, ...g.racks.player, ...g.racks.bot, ...[5, 6, 7, 8, 9].map((c) => g.board[7][c].tile)];
  eq(new Set(all.map((t) => t.id)).size, 100, 'placeCommitted preserves the 100-tile invariant');
}

// --- SCENARIOS data ---
{
  ok(SCENARIOS.length >= 2, 'at least two scenarios defined');
  ok(scenarioById('bingo').rack === 'RETINAS', 'scenarioById finds the bingo scenario');
  ok(scenarioById('nope').id === SCENARIOS[0].id, 'scenarioById falls back to the first');
  for (const sc of SCENARIOS.filter((s) => s.rack)) {
    let dealable = true;
    try { dealRack(makeBag('s'), sc.rack); } catch { dealable = false; }
    ok(dealable, `scenario '${sc.id}' rack is dealable from a fresh bag`);
  }
  ok(SCENARIOS.some((s) => s.autoDemo), 'an auto-play demo scenario exists');
}

console.log(`\nScawble dev tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
