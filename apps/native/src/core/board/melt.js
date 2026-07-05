// melt.js — pure topology for the tile "melt". The renderer (SkiaBoard) fuses
// placed tiles into one soft blob by unioning each cell's rounded square with a
// CONNECTOR rect bridging the gap between orthogonally-adjacent FILLED cells.
// The load-bearing correctness claim is here (and unit-tested): only real
// adjacencies are bridged, so an enclosed EMPTY cell is never part of the blob
// (the old oversized-square union + CornerPathEffect used to pinch small holes
// shut and colour them in). Zero-dep; runs in Node tests and RN alike.
import { SIZE } from './geometry.js';

const key = (r, c) => `${r},${c}`;
const toSet = (filled) => (filled instanceof Set ? filled : new Set(filled.map(({ row, col }) => key(row, col))));

/**
 * Every orthogonally-adjacent pair of filled cells, listed once, with direction.
 * @param filled Array<{row,col}> or Set<"r,c">
 * @returns Array<{a:{row,col}, b:{row,col}, dir:'h'|'v'}>  ('h' => a left of b, 'v' => a above b)
 * SkiaBoard draws exactly one connector rect per entry. Diagonal-only touches and
 * empty neighbours are never returned, so empties are never bridged.
 */
export function connectors(filled) {
  const set = toSet(filled);
  const out = [];
  for (const k of set) {
    const [r, c] = k.split(',').map(Number);
    if (set.has(key(r, c + 1))) out.push({ a: { row: r, col: c }, b: { row: r, col: c + 1 }, dir: 'h' });
    if (set.has(key(r + 1, c))) out.push({ a: { row: r, col: c }, b: { row: r + 1, col: c }, dir: 'v' });
  }
  return out;
}

/**
 * Empty cells that cannot reach the border through other empty cells, i.e. fully
 * enclosed by tiles. The melt must NEVER colour these. Flood-fill the empty region
 * from the edges; any empty cell left unvisited is enclosed.
 * @returns Array<{row,col}>
 */
export function enclosedEmpty(filled, size = SIZE) {
  const set = toSet(filled);
  const seen = new Set();
  const stack = [];
  const push = (r, c) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    const k = key(r, c);
    if (set.has(k) || seen.has(k)) return;
    seen.add(k); stack.push([r, c]);
  };
  for (let i = 0; i < size; i++) { push(0, i); push(size - 1, i); push(i, 0); push(i, size - 1); }
  while (stack.length) { const [r, c] = stack.pop(); push(r + 1, c); push(r - 1, c); push(r, c + 1); push(r, c - 1); }
  const out = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    if (!set.has(key(r, c)) && !seen.has(key(r, c))) out.push({ row: r, col: c });
  return out;
}
