// geometry.js — pure board geometry. The single source of truth for the 15x15
// layout math shared by the renderer (Board.js) and the hit-tester. Zero deps;
// runs identically in Node (tests), web, and React Native.
//
// A board is drawn as a padded grid of square cells: `PAD` px of padding around
// the outside, `GAP` px between neighbouring cells. Every downstream coordinate
// calculation derives from these three constants and the current `cell` size.

export const SIZE = 15; // the board is SIZE x SIZE cells
export const GAP = 2;   // px between adjacent cells
export const PAD = 4;   // px of padding around the whole grid

// Full pixel side-length of the board content for a given cell size.
export function boardWidth(cell) {
  return SIZE * cell + (SIZE - 1) * GAP + 2 * PAD;
}

// Distance from one cell's left edge to the next cell's left edge.
export function pitch(cell) {
  return cell + GAP;
}

// Content-space top-left coordinate (x for a col, y for a row) of a cell's
// drawable square, before any zoom/pan transform.
export function cellOrigin(index, cell) {
  return PAD + index * pitch(cell);
}

// Content-space centre coordinate of a cell along one axis.
export function cellCenter(index, cell) {
  return cellOrigin(index, cell) + cell / 2;
}

// Is (row, col) a real cell on the board?
export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}
