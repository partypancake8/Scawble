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
import { SIZE, GAP, boardWidth, cellOrigin } from '../core/board/geometry.js';
import { letterOf, VALUE } from '../core/engine/tiles.js';
import { PREMIUM_BG, PREMIUM_LABEL } from '../theme';

const keyOf = (r, c) => `${r},${c}`;

// The melt outline: the SHARP union of every cell's square, drawn one pitch wide
// (cell + GAP) so neighbouring cells overlap and the union is a clean, STEP-FREE
// orthogonal polygon. A single `<CornerPathEffect r={cellR}>` at draw time then
// rounds EVERY corner uniformly — convex (outer caps) AND concave (the inner
// "armpits" where words cross) — so junctions merge smoothly with no seams,
// per-corner logic, or fillet hacks. Used for both the fill and the green outline.
function meltUnion(cells, cell) {
  let u = null;
  for (const { row, col } of cells) {
    const p = Skia.Path.Make();
    p.addRect({ x: cellOrigin(col, cell) - GAP / 2, y: cellOrigin(row, cell) - GAP / 2, width: cell + GAP, height: cell + GAP });
    if (!u) u = p; else u.op(p, PathOp.Union);
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

export default function SkiaBoard({ board, draft, hint, validSet, cell, theme, view, dragId, rev, canvasHeight }) {
  const size = boardWidth(cell);
  // The canvas can be TALLER than the board so zoom has room to grow into the
  // space above/below. The board is centred vertically (offset oy); the zoom
  // pivots about the canvas centre. Game.js hit-tests with the same {cx,cy,oy}.
  const canvasH = canvasHeight && canvasHeight > size ? canvasHeight : size;
  const oy = (canvasH - size) / 2;
  const letterFont = useFont(Fredoka_600SemiBold, cell * 0.56);
  const valueFont = useFont(Fredoka_600SemiBold, Math.max(8, cell * 0.26));
  const premFont = useFont(Fredoka_600SemiBold, Math.max(7, cell * 0.3));
  const fontsReady = letterFont && valueFont && premFont;

  // The whole scene is memoized on its VISUAL inputs — NOT on `view`. During a
  // pinch only `view` changes, so we reuse this element tree and Skia just
  // re-applies the Group transform: crisp zoom without rebuilding the scene.
  const content = useMemo(() => {
    if (!fontsReady) return null;

    const cellR = cell * 0.24;
    const lip = Math.max(1.5, cell * 0.055);

    const draftShown = (draft || []).filter((d) => d.tile.id !== dragId);
    const draftMap = new Map(draftShown.map((d) => [keyOf(d.row, d.col), d]));
    const hintMap = new Map((hint ? hint.placements : []).map((p) => [keyOf(p.row, p.col), p]));
    const isFilled = (r, c) => !!(board[r] && board[r][c] && board[r][c].tile) || draftMap.has(keyOf(r, c));

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
          const lp = center(letterFont, label, x + cell / 2, y + cell / 2 - lip / 2);
          glyphs.push(
            <SkText key={`ltr${r}-${c}`} font={letterFont} text={label} x={lp.x} y={lp.y}
              color={blank ? theme.accent : theme.tileInk} />
          );
          if (val != null) {
            const vw = valueFont.getTextWidth(String(val));
            glyphs.push(
              <SkText key={`val${r}-${c}`} font={valueFont} text={String(val)}
                x={x + cell * 0.86 - vw} y={y + cell * 0.9 - lip} color="rgba(0,0,0,0.42)" />
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

    // melted tile faces: one step-free union per word, corner-rounded at draw time.
    // The lip is the same union shifted down by `lip`, so a single soft edge follows
    // the whole bottom contour (never per-cell) — the "one continuous tile-word" look.
    const faceUnion = filled.length ? meltUnion(filled, cell) : null;

    // green outline traces the FULL valid word(s) — committed letters included —
    // by unioning every word cell the engine reported (validSet), not just the
    // newly dropped tiles. Same union + corner rounding, so its junctions round too.
    let outline = null;
    if (validSet && validSet.size) {
      const cells = [];
      for (const k of validSet) { const [r, c] = k.split(',').map(Number); cells.push({ row: r, col: c }); }
      const u = meltUnion(cells, cell);
      if (u) outline = (
        <Path path={u} color={theme.good} style="stroke" strokeWidth={Math.max(2.5, cell * 0.09)}>
          <CornerPathEffect r={cellR} />
        </Path>
      );
    }

    return (
      <>
        <RoundedRect x={0} y={0} width={size} height={size} r={18} color={theme.card} />
        {bg}
        {marks}
        {faceUnion && (
          <>
            <Group transform={[{ translateY: lip }]}>
              <Path path={faceUnion} color={theme.tileLip}><CornerPathEffect r={cellR} /></Path>
            </Group>
            <Path path={faceUnion} color={theme.tileFace}><CornerPathEffect r={cellR} /></Path>
          </>
        )}
        {glyphs}
        {outline}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, draft, hint, validSet, dragId, cell, theme, rev, fontsReady, letterFont, valueFont, premFont, size]);

  return (
    // pointerEvents="none" is REQUIRED: the Skia Canvas otherwise swallows touches,
    // so the board's PanResponder in Game.js (which uses capture handlers) never
    // sees drags/taps. This is the render half of that fix — do not remove.
    <Canvas pointerEvents="none" style={{ width: size, height: canvasH }}>
      <Group transform={[{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }]} origin={{ x: size / 2, y: canvasH / 2 }}>
        <Group transform={[{ translateY: oy }]}>
          {content}
        </Group>
      </Group>
    </Canvas>
  );
}
