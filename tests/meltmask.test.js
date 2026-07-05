// meltmask.test.js — pure packing behind the SDF melt shader's board mask.
// Run: node tests/meltmask.test.js
import { filledKeys, maskBytes, maskSignature } from '../src/board/meltmask.js';
import { SIZE } from '../src/board/geometry.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));

// helper: empty board
const emptyBoard = () => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({})));

// --- filledKeys ---
{
  const b = emptyBoard();
  b[7][7] = { tile: { id: 't1', letter: 'A' } };
  b[7][8] = { tile: { id: 't2', letter: 'B' } };
  const draft = [{ row: 6, col: 7, tile: { id: 'd1' } }, { row: 5, col: 5, tile: { id: 'drag' } }];
  const keys = filledKeys(b, draft, 'drag');
  ok(keys.has('7,7') && keys.has('7,8'), 'committed tiles are in the filled set');
  ok(keys.has('6,7'), 'shown draft tile is in the filled set');
  ok(!keys.has('5,5'), 'the dragged tile is excluded');
  eq(keys.size, 3, 'exactly the 3 non-dragged filled cells');
}
{
  eq(filledKeys(emptyBoard()).size, 0, 'empty board -> no filled cells');
}

// --- maskBytes ---
{
  const px = maskBytes(new Set(['0,0', '7,7', `${SIZE - 1},${SIZE - 1}`]));
  eq(px.length, SIZE * SIZE * 4, 'mask is SIZE*SIZE*4 bytes');
  // (0,0) filled
  ok(px[0] === 255 && px[3] === 255, 'cell (0,0) packs to opaque white');
  // (7,7) filled at row-major offset
  const i = (7 * SIZE + 7) * 4;
  ok(px[i] === 255 && px[i + 3] === 255, 'cell (7,7) is filled at the right offset');
  // (0,1) empty
  ok(px[4] === 0 && px[7] === 0, 'an unfilled neighbour cell stays transparent black');
  // last cell filled
  const last = (SIZE * SIZE - 1) * 4;
  ok(px[last] === 255, 'the last cell packs at the end of the buffer');
}
{
  // exactly N cells set -> N*4 nonzero red bytes
  const keys = ['1,2', '3,4', '5,6'];
  const px = maskBytes(keys);
  let reds = 0; for (let i = 0; i < px.length; i += 4) if (px[i] === 255) reds++;
  eq(reds, 3, 'one filled red byte per key');
}
{
  // out-of-range keys are ignored, not thrown
  const px = maskBytes(['99,99', '-1,0']);
  let any = false; for (let i = 0; i < px.length; i++) if (px[i] !== 0) any = true;
  ok(!any, 'out-of-range keys are dropped');
}

// --- maskSignature ---
{
  eq(maskSignature(['7,7', '0,0']), maskSignature(new Set(['0,0', '7,7'])), 'signature is order-independent');
  ok(maskSignature(['0,0']) !== maskSignature(['0,1']), 'different sets differ');
}

console.log(`\nScawble meltmask tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
