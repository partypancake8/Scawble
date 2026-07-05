// melt.test.js — pure topology behind the tile melt (connectors + enclosedEmpty).
// This is the regression guard for the "filled-in empty area" bug. Run: node tests/melt.test.js
import { connectors, enclosedEmpty } from '../src/board/melt.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));
const cells = (...pairs) => pairs.map(([row, col]) => ({ row, col }));

// --- connectors ---
{
  // straight 3-cell horizontal word -> 2 horizontal connectors
  const c = connectors(cells([7, 5], [7, 6], [7, 7]));
  eq(c.length, 2, 'straight 3-word has 2 connectors');
  ok(c.every((x) => x.dir === 'h'), 'all horizontal for a horizontal word');
}
{
  // plus/cross: centre + 4 arms -> 4 connectors (2 h, 2 v)
  const c = connectors(cells([7, 7], [7, 6], [7, 8], [6, 7], [8, 7]));
  eq(c.length, 4, 'a plus has 4 connectors');
  eq(c.filter((x) => x.dir === 'h').length, 2, 'plus has 2 horizontal connectors');
  eq(c.filter((x) => x.dir === 'v').length, 2, 'plus has 2 vertical connectors');
}
{
  // diagonally-touching cells are NOT adjacent -> no connectors (empties never bridged)
  eq(connectors(cells([3, 3], [4, 4])), [], 'diagonal touch is not bridged');
  eq(connectors(cells([3, 3])), [], 'a lone tile has no connectors');
}
{
  // each pair listed exactly once (a 2x2 block: 2 horiz + 2 vert = 4, not 8)
  const c = connectors(cells([0, 0], [0, 1], [1, 0], [1, 1]));
  eq(c.length, 4, '2x2 block lists each adjacency once');
}

// --- enclosedEmpty (the hole-fill regression guard) ---
{
  // ring of 8 tiles around one empty centre -> the centre is enclosed
  const ring = cells([6, 6], [6, 7], [6, 8], [7, 6], [7, 8], [8, 6], [8, 7], [8, 8]);
  eq(enclosedEmpty(ring), [{ row: 7, col: 7 }], 'a ring encloses its centre');
}
{
  // straight word encloses nothing
  eq(enclosedEmpty(cells([7, 5], [7, 6], [7, 7])), [], 'a straight word encloses no empty');
}
{
  // an open-ended slot between two parallel words is reachable from the border -> not enclosed
  const parallel = cells([7, 4], [7, 5], [7, 6], [9, 4], [9, 5], [9, 6]);
  eq(enclosedEmpty(parallel), [], 'an open slot between parallel words is not enclosed');
}
{
  // a closed 2x2 courtyard: 4x4 ring of tiles around a 2x2 empty centre
  const filled = [];
  for (let r = 5; r <= 8; r++) for (let c = 5; c <= 8; c++) if (r === 5 || r === 8 || c === 5 || c === 8) filled.push({ row: r, col: c });
  const enc = enclosedEmpty(filled);
  eq(enc.length, 4, 'a closed 2x2 courtyard has 4 enclosed empties');
  ok(enc.every((p) => p.row >= 6 && p.row <= 7 && p.col >= 6 && p.col <= 7), 'the enclosed cells are the interior 2x2');
}

console.log(`\nScawble melt tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
