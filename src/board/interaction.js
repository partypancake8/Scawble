// interaction.js — pure board interaction math: screen→cell hit-testing that
// accounts for pinch-zoom + pan, and the drop-decision rules for dragging a
// tile from the rack or from the board. Zero dependencies, exhaustively unit
// tested (tests/board.test.js). The Skia/RN view is a thin shell over this.
//
// ─── The transform model ────────────────────────────────────────────────────
// The board content (side = boardWidth(cell)) is rendered inside a fixed square
// "box" of the same side, then transformed for pinch-zoom/pan as:
//
//     translate(tx, ty) ∘ scale(scale)   about the box CENTRE
//
// (React Native applies the transform about the view's centre by default, and
// ZoomableBoard lists [translateX, translateY, scale] which composes to the
// same thing.) So a content point maps to a box-local screen point via:
//
//     screenLocal = center + t + scale * (content - center)
//
// and the inverse — which is what hit-testing needs — is:
//
//     content = center + (screenLocal - center - t) / scale
//
// where center = boardWidth(cell) / 2 and t = (tx, ty).

import { SIZE, PAD, pitch, cellCenter, inBounds, boardWidth } from './geometry.js';

const IDENTITY = { scale: 1, tx: 0, ty: 0 };

// Invert the zoom/pan transform: a point in the board box's local space
// (screen coords minus the box's top-left origin) → content-space point.
//
// `layout` (optional) supports a CANVAS larger than the board — so the board can
// be centred in a taller viewport and grow into it on zoom. It carries the canvas
// centre the transform pivots about ({cx,cy}) and the board's top-left offset
// within the canvas ({ox,oy}). Omit it and the board fills the canvas exactly
// (centre = boardWidth/2, no offset) — the original behaviour.
export function screenToContent(lx, ly, cell, transform = IDENTITY, layout) {
  const { scale, tx, ty } = transform;
  const bw = boardWidth(cell);
  const cx = layout?.cx ?? bw / 2;
  const cy = layout?.cy ?? bw / 2;
  const ox = layout?.ox ?? 0;
  const oy = layout?.oy ?? 0;
  return {
    x: cx + (lx - cx - tx) / scale - ox,
    y: cy + (ly - cy - ty) / scale - oy,
  };
}

// Which cell contains a content-space point? Floor-quantise to the grid.
// Returns { row, col } or null if the point is outside the 15x15 grid (e.g. in
// the outer padding or past the last cell).
export function cellAtContent(contentX, contentY, cell) {
  const col = Math.floor((contentX - PAD) / pitch(cell));
  const row = Math.floor((contentY - PAD) / pitch(cell));
  if (!inBounds(row, col)) return null;
  return { row, col };
}

// Full pipeline: an absolute screen point + the measured board box rect
// { x, y, w, h } + the current transform → { row, col } or null. Returns null
// when the point falls outside the box entirely (never touched the board).
export function cellAtScreen(px, py, cell, rect, transform = IDENTITY, layout) {
  if (!rect) return null;
  const lx = px - rect.x;
  const ly = py - rect.y;
  if (lx < 0 || ly < 0 || lx > rect.w || ly > rect.h) return null;
  const { x, y } = screenToContent(lx, ly, cell, transform, layout);
  return cellAtContent(x, y, cell);
}

// Find the empty cell whose centre is nearest a content-space point, searching
// the 3x3 neighbourhood around the point's rounded cell. Used to forgivingly
// "snap" a drop that lands on an occupied cell toward an adjacent empty slot —
// but only when the point is genuinely close (within `reach` of a pitch) so a
// drop dead-centre on a tile surrounded by tiles still fails.
//
// `isOccupied(row, col)` must report whether a cell is blocked (a committed
// tile, or another draft tile — excluding the tile being dragged).
export function nearestEmptyCell(contentX, contentY, cell, isOccupied, reach = 0.6) {
  const p = pitch(cell);
  const c0 = Math.round((contentX - PAD - cell / 2) / p);
  const r0 = Math.round((contentY - PAD - cell / 2) / p);
  let best = null;
  let bestDist = Infinity;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = r0 + dr;
      const col = c0 + dc;
      if (!inBounds(row, col)) continue;
      if (isOccupied(row, col)) continue;
      const dx = contentX - cellCenter(col, cell);
      const dy = contentY - cellCenter(row, cell);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) { bestDist = dist; best = { row, col }; }
    }
  }
  if (best && bestDist <= reach * p) return best;
  return null;
}

// ─── The drop decision ──────────────────────────────────────────────────────
// Decide what happens when a dragged tile is released. Pure: the caller supplies
// where the release landed (screen point + measured box rect + transform) and an
// `isOccupied` predicate that already excludes the dragged tile's own cell.
//
// `from` is 'rack' (a fresh tile) or 'board' (an already-placed draft tile).
// Returns exactly one of:
//   { action: 'place', row, col } — put a rack tile onto the board
//   { action: 'move',  row, col } — relocate a board tile to a new cell
//   { action: 'recall' }          — send a board tile back to the rack
//   { action: 'none' }            — no change (rack tile bounces back to rack;
//                                     board tile stays where it was)
export function decideDrop({ from, point, cell, rect, transform = IDENTITY, isOccupied, layout }) {
  const put = (row, col) => ({ action: from === 'board' ? 'move' : 'place', row, col });

  const target = cellAtScreen(point.x, point.y, cell, rect, transform, layout);

  // Off the board entirely: a board tile goes home to the rack; a rack tile
  // simply stays in the rack (no draft change).
  if (!target) return from === 'board' ? { action: 'recall' } : { action: 'none' };

  // Landed on a free cell: place/move straight there.
  if (!isOccupied(target.row, target.col)) return put(target.row, target.col);

  // Landed on an occupied cell: forgivingly snap toward a nearby empty slot.
  const lx = point.x - rect.x;
  const ly = point.y - rect.y;
  const { x, y } = screenToContent(lx, ly, cell, transform, layout);
  const near = nearestEmptyCell(x, y, cell, isOccupied);
  if (near) return put(near.row, near.col);

  // Truly on top of a tile with no room: rack tile returns to rack, board tile
  // stays put — either way, no change.
  return { action: 'none' };
}

// ─── Pan / zoom transform math ───────────────────────────────────────────────
// The board's zoom/pan state is { scale, tx, ty }. These pure helpers (ported
// from the proven PanResponder gesture in ZoomableBoard) produce the next state
// from a gesture, clamped so the board can never be panned off its own frame.
// `size` is boardWidth(cell). The Skia view feeds the SAME { scale, tx, ty } into
// its Group transform (about the board centre) that hit-testing inverts, so what
// you see and what you touch can never drift apart.

export function clampScale(scale, min = 1, max = 3) {
  return Math.min(max, Math.max(min, scale));
}

// Clamp one translate axis so the scaled board's edge can't pass its frame edge.
export function clampPanAxis(v, scale, size) {
  const limit = (size * (scale - 1)) / 2;
  return Math.min(limit, Math.max(-limit, v));
}

export function clampView(view, size, minScale = 1, maxScale = 3) {
  const scale = clampScale(view.scale, minScale, maxScale);
  return { scale, tx: clampPanAxis(view.tx, scale, size), ty: clampPanAxis(view.ty, scale, size) };
}

// Two-finger pinch: scale by the finger-spread ratio and pan by how the two-
// finger midpoint moved. `start` is { scale, tx, ty, dist, mid:{x,y} } captured
// when the second finger landed; `cur` is { dist, mid:{x,y} } now.
export function pinchView(start, cur, size, maxScale = 3) {
  const scale = clampScale((start.scale * cur.dist) / start.dist, 1, maxScale);
  return {
    scale,
    tx: clampPanAxis(start.tx + (cur.mid.x - start.mid.x), scale, size),
    ty: clampPanAxis(start.ty + (cur.mid.y - start.mid.y), scale, size),
  };
}

// One-finger pan (only meaningful when zoomed in). `start` is { scale, tx, ty }.
export function panView(start, dx, dy, size) {
  return {
    scale: start.scale,
    tx: clampPanAxis(start.tx + dx, start.scale, size),
    ty: clampPanAxis(start.ty + dy, start.scale, size),
  };
}
