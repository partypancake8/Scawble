// Board.js — the 15x15 grid. Renders premium squares, the center star, committed
// tiles, the current draft (tap to recall), and hint ghosts. Pure presentational.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Tile from './Tile';
import { FONT_SEMI, PREMIUM_BG, PREMIUM_LABEL } from '../theme';
import { VALUE, letterOf } from '../core/engine/tiles.js';

export const GAP = 2;
export const PAD = 4;
export function boardWidth(cell) { return 15 * cell + 14 * GAP + 2 * PAD; }

const key = (r, c) => `${r},${c}`;

export default function Board({ board, draft, hint, validSet, cell, theme, onCellPress, onDraftPress, animate, panFor, dragId, gap = GAP, pad = PAD }) {
  const bw = 15 * cell + 14 * gap + 2 * pad;
  const draftAt = new Map((draft || []).map((d) => [key(d.row, d.col), d]));
  const hintAt = new Map((hint ? hint.placements : []).map((p) => [key(p.row, p.col), p]));
  const inset = Math.max(1.5, cell * 0.06);
  const cellR = cell * 0.24;

  const kids = [];
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cellData = board[r][c];
      const premium = cellData.premium;
      const isStar = r === 7 && c === 7;
      const committed = cellData.tile;
      const d = draftAt.get(key(r, c));
      const g = hintAt.get(key(r, c));
      const valid = validSet && validSet.has(key(r, c));

      let bg = theme.cellBg;
      if (isStar) bg = theme.star;
      else if (premium && PREMIUM_BG[premium]) bg = theme[PREMIUM_BG[premium]];

      let content = null;
      let onPress = null;
      if (committed) {
        content = <Tile label={letterOf(committed)} value={committed.value} blank={committed.letter === '_'}
          size={cell} radius={cellR} theme={theme} fontScale={0.56} animate={animate} />;
      } else if (d) {
        const dTile = <Tile label={d.letter} value={d.blank ? 0 : VALUE[d.letter]} blank={d.blank}
          size={cell} radius={cellR} theme={theme} fontScale={0.56} animate={animate} />;
        if (panFor) {
          content = <View {...panFor(d.tile).panHandlers} style={{ opacity: d.tile.id === dragId ? 0 : 1 }}>{dTile}</View>;
        } else {
          onPress = () => onDraftPress(r, c);
          content = dTile;
        }
      } else if (g) {
        content = (
          <View style={[styles.ghost, { borderRadius: cellR, borderColor: theme.accent }]}>
            <Text style={{ fontFamily: FONT_SEMI, fontSize: cell * 0.46, color: theme.accent }}>{letterOf(g.tile)}</Text>
          </View>
        );
      } else if (isStar) {
        content = <Text style={{ fontFamily: FONT_SEMI, fontSize: cell * 0.5, color: theme.accent }}>✦</Text>;
      } else if (premium) {
        content = <Text style={{ fontFamily: FONT_SEMI, fontSize: cell * 0.3, color: theme.premInk }}>{PREMIUM_LABEL[premium]}</Text>;
      }

      const outline = valid
        ? { borderWidth: 3, borderColor: theme.good }
        : null;

      kids.push(
        <Pressable key={key(r, c)} testID={`cell-${r}-${c}`} onPress={onPress || (committed ? undefined : () => onCellPress(r, c))}
          style={[styles.cell, { width: cell, height: cell, borderRadius: cellR, backgroundColor: bg }, outline]}>
          {content}
        </Pressable>
      );
    }
  }

  return (
    <View style={[styles.board, { width: bw, gap, padding: pad, backgroundColor: theme.card }]}>
      {kids}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  cell: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ghost: { position: 'absolute', inset: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
});
