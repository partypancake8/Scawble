// SkiaBoard.js — the 15x15 board rendered with Skia (vector/GPU) so it stays
// crisp at ANY zoom. iOS rasterizes React Native View transforms → blur; Skia
// re-rasterizes the vector scene at the final scale each frame → print-sharp.
//
// This component is PURE render-from-props. Zoom/pan (`view`), gesture handling,
// and drop decisions live in Game.js on top of the tested src/core/board math.
// Committed and draft tiles "melt": all tiles are unioned into one step-free
// polygon whose corners are rounded uniformly by CornerPathEffect, so a word
// reads as one continuous soft pill and junctions (T/plus/L) merge smoothly —
// convex outer corners AND concave inner "armpits" alike, with no seams.
import React, { useMemo } from 'react';
import {
  Canvas, Group, RoundedRect, Path, Text as SkText, Skia, PathOp, DashPathEffect,
  CornerPathEffect, useFont,
} from '@shopify/react-native-skia';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { SIZE, GAP, PAD, boardWidth, cellOrigin } from '../core/board/geometry.js';
import { connectors } from '../core/board/melt.js';
import { letterOf, VALUE } from '../core/engine/tiles.js';
import { PREMIUM_BG, PREMIUM_LABEL } from '../theme';

const keyOf = (r, c) => `${r},${c}`;

// The melt: union each filled cell's SMOOTH rounded square (radius `r`, matching
// the cells exactly) with a FULL-width connector bridging the GAP between every
// orthogonally-adjacent FILLED pair, so a run of tiles fuses into one smooth PILL
// with an unbroken edge (no notches/indents). Enclosed empties are never bridged
// (tested topology), so courtyards still stay open.
function meltUnion(cells, cell, r) {
  const ov = r;               // connector overlap into each tile
  const neck = cell;          // full-width bridge -> one unbroken pill edge
  let u = null;
  const add = (p) => { if (!u) u = p; else u.op(p, PathOp.Union); };
  for (const { row, col } of cells) {
    const x = cellOrigin(col, cell), y = cellOrigin(row, cell);
    const p = Skia.Path.Make();
    p.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, cell, cell), r, r));
    add(p);
  }
  for (const { a, dir } of connectors(cells)) {
    const x = cellOrigin(a.col, cell), y = cellOrigin(a.row, cell);
    const p = Skia.Path.Make();
    if (dir === 'h') p.addRect({ x: x + cell - ov, y: y + (cell - neck) / 2, width: GAP + 2 * ov, height: neck });
    else p.addRect({ x: x + (cell - neck) / 2, y: y + cell - ov, width: neck, height: GAP + 2 * ov });
    add(p);
  }
  return u;
}

// A 4-pointed "sparkle" star centered at (cx, cy). Drawn as a path because the
// ✦ glyph isn't in Fredoka and Skia has no font fallback (it would render tofu).
function fourPointStarPath(cx, cy, outer, inner) {
  const k = inner * 0.7071; // inner points sit on the 45° diagonals
  const p = Skia.Path.Make();
  p.moveTo(cx, cy - outer);
  p.lineTo(cx + k, cy - k);
  p.lineTo(cx + outer, cy);
  p.lineTo(cx + k, cy + k);
  p.lineTo(cx, cy + outer);
  p.lineTo(cx - k, cy + k);
  p.lineTo(cx - outer, cy);
  p.lineTo(cx - k, cy - k);
  p.close();
  return p;
}

export default function SkiaBoard({ board, draft, hint, validSet, cell, theme, view, dragId, rev, canvasHeight, settle, target }) {
  const size = boardWidth(cell);
  // The canvas can be TALLER than the board so zoom has room to grow into the
  // space above/below. The board is centred vertically (offset oy); the zoom
  // pivots about the canvas centre. Game.js hit-tests with the same {cx,cy,oy}.
  const canvasH = canvasHeight && canvasHeight > size ? canvasHeight : size;
  const oy = (canvasH - size) / 2;
  const letterFont = useFont(Fredoka_600SemiBold, cell * 0.6); // bigger tile letters (room for the top-left value)
  const valueFont = useFont(Fredoka_600SemiBold, Math.max(8, cell * 0.26));
  const premFont = useFont(Fredoka_600SemiBold, Math.max(9, cell * 0.44)); // bigger 3L/2W/etc labels
  const fontsReady = letterFont && valueFont && premFont;

  // The whole scene is memoized on its VISUAL inputs — NOT on `view`. During a
  // pinch only `view` changes, so we reuse this element tree and Skia just
  // re-applies the Group transform: crisp zoom without rebuilding the scene.
  const content = useMemo(() => {
    if (!fontsReady) return null;

    // ONE shared corner radius: cells, tiles, and tile borders all use `cellR`, and
    // the board container is `cellR + PAD` (concentric with the corner cells) — so
    // every rounded shape on the board is an exact ratio of the others.
    const cellR = cell * 0.24;
    const armpitR = cell * 0.12; // round the concave neck junctions a touch

    const draftShown = (draft || []).filter((d) => d.tile.id !== dragId);
    const draftMap = new Map(draftShown.map((d) => [keyOf(d.row, d.col), d]));
    const hintMap = new Map((hint ? hint.placements : []).map((p) => [keyOf(p.row, p.col), p]));

    const center = (font, text, cx, cy) => {
      const w = font.getTextWidth(text);
      const m = font.getMetrics();
      return { x: cx - w / 2, y: cy - (m.ascent + m.descent) / 2 };
    };

    const bg = [];       // cell backgrounds (premium colours)
    const marks = [];    // premium labels, star, hint ghosts (only on empty cells)
    const glyphs = [];   // tile letters + values (drawn on top of the melted faces)
    const filled = [];   // { row, col } of every tile — face-unioned into pills

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = cellOrigin(c, cell);
        const y = cellOrigin(r, cell);
        const data = board[r][c];
        const isStar = r === 7 && c === 7;
        const premium = data.premium;

        let cellBg = theme.cellBg;
        if (isStar) cellBg = theme.star;
        else if (premium && PREMIUM_BG[premium]) cellBg = theme[PREMIUM_BG[premium]];
        bg.push(<RoundedRect key={`bg${r}-${c}`} x={x} y={y} width={cell} height={cell} r={cellR} color={cellBg} />);

        const committed = data.tile;
        const d = draftMap.get(keyOf(r, c));
        if (committed || d) {
          filled.push({ row: r, col: c });
          const blank = committed ? committed.letter === '_' : d.blank;
          const label = committed ? letterOf(committed) : d.letter;
          const val = committed ? committed.value : (d.blank ? 0 : VALUE[d.letter]);
          const lp = center(letterFont, label, x + cell / 2, y + cell / 2);
          glyphs.push(
            <SkText key={`ltr${r}-${c}`} font={letterFont} text={label} x={lp.x} y={lp.y}
              color={blank ? theme.accent : theme.tileInk} />
          );
          if (val != null) {
            glyphs.push(
              <SkText key={`val${r}-${c}`} font={valueFont} text={String(val)}
                x={x + cell * 0.13} y={y + cell * 0.32} color="rgba(0,0,0,0.42)" />
            );
          }
        } else if (hintMap.has(keyOf(r, c))) {
          const g = hintMap.get(keyOf(r, c));
          const gl = center(letterFont, letterOf(g.tile), x + cell / 2, y + cell / 2);
          marks.push(
            <Group key={`h${r}-${c}`}>
              <RoundedRect x={x + 2} y={y + 2} width={cell - 4} height={cell - 4} r={cellR * 0.8}
                color={theme.accent} style="stroke" strokeWidth={2}>
                <DashPathEffect intervals={[4, 3]} />
              </RoundedRect>
              <SkText font={letterFont} text={letterOf(g.tile)} x={gl.x} y={gl.y} color={theme.accent} />
            </Group>
          );
        } else if (isStar) {
          const star = fourPointStarPath(x + cell / 2, y + cell / 2, cell * 0.3, cell * 0.11);
          marks.push(<Path key="star" path={star} color={theme.accent} />);
        } else if (premium && PREMIUM_LABEL[premium]) {
          const t = PREMIUM_LABEL[premium];
          const pp = center(premFont, t, x + cell / 2, y + cell / 2);
          marks.push(<SkText key={`p${r}-${c}`} font={premFont} text={t} x={pp.x} y={pp.y} color={theme.premInk} />);
        }
      }
    }

    // melted tile faces: union of rounded cells (radius cellR) + thin connector necks.
    const faceUnion = filled.length ? meltUnion(filled, cell, cellR) : null;

    const borderW = Math.max(1.5, cell * 0.05); // one unbroken darker outline around the whole pill

    // green outline traces the FULL valid word(s) — committed letters included —
    // by unioning every word cell the engine reported (validSet), not just the
    // newly dropped tiles. Same union + corner rounding, so its junctions round too.
    let outline = null;
    if (validSet && validSet.size) {
      const cells = [];
      for (const k of validSet) { const [r, c] = k.split(',').map(Number); cells.push({ row: r, col: c }); }
      const u = meltUnion(cells, cell, cellR);
      if (u) outline = (
        <Path path={u} color={theme.good} style="stroke" strokeWidth={Math.max(2.5, cell * 0.09)}>
          <CornerPathEffect r={armpitR} />
        </Path>
      );
    }

    return (
      <>
        <RoundedRect x={0} y={0} width={size} height={size} r={cellR + PAD} color={theme.card} />
        {bg}
        {marks}
        {faceUnion && (
          <>
            <Path path={faceUnion} color={theme.tileFace}><CornerPathEffect r={armpitR} /></Path>
            <Path path={faceUnion} color={theme.tileLip} style="stroke" strokeWidth={borderW}><CornerPathEffect r={armpitR} /></Path>
          </>
        )}
        {glyphs}
        {outline}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, draft, hint, validSet, dragId, cell, theme, rev, fontsReady, letterFont, valueFont, premFont, size]);

  // ---- cheap per-frame overlays (kept OUT of the memoized scene above so a drag
  // hover or a settle tick doesn't rebuild all 225 cells). ----

  // Accent outline on the cell a dragged tile would drop into. `target` = {row,col}.
  const targetFx = target
    ? (() => {
        const r = cell * 0.24;
        const x = cellOrigin(target.col, cell), y = cellOrigin(target.row, cell);
        return (
          <RoundedRect x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} r={r}
            color={theme.accent} style="stroke" strokeWidth={Math.max(2, cell * 0.08)} opacity={0.92} />
        );
      })()
    : null;

  // The just-committed word's "settle" pop: redraw those cells as one melted group
  // scaled (>= 1) about their centroid, so they land enlarged and ease to rest.
  // Scale comes from the tested settleScale() curve, ticked by Game.
  const settleFx = (() => {
    if (!settle || !settle.cells || !settle.cells.length || !fontsReady) return null;
    const cellR = cell * 0.24, armpitR = cell * 0.12;
    const cells = settle.cells.map((k) => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; });
    const u = meltUnion(cells, cell, cellR);
    if (!u) return null;
    let sx = 0, sy = 0;
    for (const { row, col } of cells) { sx += cellOrigin(col, cell) + cell / 2; sy += cellOrigin(row, cell) + cell / 2; }
    const ox = sx / cells.length, oyc = sy / cells.length;
    const glyphs = [];
    for (const { row, col } of cells) {
      const tile = board[row] && board[row][col] && board[row][col].tile;
      if (!tile) continue;
      const x = cellOrigin(col, cell), y = cellOrigin(row, cell);
      const label = letterOf(tile);
      const w = letterFont.getTextWidth(label);
      const m = letterFont.getMetrics();
      glyphs.push(
        <SkText key={`sl${row}-${col}`} font={letterFont} text={label}
          x={x + cell / 2 - w / 2} y={y + cell / 2 - (m.ascent + m.descent) / 2}
          color={tile.letter === '_' ? theme.accent : theme.tileInk} />
      );
      if (tile.value != null) {
        glyphs.push(
          <SkText key={`sv${row}-${col}`} font={valueFont} text={String(tile.value)}
            x={x + cell * 0.13} y={y + cell * 0.32} color="rgba(0,0,0,0.42)" />
        );
      }
    }
    return (
      <Group origin={{ x: ox, y: oyc }} transform={[{ scale: settle.scale }]}>
        <Path path={u} color={theme.tileFace}><CornerPathEffect r={armpitR} /></Path>
        {glyphs}
      </Group>
    );
  })();

  return (
    // pointerEvents="none" is REQUIRED: the Skia Canvas otherwise swallows touches,
    // so the board's PanResponder in Game.js (which uses capture handlers) never
    // sees drags/taps. This is the render half of that fix — do not remove.
    <Canvas pointerEvents="none" style={{ width: size, height: canvasH }}>
      <Group transform={[{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }]} origin={{ x: size / 2, y: canvasH / 2 }}>
        <Group transform={[{ translateY: oy }]}>
          {content}
          {targetFx}
          {settleFx}
        </Group>
      </Group>
    </Canvas>
  );
}
