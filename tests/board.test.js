// board.test.js — pure board interaction math: geometry, zoom/pan-aware
// screen→cell hit-testing, and the drag drop-decision rules. This is the
// foundation the Skia board is built on, so it is tested exhaustively here in
// Node (no DOM/RN) before any view code touches it.
// Run: `node tests/board.test.js`

import { SIZE, GAP, PAD, boardWidth, pitch, cellOrigin, cellCenter, inBounds } from '../src/board/geometry.js';
import { screenToContent, cellAtContent, cellAtScreen, nearestEmptyCell, decideDrop,
  clampScale, clampPanAxis, clampView, pinchView, panView } from '../src/board/interaction.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const eq = (a, b, m) => (JSON.stringify(a) === JSON.stringify(b) ? passed++ : (failed++, fails.push(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)));

// A concrete, easy-to-reason-about geometry used throughout:
//   cell = 20 → pitch 22, boardWidth 336, center 168, cellCenter(i) = 14 + 22*i
const CELL = 20;
const BOX = { x: 0, y: 0, w: boardWidth(CELL), h: boardWidth(CELL) }; // box at screen origin
const ID = { scale: 1, tx: 0, ty: 0 };

// ─── 1. geometry constants + derived math ───────────────────────────────────
eq(SIZE, 15, 'SIZE is 15');
eq(GAP, 2, 'GAP is 2');
eq(PAD, 4, 'PAD is 4');
eq(boardWidth(20), 15 * 20 + 14 * 2 + 2 * 4, 'boardWidth(20) = 336');
eq(boardWidth(20), 336, 'boardWidth(20) numeric');
eq(pitch(20), 22, 'pitch = cell + GAP');
eq(cellOrigin(0, 20), 4, 'cellOrigin(0) = PAD');
eq(cellOrigin(7, 20), 4 + 22 * 7, 'cellOrigin(7)');
eq(cellCenter(0, 20), 14, 'cellCenter(0) = PAD + cell/2');
eq(cellCenter(7, 20), 168, 'cellCenter(7) = board center');
eq(cellCenter(14, 20), 322, 'cellCenter(14)');
ok(inBounds(0, 0) && inBounds(14, 14) && inBounds(7, 7), 'inBounds accepts corners + center');
ok(!inBounds(-1, 0) && !inBounds(0, 15) && !inBounds(15, 15), 'inBounds rejects off-grid');

// ─── 2. screenToContent inverts the transform ───────────────────────────────
// identity: content == local
eq(screenToContent(168, 168, CELL, ID), { x: 168, y: 168 }, 'identity: content == local');
eq(screenToContent(14, 14, CELL, ID), { x: 14, y: 14 }, 'identity corner');
// scale-2 about center: the center is a fixed point, edges move outward
eq(screenToContent(168, 168, CELL, { scale: 2, tx: 0, ty: 0 }), { x: 168, y: 168 }, 'scale about center: center fixed');
// a point 100px right of center in screen space maps to 50px right in content
eq(screenToContent(268, 168, CELL, { scale: 2, tx: 0, ty: 0 }), { x: 218, y: 168 }, 'scale-2 halves screen offset');
// pan shifts the mapping by tx/ty (divided by scale)
eq(screenToContent(268, 168, CELL, { scale: 2, tx: 100, ty: 0 }), { x: 168, y: 168 }, 'pan compensates: back to center');
// round-trip: content → screenLocal → content
{
  const scale = 1.7, tx = 33, ty = -12, center = boardWidth(CELL) / 2;
  const cx = 205, cy = 90;
  const sx = center + tx + scale * (cx - center);
  const sy = center + ty + scale * (cy - center);
  const back = screenToContent(sx, sy, CELL, { scale, tx, ty });
  ok(Math.abs(back.x - cx) < 1e-9 && Math.abs(back.y - cy) < 1e-9, 'screenToContent round-trips content');
}

// ─── 3. cellAtContent quantises content → cell ──────────────────────────────
eq(cellAtContent(14, 14, CELL), { row: 0, col: 0 }, 'center of (0,0)');
eq(cellAtContent(168, 168, CELL), { row: 7, col: 7 }, 'center of (7,7)');
eq(cellAtContent(322, 322, CELL), { row: 14, col: 14 }, 'center of (14,14)');
eq(cellAtContent(cellOrigin(3, CELL), cellOrigin(5, CELL), CELL), { row: 5, col: 3 }, 'top-left corner belongs to its cell');
// the inter-cell gap snaps to the preceding cell (forgiving hit-test)
eq(cellAtContent(179, 168, CELL), { row: 7, col: 7 }, 'point in the trailing gap snaps to preceding cell');
// outside the grid → null
ok(cellAtContent(2, 168, CELL) === null, 'left padding → null');
ok(cellAtContent(168, 2, CELL) === null, 'top padding → null');
ok(cellAtContent(335, 168, CELL) === null, 'past last cell → null');
ok(cellAtContent(-5, -5, CELL) === null, 'negative → null');

// ─── 4. cellAtScreen: box offset + bounds + transform end-to-end ─────────────
eq(cellAtScreen(168, 168, CELL, BOX, ID), { row: 7, col: 7 }, 'center of board → (7,7)');
eq(cellAtScreen(14, 14, CELL, BOX, ID), { row: 0, col: 0 }, 'top-left → (0,0)');
// a shifted box: absolute screen coords are offset by the box origin
{
  const box = { x: 50, y: 30, w: boardWidth(CELL), h: boardWidth(CELL) };
  eq(cellAtScreen(50 + 168, 30 + 168, CELL, box, ID), { row: 7, col: 7 }, 'shifted box: center still (7,7)');
  ok(cellAtScreen(10, 10, CELL, box, ID) === null, 'point left/above the shifted box → null');
}
// outside the box entirely → null (never touched the board)
ok(cellAtScreen(-1, 168, CELL, BOX, ID) === null, 'left of box → null');
ok(cellAtScreen(168, BOX.h + 1, CELL, BOX, ID) === null, 'below box → null');
ok(cellAtScreen(168, 168, CELL, null, ID) === null, 'no rect → null');
// under zoom: center cell reachable at screen-center; a corner is off-box
eq(cellAtScreen(168, 168, CELL, BOX, { scale: 2, tx: 0, ty: 0 }), { row: 7, col: 7 }, 'zoomed: center still hits (7,7)');
// zoomed 2x, screen (5,5) → content 86.5 → cell (3,3)
eq(cellAtScreen(5, 5, CELL, BOX, { scale: 2, tx: 0, ty: 0 }), { row: 3, col: 3 }, 'zoomed near-corner resolves to (3,3)');
// with pan we can bring an edge cell under the finger
{
  // pan content so cell (0,0) center lands at screen (168,168):
  // screenLocal = center + t + scale*(content-center); solve t for content=(14,14)
  const scale = 2, center = 168;
  const t = 168 - center - scale * (14 - center); // = -scale*(14-168) = 308
  eq(cellAtScreen(168, 168, CELL, BOX, { scale, tx: t, ty: t }), { row: 0, col: 0 }, 'pan brings (0,0) under center');
}

// ─── 5. nearestEmptyCell: forgiving snap to an adjacent empty slot ───────────
{
  const occ = (r, c) => r === 7 && c === 7; // only (7,7) filled
  // a point inside (7,7) but hard against its right edge → snap to (7,8)
  eq(nearestEmptyCell(178, 168, CELL, occ), { row: 7, col: 8 }, 'snap right to empty (7,8)');
  // hard against the left edge of (7,7) → snap to (7,6)
  eq(nearestEmptyCell(cellOrigin(7, CELL) + 1, 168, CELL, occ), { row: 7, col: 6 }, 'snap left to empty (7,6)');
  // dead-centre on (7,7): nearest empty neighbours are a full pitch away (> reach) → no snap
  ok(nearestEmptyCell(168, 168, CELL, occ) === null, 'dead-centre on a tile does not snap');
}
{
  // fully surrounded: every candidate occupied → null
  const occAll = () => true;
  ok(nearestEmptyCell(168, 168, CELL, occAll) === null, 'no empty cell anywhere → null');
}
{
  // empty board: the containing cell itself is empty and nearest → returns it
  const none = () => false;
  eq(nearestEmptyCell(168, 168, CELL, none), { row: 7, col: 7 }, 'empty board returns the containing cell');
}

// ─── 6. decideDrop: the full drop rulebook ──────────────────────────────────
const pt = (x, y) => ({ x, y });
const free = () => false;   // nothing occupied
const filled = () => true;  // everything occupied
const only77 = (r, c) => r === 7 && c === 7;

// rack → empty cell = place
eq(decideDrop({ from: 'rack', point: pt(168, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'place', row: 7, col: 7 }, 'rack onto empty → place');
eq(decideDrop({ from: 'rack', point: pt(102, 80), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'place', row: 3, col: 4 }, 'rack onto empty (3,4) → place');

// board → empty cell = move
eq(decideDrop({ from: 'board', point: pt(102, 80), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'move', row: 3, col: 4 }, 'board tile onto empty → move');

// board → off the board = recall to rack
eq(decideDrop({ from: 'board', point: pt(1000, 1000), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'recall' }, 'board tile off-board → recall');
// rack → off the board = nothing (stays in rack)
eq(decideDrop({ from: 'rack', point: pt(1000, 1000), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'none' }, 'rack tile off-board → none');

// rack → occupied cell, no room = none (bounces back to rack)
eq(decideDrop({ from: 'rack', point: pt(168, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: filled }),
  { action: 'none' }, 'rack onto a tile (no room) → none');
// board → occupied cell, no room = none (stays put)
eq(decideDrop({ from: 'board', point: pt(168, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: filled }),
  { action: 'none' }, 'board onto a tile (no room) → stays (none)');

// rack → nudged onto occupied (7,7) but close to empty (7,8) = snap-place there
eq(decideDrop({ from: 'rack', point: pt(178, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: only77 }),
  { action: 'place', row: 7, col: 8 }, 'rack near-miss snaps to empty neighbour → place');
// board → same near-miss = snap-move
eq(decideDrop({ from: 'board', point: pt(178, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: only77 }),
  { action: 'move', row: 7, col: 8 }, 'board near-miss snaps to empty neighbour → move');

// dropping a board tile back on its own cell (caller excludes it from isOccupied) = move to same cell (idempotent)
eq(decideDrop({ from: 'board', point: pt(168, 168), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'move', row: 7, col: 7 }, 'board tile onto its own (excluded) cell → move (idempotent)');

// transform-aware drop: zoomed 2x, drop at screen center still resolves to (7,7)
eq(decideDrop({ from: 'rack', point: pt(168, 168), cell: CELL, rect: BOX, transform: { scale: 2, tx: 0, ty: 0 }, isOccupied: free }),
  { action: 'place', row: 7, col: 7 }, 'zoomed drop at center → place (7,7)');

// dropping in the outer padding (inside box, outside grid): board→recall, rack→none
eq(decideDrop({ from: 'board', point: pt(2, 2), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'recall' }, 'board tile into padding → recall');
eq(decideDrop({ from: 'rack', point: pt(2, 2), cell: CELL, rect: BOX, transform: ID, isOccupied: free }),
  { action: 'none' }, 'rack tile into padding → none');

// ─── 7. pan / zoom transform math ───────────────────────────────────────────
const SIZE_PX = boardWidth(CELL); // 336
eq(clampScale(0.5), 1, 'scale floored at 1');
eq(clampScale(9), 3, 'scale capped at maxScale 3');
eq(clampScale(1.8), 1.8, 'scale in range passes through');
eq(clampScale(5, 1, 4), 4, 'custom max respected');
// pan limit: at scale 1 there is no room to pan → clamps to 0
eq(clampPanAxis(50, 1, SIZE_PX), 0, 'no pan room at scale 1');
// at scale 2 the limit is size*(2-1)/2 = 168
eq(clampPanAxis(500, 2, SIZE_PX), 168, 'pan clamps to +limit at scale 2');
eq(clampPanAxis(-500, 2, SIZE_PX), -168, 'pan clamps to -limit at scale 2');
eq(clampPanAxis(80, 2, SIZE_PX), 80, 'pan within limit passes through');
eq(clampView({ scale: 9, tx: 999, ty: -999 }, SIZE_PX), { scale: 3, tx: 336, ty: -336 }, 'clampView clamps scale then pan');
// pinch: doubling the finger spread doubles the scale (from a rest start)
{
  const start = { scale: 1, tx: 0, ty: 0, dist: 100, mid: { x: 168, y: 168 } };
  eq(pinchView(start, { dist: 200, mid: { x: 168, y: 168 } }, SIZE_PX), { scale: 2, tx: 0, ty: 0 }, 'pinch 2x spread → scale 2, no pan');
  // moving the midpoint pans by the delta (clamped)
  eq(pinchView(start, { dist: 200, mid: { x: 188, y: 158 } }, SIZE_PX), { scale: 2, tx: 20, ty: -10 }, 'pinch midpoint move pans');
  // pinch never zooms below 1 or above max
  eq(pinchView(start, { dist: 50, mid: { x: 168, y: 168 } }, SIZE_PX).scale, 1, 'pinch below 1 clamps to 1');
  eq(pinchView(start, { dist: 1000, mid: { x: 168, y: 168 } }, SIZE_PX).scale, 3, 'pinch beyond max clamps to 3');
}
// pan: translate follows the drag delta, scale unchanged, clamped
eq(panView({ scale: 2, tx: 0, ty: 0 }, 30, -40, SIZE_PX), { scale: 2, tx: 30, ty: -40 }, 'pan follows drag');
eq(panView({ scale: 2, tx: 160, ty: 0 }, 100, 0, SIZE_PX), { scale: 2, tx: 168, ty: 0 }, 'pan clamps at the frame edge');

// hit-test consistency: a point round-trips through the SAME transform pinch produced
{
  const start = { scale: 1, tx: 0, ty: 0, dist: 100, mid: { x: 168, y: 168 } };
  const v = pinchView(start, { dist: 200, mid: { x: 168, y: 168 } }, SIZE_PX); // scale 2 about center
  // board center stays under the screen center after a centered zoom
  eq(cellAtScreen(168, 168, CELL, BOX, v), { row: 7, col: 7 }, 'centered pinch keeps center cell under center');
}

// NOTE: the tile "melt" is now rendered by unioning uniform cell squares and
// rounding EVERY corner (convex + concave) with Skia's CornerPathEffect in
// SkiaBoard.js — no per-corner geometry to unit-test here anymore.

// ─── 8. tall-canvas layout (board centred in a viewport bigger than itself) ──
// canvas 336 wide × 500 tall; board (336²) centred → vertical offset oy = 82.
{
  const CANVAS = { x: 0, y: 0, w: SIZE_PX, h: 500 };
  const TALL = { cx: SIZE_PX / 2, cy: 250, ox: 0, oy: (500 - SIZE_PX) / 2 }; // oy = 82
  // at rest the board centre sits at the CANVAS centre
  eq(cellAtScreen(168, 250, CELL, CANVAS, ID, TALL), { row: 7, col: 7 }, 'tall canvas: board center at canvas center');
  // a point offset by oy hits the top-left cell
  eq(cellAtScreen(14, 14 + 82, CELL, CANVAS, ID, TALL), { row: 0, col: 0 }, 'tall canvas: (0,0) offset by oy');
  // dropping in the empty margin ABOVE the board → off the grid
  ok(cellAtScreen(168, 50, CELL, CANVAS, ID, TALL) === null, 'tall canvas: top margin is off-board');
  // zoom is about the canvas centre — the centre cell stays put
  eq(cellAtScreen(168, 250, CELL, CANVAS, { scale: 2, tx: 0, ty: 0 }, TALL), { row: 7, col: 7 }, 'tall canvas zoomed: center holds');
  // decideDrop threads the layout through
  eq(decideDrop({ from: 'rack', point: pt(168, 250), cell: CELL, rect: CANVAS, transform: ID, isOccupied: free, layout: TALL }),
    { action: 'place', row: 7, col: 7 }, 'tall canvas: rack drop at center → place (7,7)');
  // omitting layout is unchanged (board fills a square canvas)
  eq(cellAtScreen(168, 168, CELL, BOX, ID), { row: 7, col: 7 }, 'no layout → original square behaviour intact');
}

// ─── report ─────────────────────────────────────────────────────────────────
if (failed) {
  console.error(`\n✗ board: ${failed} failed, ${passed} passed`);
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
} else {
  console.log(`✓ board: ${passed} assertions passed`);
}
