// rules.js — placement legality + word gathering.
// Given a board and this turn's placements, works out every word formed,
// which cells are newly placed (so premiums apply), and whether the move is legal.
// See PRD §07.

import { SIZE, inBounds, isEmpty, CENTER } from './board.js';
import { letterOf } from './tiles.js';

const key = (r, c) => `${r},${c}`;

/** Lookup that overlays this turn's placements on the board. */
function makeLookup(board, placements) {
  const map = new Map();
  for (const p of placements) map.set(key(p.row, p.col), p.tile);
  return (r, c) => {
    if (!inBounds(r, c)) return null;
    return map.get(key(r, c)) || board[r][c].tile;
  };
}

/**
 * Analyze a move geometrically (no lexicon check).
 * @returns {{ok:boolean, error?:string, words?:Array, orientation?:string}}
 * Each word = { text, cells:[{row,col,tile,isNew,premium}] }
 */
export function analyze(board, placements) {
  if (!placements || placements.length === 0) return { ok: false, error: 'No tiles placed.' };

  const seen = new Set();
  for (const p of placements) {
    if (!inBounds(p.row, p.col)) return { ok: false, error: 'Tile off the board.' };
    if (board[p.row][p.col].tile) return { ok: false, error: 'Cell already occupied.' };
    const k = key(p.row, p.col);
    if (seen.has(k)) return { ok: false, error: 'Two tiles on the same cell.' };
    seen.add(k);
    const L = letterOf(p.tile);
    if (!/^[A-Z]$/.test(L)) return { ok: false, error: 'Blank must be assigned a letter.' };
  }

  const rows = new Set(placements.map((p) => p.row));
  const cols = new Set(placements.map((p) => p.col));
  const at = makeLookup(board, placements);
  const isNew = new Set(placements.map((p) => key(p.row, p.col)));

  // orientation
  let horiz;
  if (placements.length === 1) {
    const { row, col } = placements[0];
    const hasH = at(row, col - 1) || at(row, col + 1);
    horiz = !!hasH; // prefer horizontal if it has a horizontal neighbor
  } else if (rows.size === 1) {
    horiz = true;
  } else if (cols.size === 1) {
    horiz = false;
  } else {
    return { ok: false, error: 'Tiles must be in a single row or column.' };
  }

  // contiguity along the main axis (no gaps between placed tiles)
  if (placements.length > 1) {
    if (horiz) {
      const row = placements[0].row;
      const cs = placements.map((p) => p.col);
      for (let c = Math.min(...cs); c <= Math.max(...cs); c++)
        if (!at(row, c)) return { ok: false, error: 'Gap in your word.' };
    } else {
      const col = placements[0].col;
      const rs = placements.map((p) => p.row);
      for (let r = Math.min(...rs); r <= Math.max(...rs); r++)
        if (!at(r, col)) return { ok: false, error: 'Gap in your word.' };
    }
  }

  // gather a word by walking out from (r,c) along dr,dc
  const wordAlong = (r0, c0, dr, dc) => {
    // back up to the start
    let r = r0, c = c0;
    while (at(r - dr, c - dc)) { r -= dr; c -= dc; }
    const cells = [];
    while (at(r, c)) {
      const tile = at(r, c);
      cells.push({ row: r, col: c, tile, isNew: isNew.has(key(r, c)), premium: board[r][c].premium });
      r += dr; c += dc;
    }
    return cells;
  };
  const toWord = (cells) => ({ text: cells.map((x) => letterOf(x.tile)).join(''), cells });

  const words = [];
  // main word
  const anchor = placements[0];
  const main = horiz ? wordAlong(anchor.row, anchor.col, 0, 1) : wordAlong(anchor.row, anchor.col, 1, 0);
  if (main.length >= 2) words.push(toWord(main));
  // cross words (perpendicular through each new tile)
  for (const p of placements) {
    const cross = horiz ? wordAlong(p.row, p.col, 1, 0) : wordAlong(p.row, p.col, 0, 1);
    if (cross.length >= 2) words.push(toWord(cross));
  }

  if (words.length === 0) return { ok: false, error: 'A move must form a word.' };

  return { ok: true, words, orientation: horiz ? 'H' : 'V' };
}

/** True if any new placement orthogonally touches a pre-existing board tile. */
function connectsToBoard(board, placements) {
  for (const p of placements) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = p.row + dr, c = p.col + dc;
      if (inBounds(r, c) && board[r][c].tile) return true;
    }
  }
  return false;
}

/**
 * Full legality incl. first-move-on-center, connectivity, and lexicon check.
 * @param lexicon object with isWord(str):boolean
 */
export function validate(board, placements, lexicon) {
  const a = analyze(board, placements);
  if (!a.ok) return a;

  if (isEmpty(board)) {
    const coversCenter = placements.some((p) => p.row === CENTER.row && p.col === CENTER.col);
    if (!coversCenter) return { ok: false, error: 'First word must cross the center star.' };
  } else if (!connectsToBoard(board, placements)) {
    return { ok: false, error: 'Word must connect to tiles already on the board.' };
  }

  if (lexicon) {
    const bad = a.words.map((w) => w.text).filter((t) => !lexicon.isWord(t));
    if (bad.length) return { ok: false, error: `Not a word: ${bad.join(', ')}`, invalidWords: bad, words: a.words };
  }
  return a;
}
