// board.js — the 15x15 grid and premium-square layout.
// Positions follow the canonical symmetric layout; colors/branding live in the
// UI layer (PRD §03), not here. Center (7,7) is a double-word star.

export const SIZE = 15;
export const CENTER = { row: 7, col: 7 };

// Premium map, one char per cell:
//   3 = triple word, 2 = double word, t = triple letter, d = double letter,
//   * = center (double word), . = normal
const LAYOUT = [
  '3..d...3...d..3',
  '.2...t...t...2.',
  '..2...d.d...2..',
  'd..2...d...2..d',
  '....2.....2....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  '3..d...*...d..3',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....2.....2....',
  'd..2...d...2..d',
  '..2...d.d...2..',
  '.2...t...t...2.',
  '3..d...3...d..3',
];

const PREMIUM_CHAR = { '3': 'TW', '2': 'DW', 't': 'TL', 'd': 'DL', '*': 'DW', '.': null };

/** premium type for a cell, or null. Center reads as 'DW'. */
export function premiumAt(row, col) {
  return PREMIUM_CHAR[LAYOUT[row][col]];
}

/** @typedef {{premium: (string|null), tile: (object|null)}} Cell */

/** Create an empty board: 15x15 of { premium, tile:null }. */
export function makeBoard() {
  const b = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push({ premium: premiumAt(r, c), tile: null });
    b.push(row);
  }
  return b;
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

/** Tile at a cell (or null / out of bounds). */
export function tileAt(board, row, col) {
  return inBounds(row, col) ? board[row][col].tile : null;
}

/** True if the board has no tiles placed yet. */
export function isEmpty(board) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c].tile) return false;
  return true;
}

/** Deep-ish clone of a board (cells copied, tiles shared by reference). */
export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ premium: cell.premium, tile: cell.tile })));
}
