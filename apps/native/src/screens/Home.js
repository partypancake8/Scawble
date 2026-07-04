// Home.js — wordmark, difficulty select, play buttons, streak line.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Tile from '../ui/Tile';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { FONT, FONT_SEMI } from '../theme';

const WORDMARK = [['S', 1], ['C', 2], ['A', 1], ['W', 5], ['B', 3], ['L', 1], ['E', 1]];
const TIERS = [['casual', 'Casual'], ['skilled', 'Skilled'], ['expert', 'Expert'], ['brutal', 'Brutal']];

export default function Home({ theme, difficulty, stats, loading, loadError, onSetDifficulty, onPlayDaily, onPlayClassic, onOpenSettings }) {
  const streak = stats && stats.games
    ? `Streak ${stats.streak || 0} · Best ${stats.best || 0} · ${stats.wins || 0}/${stats.games} won`
    : 'Your first game awaits.';
  return (
    <View style={[styles.screen, { backgroundColor: theme.paper }]}>
      <Pressable testID="home-settings" onPress={onOpenSettings} style={styles.corner}><Icon name="settings" size={24} color={theme.inkSoft} /></Pressable>

      <View style={styles.wordmark}>
        {WORDMARK.map(([l, v], i) => (
          <Tile key={i} label={l} value={v} size={46} theme={theme} fontScale={0.55} />
        ))}
      </View>
      <Text style={[styles.tagline, { color: theme.inkSoft }]}>A cozy daily word game. Just you and ScawBot.</Text>

      <View style={styles.menu}>
        <View style={styles.diffrow}>
          {TIERS.map(([d, l]) => {
            const on = d === difficulty;
            return (
              <Pressable key={d} onPress={() => onSetDifficulty(d)}
                style={[styles.pill, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? 'transparent' : theme.line }]}>
                <Text style={{ fontFamily: FONT_SEMI, fontSize: 13, color: on ? '#fff' : theme.muted }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button title={loading ? 'Loading dictionary…' : "Play today's puzzle"} testID="btn-daily" variant="primary" theme={theme}
          disabled={loading} onPress={onPlayDaily} />
        <Button title="Classic game" testID="btn-classic" theme={theme} disabled={loading} onPress={onPlayClassic} />
        <Text style={[styles.streak, { color: theme.muted }]}>{streak}</Text>
        {loadError ? <Text style={{ color: theme.accent, textAlign: 'center' }}>{loadError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 26, padding: 32 },
  corner: { position: 'absolute', top: 16, right: 16, padding: 8 },
  wordmark: { flexDirection: 'row', gap: 6 },
  tagline: { fontFamily: FONT, fontSize: 17, textAlign: 'center', maxWidth: 260 },
  menu: { gap: 11, width: '100%', maxWidth: 320 },
  diffrow: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' },
  pill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  streak: { fontFamily: FONT, fontSize: 13, textAlign: 'center' },
});
