// tiles.js — tile distribution, values, and a seeded bag.
// Values use the Scawble rebalance (Crossplay-style: common consonants cheap,
// K/V/W/Y expensive). Counts stay at the standard 100-tile frequencies.
// See PRD §03.

/** @typedef {{id:string, letter:string, value:number, assigned?:string}} Tile */

// letter -> point value (blank '_' = 0)
export const VALUE = {
  A:1,E:1,I:1,O:1,U:1,N:1,R:1,S:1,T:1,L:1,
  D:2,G:2,C:2,M:2,
  B:3,P:3,H:3,F:3,
  K:5,V:5,W:5,Y:5,
  J:8,X:8,
  Q:10,Z:10,
  _:0,
};

// letter -> how many are in the bag
export const COUNT = {
  E:12, A:9, I:9, O:8, N:6, R:6, T:6, S:4, L:4, U:4,
  D:4, G:3, C:2, M:2,
  B:2, P:2, H:2, F:2,
  K:1, V:2, W:2, Y:2,
  J:1, X:1, Q:1, Z:1,
  _:2, // blanks
};

export const RACK_SIZE = 7;
export const BINGO_BONUS = 50;

// --- seeded RNG (xmur3 hash -> mulberry32) so the Daily is deterministic ---
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Deterministic RNG in [0,1) from a string seed. */
export function makeRng(seed) {
  const s = xmur3(String(seed));
  return mulberry32(s());
}

/** Build a fresh, seeded, shuffled bag of Tiles. */
export function makeBag(seed = 'default') {
  const bag = [];
  let n = 0;
  for (const letter of Object.keys(COUNT)) {
    for (let i = 0; i < COUNT[letter]; i++) {
      bag.push({ id: `t${n++}`, letter, value: VALUE[letter] });
    }
  }
  // Fisher–Yates with the seeded RNG
  const rng = makeRng(seed);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** Draw up to n tiles off the end of the bag (mutates bag), returns drawn. */
export function draw(bag, n) {
  const out = [];
  for (let i = 0; i < n && bag.length; i++) out.push(bag.pop());
  return out;
}

/** Pull one bag tile matching each requested letter (mutates bag), in order.
 *  `letters` = 'RETINAS' or ['R','E',...]. Reuses real bag tiles, so their
 *  values + unique ids stay correct and the 100-tile invariant holds. Throws if
 *  a letter isn't available. Used ONLY by the opt-in dev/scenario rig, never by
 *  normal deals, so daily reproducibility is untouched. */
export function dealRack(bag, letters) {
  const want = (typeof letters === 'string' ? [...letters] : letters).map((c) => String(c).toUpperCase());
  const out = [];
  for (const L of want) {
    const i = bag.findIndex((t) => t.letter === L);
    if (i === -1) throw new Error(`dealRack: no '${L}' left in the bag`);
    out.push(bag.splice(i, 1)[0]);
  }
  return out;
}

/** Effective letter of a tile (blank uses its assigned letter). */
export function letterOf(tile) {
  return tile.assigned || tile.letter;
}

// sanity: total tiles === 100
export const TOTAL_TILES = Object.values(COUNT).reduce((a, b) => a + b, 0);
