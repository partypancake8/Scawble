// generate.js — legal move generation.
// Trie-guided anchored search (Appel–Jacobson style), then every candidate is
// filtered through the tested engine `validate` + scored with `scoreMove`, so
// the bot can never produce an illegal move. A trie is the un-optimized DAWG;
// swap for a packed GADDAG later for speed (PRD §08).

import { SIZE, inBounds, isEmpty, CENTER } from '../engine/board.js';
import { letterOf } from '../engine/tiles.js';
import { validate } from '../engine/rules.js';
import { scoreMove } from '../engine/score.js';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const END = '$';

/** Build a trie from an iterable of words. Node = plain object, '$' marks end. */
export function buildTrie(words) {
  const root = {};
  for (const w of words) {
    const u = String(w).trim().toUpperCase();
    if (!u) continue;
    let node = root;
    for (const ch of u) node = node[ch] || (node[ch] = {});
    node[END] = true;
  }
  return root;
}

// board access mapped to an orientation: horiz => (line=row, i=col)
function mapper(horiz) {
  return horiz ? (line, i) => [line, i] : (line, i) => [i, line];
}

/** cross-check: letters that make a valid perpendicular word at (r,c). null = any. */
function crossSet(board, r, c, horiz, lexicon) {
  // perpendicular direction
  const [dr, dc] = horiz ? [1, 0] : [0, 1];
  let before = '', after = '';
  let rr = r - dr, cc = c - dc;
  while (inBounds(rr, cc) && board[rr][cc].tile) { before = letterOf(board[rr][cc].tile) + before; rr -= dr; cc -= dc; }
  rr = r + dr; cc = c + dc;
  while (inBounds(rr, cc) && board[rr][cc].tile) { after += letterOf(board[rr][cc].tile); rr += dr; cc += dc; }
  if (!before && !after) return null; // no constraint
  const okSet = new Set();
  for (const L of A) if (lexicon.isWord(before + L + after)) okSet.add(L);
  return okSet;
}

function isAnchor(board, r, c, empty) {
  if (board[r][c].tile) return false;
  if (empty) return r === CENTER.row && c === CENTER.col; // caller passes isEmpty(board) once
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
    if (inBounds(r + dr, c + dc) && board[r + dr][c + dc].tile) return true;
  return false;
}

/**
 * Generate all legal moves for a rack. Returns array of
 * { placements:[{tile,row,col}], score, words, isBingo }.
 */
export function generateMoves(board, rack, trie, lexicon, opts = {}) {
  const limit = opts.limit || Infinity;
  const found = new Map(); // signature -> move
  const empty = isEmpty(board);

  const record = (placed) => {
    if (placed.length === 0) return;
    // build placement objects (clone blanks with an assigned letter, keep id)
    const placements = placed.map((p) => ({
      tile: p.tile.letter === '_' ? { ...p.tile, assigned: p.letter } : p.tile,
      row: p.row, col: p.col,
    }));
    const sig = placements.map((p) => `${p.row},${p.col},${letterOf(p.tile)}`).sort().join('|');
    if (found.has(sig)) return;
    const v = validate(board, placements, lexicon);
    if (!v.ok) return;
    const s = scoreMove(board, placements);
    if (!s.ok) return;
    found.set(sig, { placements, score: s.score, words: s.words, isBingo: s.isBingo });
  };

  for (const horiz of [true, false]) {
    const toRC = mapper(horiz);
    for (let line = 0; line < SIZE; line++) {
      // precompute cross-sets for this line
      const cross = [];
      for (let i = 0; i < SIZE; i++) { const [r, c] = toRC(line, i); cross[i] = board[r][c].tile ? null : crossSet(board, r, c, horiz, lexicon); }

      for (let i = 0; i < SIZE; i++) {
        const [ar, ac] = toRC(line, i);
        if (!isAnchor(board, ar, ac, empty)) continue;

        // How many empty squares are available to the left before a tile/edge.
        let leftRoom = 0;
        for (let k = i - 1; k >= 0; k--) { const [r, c] = toRC(line, k); if (board[r][c].tile) break; if (isAnchor(board, r, c, empty)) break; leftRoom++; }

        // extendRight from square j with current trie node; `placed` are new tiles
        const extendRight = (j, node, placed, rackLeft) => {
          if (found.size >= limit) return;
          if (j >= SIZE) { if (node[END]) record(placed); return; }
          const [r, c] = toRC(line, j);
          const existing = board[r][c].tile;
          if (existing) {
            const L = letterOf(existing);
            if (node[L]) extendRight(j + 1, node[L], placed, rackLeft);
            return;
          }
          // square empty: we may end a word here
          if (node[END] && placed.length) record(placed);
          const cs = cross[j];
          for (let t = 0; t < rackLeft.length; t++) {
            const tile = rackLeft[t];
            const letters = tile.letter === '_' ? A : [tile.letter];
            for (const L of letters) {
              if (cs && !cs.has(L)) continue;
              if (!node[L]) continue;
              const rest = rackLeft.slice(0, t).concat(rackLeft.slice(t + 1));
              extendRight(j + 1, node[L], placed.concat([{ tile, letter: L, row: r, col: c }]), rest);
            }
          }
        };

        // Build the left part. If the square left of the anchor is a tile, the
        // left part is forced by existing tiles; otherwise try building it.
        const [lr, lc] = toRC(line, i - 1);
        if (i > 0 && board[lr][lc].tile) {
          // walk left to the start of the existing run
          let start = i - 1;
          while (start - 1 >= 0) { const [r, c] = toRC(line, start - 1); if (!board[r][c].tile) break; start--; }
          let node = trie; let good = true;
          for (let k = start; k < i; k++) { const [r, c] = toRC(line, k); const L = letterOf(board[r][c].tile); if (!node[L]) { good = false; break; } node = node[L]; }
          if (good) extendRight(i, node, [], rack.slice());
        } else {
          // leftPart recursion: place 0..leftRoom new tiles to the left, then extendRight from anchor
          const leftPart = (node, count, startCol, rackLeft) => {
            extendRight(i, node, buildLeftPlaced(), rackLeft);
            if (count === 0) return;
            for (let t = 0; t < rackLeft.length; t++) {
              const tile = rackLeft[t];
              const letters = tile.letter === '_' ? A : [tile.letter];
              for (const L of letters) {
                if (!node[L]) continue;
                const col = startCol; const [r, c] = toRC(line, col);
                const cs = cross[col];
                if (cs && !cs.has(L)) continue;
                leftPlaced.push({ tile, letter: L, row: r, col: c });
                const rest = rackLeft.slice(0, t).concat(rackLeft.slice(t + 1));
                leftPart(node[L], count - 1, startCol - 1, rest);
                leftPlaced.pop();
              }
            }
          };
          // leftPlaced is shared mutable stack for the current left build
          const leftPlaced = [];
          const buildLeftPlaced = () => leftPlaced.slice();
          leftPart(trie, leftRoom, i - 1, rack.slice());
        }
      }
    }
  }

  return [...found.values()];
}
