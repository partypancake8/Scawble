// Analysis.js — the ScawBot post-game review (Strategy % + Luck % + per-turn).
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import { FONT, FONT_SEMI } from '../theme';

export default function Analysis({ review, scores, theme, onHome }) {
  const won = scores.player > scores.bot;
  const draw = scores.player === scores.bot;
  const title = won ? 'You win! 🎉' : draw ? "It's a draw" : 'ScawBot wins';
  const bp = review.bestPlay;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.paper }} contentContainerStyle={styles.content}>
      <Text style={[styles.h2, { color: theme.ink }]}>{title}</Text>
      <Text style={[styles.sub, { color: theme.inkSoft }]}>Final — You {scores.player} · ScawBot {scores.bot}</Text>

      <View style={styles.ratings}>
        <View style={[styles.rating, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.big, { color: theme.ink }]}>{review.strategy}%</Text>
          <Text style={[styles.lbl, { color: theme.muted }]}>STRATEGY</Text>
        </View>
        <View style={[styles.rating, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.big, { color: theme.ink }]}>{review.luck}%</Text>
          <Text style={[styles.lbl, { color: theme.muted }]}>LUCK</Text>
        </View>
      </View>

      <Text style={[styles.sub, { color: theme.inkSoft }]}>
        Best play: <Text style={{ fontFamily: FONT_SEMI }}>{bp.words ? bp.words.join(', ') : '—'}</Text> (+{bp.actual ?? 0})
      </Text>

      <View style={styles.turnlist}>
        {review.turns.map((t, i) => {
          const ok = t.actual >= t.best;
          return (
            <View key={i} style={[styles.turnrow, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Text style={{ fontFamily: FONT_SEMI, color: theme.ink, flexShrink: 1 }}>{(t.words || []).join(', ') || '—'}</Text>
              <Text style={{ fontFamily: FONT_SEMI, color: ok ? theme.good : theme.accent, textAlign: 'right' }}>
                {ok ? `${t.actual} ✓` : `${t.actual} / best ${t.best} (${t.bestWords.join(',')})`}
              </Text>
            </View>
          );
        })}
      </View>

      <Button title="Home" variant="primary" theme={theme} onPress={onHome} style={{ width: 300, alignSelf: 'center' }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 16, padding: 22, paddingTop: 40 },
  h2: { fontFamily: FONT_SEMI, fontSize: 30 },
  sub: { fontFamily: FONT, fontSize: 15, textAlign: 'center' },
  ratings: { flexDirection: 'row', gap: 16 },
  rating: { borderRadius: 18, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', minWidth: 128, borderWidth: 1.5 },
  big: { fontFamily: FONT_SEMI, fontSize: 42, lineHeight: 46 },
  lbl: { fontFamily: FONT_SEMI, fontSize: 10, letterSpacing: 1.5, marginTop: 4 },
  turnlist: { width: '100%', maxWidth: 460, gap: 5 },
  turnrow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
});
