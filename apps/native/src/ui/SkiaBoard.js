// SkiaBoard.js — the 15x15 board rendered with Skia (vector/GPU) so it stays
// crisp at ANY zoom. iOS rasterizes React Native View transforms → blur; Skia
// re-rasterizes the vector scene at the final scale each frame → print-sharp.
//
// This component is PURE render-from-props. Zoom/pan (`view`), gesture handling,
// and drop decisions live in Game.js on top of the tested src/core/board math.
//
// MELT: the fused tile shape is one SDF "metaball" runtime shader (meltShader.js).
// The board is a signed distance field — a rounded-box SDF per filled cell,
// smooth-unioned (smin). Straight runs fuse into a clean pill, crossings round
// uniformly, and enclosed EMPTY cells stay open holes, all correct by construction
// (see meltShader.js). Cells/glyphs/marks stay vector; the melt + green outline
// are two shader passes over a tiny 15x15 occupancy mask.
import React, { useMemo } from 'react';
import {
  Canvas, Group, RoundedRect, Rect, Path, Text as SkText, Skia, DashPathEffect,
  Shader, ImageShader, FilterMode, MipmapMode, useFont,
} from '@shopify/react-native-skia';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { SIZE, GAP, PAD, boardWidth, cellOrigin } from '../core/board/geometry.js';
import { filledKeys, maskSignature } from '../core/board/meltmask.js';
import { getMeltEffect, makeMaskImage, toRgba } from './meltShader.js';
import { letterOf, VALUE } from '../core/engine/tiles.js';
import { PREMIUM_BG, PREMIUM_LABEL } from '../theme';

const keyOf = (r, c) => `${r},${c}`;
const K_FACTOR = 0.34; // smin blend as a fraction of cell — the "melt amount" knob (fuses tiles into a pill)

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
  const effect = getMeltEffect();
  const cellR = cell * 0.24;

  // Centre text on its TIGHT visual bounds so both axes account for glyph
  // side-bearings + cap height (advance-width + full-em metrics sit labels high
  // and off to one side).
  const center = (font, text, cx, cy) => {
    const b = font.measureText ? font.measureText(text) : null;
    if (b && typeof b.width === 'number' && typeof b.x === 'number') {
      return { x: cx - b.width / 2 - b.x, y: cy - b.height / 2 - b.y };
    }
    const w = font.getTextWidth(text);
    const m = font.getMetrics();
    const cap = m && m.capHeight ? m.capHeight : font.getSize() * 0.7;
    return { x: cx - w / 2, y: cy + cap / 2 };
  };

  // Vector scene (memoized, NOT dependent on `view`): board card + cell
  // backgrounds + marks (premium labels / star / hint) + tile glyphs. Split into
  // `under` (drawn below the melt) and `glyphs` (drawn on top of it).
  const scene = useMemo(() => {
    if (!fontsReady) return null;
    const draftShown = (draft || []).filter((d) => d.tile.id !== dragId);
    const draftMap = new Map(draftShown.map((d) => [keyOf(d.row, d.col), d]));
    const hintMap = new Map((hint ? hint.placements : []).map((p) => [keyOf(p.row, p.col), p]));

    const under = [<RoundedRect key="card" x={0} y={0} width={size} height={size} r={cellR + PAD} color={theme.card} />];
    const glyphs = [];

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
        under.push(<RoundedRect key={`bg${r}-${c}`} x={x} y={y} width={cell} height={cell} r={cellR} color={cellBg} />);

        const committed = data.tile;
        const d = draftMap.get(keyOf(r, c));
        if (committed || d) {
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
          under.push(
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
          under.push(<Path key="star" path={star} color={theme.accent} />);
        } else if (premium && PREMIUM_LABEL[premium]) {
          const t = PREMIUM_LABEL[premium];
          const pp = center(premFont, t, x + cell / 2, y + cell / 2);
          under.push(<SkText key={`p${r}-${c}`} font={premFont} text={t} x={pp.x} y={pp.y} color={theme.premInk} />);
        }
      }
    }
    return { under, glyphs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, draft, hint, dragId, cell, theme, rev, fontsReady, letterFont, valueFont, premFont, size]);

  // 15x15 occupancy masks (rebuilt only when the filled set changes).
  const filledSet = useMemo(() => (fontsReady ? filledKeys(board, draft, dragId) : new Set()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, draft, dragId, rev, fontsReady]);
  const meltMask = useMemo(() => (filledSet.size ? makeMaskImage(filledSet) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maskSignature(filledSet)]);
  const wordSig = validSet && validSet.size ? [...validSet].sort().join('|') : '';
  const wordMask = useMemo(() => (wordSig ? makeMaskImage(new Set(wordSig.split('|'))) : null), [wordSig]);
  const settleSig = settle && settle.cells ? settle.cells.join('|') : '';
  const settleMask = useMemo(() => (settleSig ? makeMaskImage(new Set(settleSig.split('|'))) : null), [settleSig]);

  // One melt pass: fills the board rect with the SDF isosurface (fill + edge band).
  // fragCoord is content-space; aaScale (device px per content unit) keeps the AA
  // ~1px at any zoom so the isosurface stays print-sharp.
  const meltRect = (mask, fill, border, borderW, aaScale) => {
    if (!effect || !mask) return null;
    const uniforms = {
      u_pad: PAD, u_pitch: cell + GAP, u_half: (cell + GAP) / 2, u_radius: cellR,
      u_k: cell * K_FACTOR, u_aa: 0.7 / Math.max(0.4, aaScale), u_borderW: borderW,
      u_fill: fill, u_border: border,
    };
    return (
      <Rect x={0} y={0} width={size} height={size}>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={mask} tx="clamp" ty="clamp" fit="none"
            sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }} />
        </Shader>
      </Rect>
    );
  };

  const meltFx = meltRect(meltMask, toRgba(theme.tileFace), toRgba(theme.tileLip), Math.max(1.3, cell * 0.05), view.scale);
  const outlineFx = meltRect(wordMask, [0, 0, 0, 0], toRgba(theme.good), Math.max(1.6, cell * 0.055), view.scale);

  // Fallback if the shader ever fails to compile: plain per-cell cream faces so
  // tiles are still visible (no merge, but never a blank/crash).
  const faceFallback = (!effect && filledSet.size)
    ? [...filledSet].map((k) => {
        const [r, c] = k.split(',').map(Number);
        return <RoundedRect key={`ff${k}`} x={cellOrigin(c, cell)} y={cellOrigin(r, cell)} width={cell} height={cell} r={cellR} color={theme.tileFace} />;
      })
    : null;

  // Accent outline on the cell a dragged tile would drop into. `target` = {row,col}.
  const targetFx = target ? (
    <RoundedRect x={cellOrigin(target.col, cell) + 1.5} y={cellOrigin(target.row, cell) + 1.5}
      width={cell - 3} height={cell - 3} r={cellR}
      color={theme.accent} style="stroke" strokeWidth={Math.max(2, cell * 0.08)} opacity={0.92} />
  ) : null;

  // The just-committed word's "settle" pop: redraw those cells (melt shader) scaled
  // (>= 1) about their centroid, so they land enlarged and ease to rest.
  const settleFx = (() => {
    if (!settle || !settleMask || !fontsReady) return null;
    const cells = settleSig.split('|').map((k) => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; });
    let sx = 0, sy = 0;
    for (const { row, col } of cells) { sx += cellOrigin(col, cell) + cell / 2; sy += cellOrigin(row, cell) + cell / 2; }
    const ox = sx / cells.length, oyc = sy / cells.length;
    const glyphs = [];
    for (const { row, col } of cells) {
      const tile = board[row] && board[row][col] && board[row][col].tile;
      if (!tile) continue;
      const x = cellOrigin(col, cell), y = cellOrigin(row, cell);
      const lp = center(letterFont, letterOf(tile), x + cell / 2, y + cell / 2);
      glyphs.push(<SkText key={`sl${row}-${col}`} font={letterFont} text={letterOf(tile)} x={lp.x} y={lp.y}
        color={tile.letter === '_' ? theme.accent : theme.tileInk} />);
      if (tile.value != null) glyphs.push(<SkText key={`sv${row}-${col}`} font={valueFont} text={String(tile.value)}
        x={x + cell * 0.13} y={y + cell * 0.32} color="rgba(0,0,0,0.42)" />);
    }
    return (
      <Group origin={{ x: ox, y: oyc }} transform={[{ scale: settle.scale }]}>
        {meltRect(settleMask, toRgba(theme.tileFace), toRgba(theme.tileLip), Math.max(1.3, cell * 0.05), view.scale * settle.scale)}
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
          {scene?.under}
          {faceFallback}
          {meltFx}
          {scene?.glyphs}
          {outlineFx}
          {targetFx}
          {settleFx}
        </Group>
      </Group>
    </Canvas>
  );
}
