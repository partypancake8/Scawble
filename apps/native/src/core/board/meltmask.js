// meltmask.js — pure packing of the board's filled-cell mask for the SDF melt
// shader. The renderer builds a SIZE x SIZE RGBA image from these bytes and the
// shader samples it (nearest-neighbour) to know which cells are filled, then
// smooth-unions per-cell rounded-box SDFs. Zero-dep so the packing is unit-tested
// in Node; the SDF math itself is validated on device (Skia is RN-only).
import { SIZE } from './geometry.js';

const keyOf = (r, c) => `${r},${c}`;

/**
 * Set of "r,c" keys of every filled cell: committed tiles on the board plus the
 * shown draft tiles (excluding the one currently being dragged).
 */
export function filledKeys(board, draft = [], dragId = null) {
  const set = new Set();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r] && board[r][c] && board[r][c].tile) set.add(keyOf(r, c));
    }
  }
  for (const d of draft) if (d.tile.id !== dragId) set.add(keyOf(d.row, d.col));
  return set;
}

/**
 * Pack a Set/array of "r,c" keys into a SIZE*SIZE*4 RGBA byte array (row-major):
 * filled cells are opaque white, empty cells transparent black. The shader reads
 * the red channel as "is this cell filled?".
 */
export function maskBytes(keys, size = SIZE) {
  const set = keys instanceof Set ? keys : new Set(keys);
  const px = new Uint8Array(size * size * 4);
  for (const k of set) {
    const [r, c] = k.split(',').map(Number);
    if (r < 0 || c < 0 || r >= size || c >= size) continue;
    const i = (r * size + c) * 4;
    px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255;
  }
  return px;
}

/** Stable, order-independent signature for memoizing a mask by its filled set. */
export function maskSignature(keys) {
  const set = keys instanceof Set ? keys : new Set(keys);
  return [...set].sort().join('|');
}
