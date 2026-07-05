// Tile.js — a single Scawble tile (rack, board, wordmark). Flat rounded face
// (no bottom lip), a big centred letter, small point value in the top-left;
// blanks render in accent.
// Pops in with a spring on mount (the web "enter"/"snap"/"land" feel).
// State props: `selected` (tap-selected → accent ring + lift), `swapsel` (swap
// mode → accent2 ring), `faded` (dimmed). `animate` toggles the pop-in spring.
// Used by Rack (RN); the board tiles are drawn in Skia (SkiaBoard), not here.
import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { FONT_SEMI } from '../theme';

export default function Tile({ label, value, size, theme, blank, selected, swapsel, faded, fontScale = 0.5, onPress, testID, animate = false, radius }) {
  const r = radius != null ? radius : size * 0.26;
  const scale = useRef(new Animated.Value(animate ? 0.62 : 1)).current;
  useEffect(() => {
    if (animate) Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, []);

  const body = (
    <Animated.View
      style={[
        styles.tile,
        {
          width: size, height: size, borderRadius: r,
          backgroundColor: theme.tileFace,
          // flat tile: no bottom lip; a soft, even (non-directional) ambient shadow only.
          shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
          opacity: faded ? 0.35 : 1,
          transform: [{ scale }, ...(selected ? [{ translateY: -4 }] : [])],
        },
        selected && { borderWidth: 3, borderColor: theme.accent },
        swapsel && { borderWidth: 3, borderColor: theme.accent2 },
      ]}
    >
      <Text style={{ fontFamily: FONT_SEMI, fontSize: size * fontScale * 1.08, color: blank ? theme.accent : theme.tileInk }}>
        {label}
      </Text>
      {value != null && (
        <Text style={[styles.val, { fontSize: size * fontScale * 0.32, left: size * 0.08, top: size * 0.05 }]}>
          {value}
        </Text>
      )}
    </Animated.View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} hitSlop={4} testID={testID}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  val: { position: 'absolute', fontFamily: FONT_SEMI, color: 'rgba(0,0,0,0.42)' },
});
