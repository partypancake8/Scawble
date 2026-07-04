// Sheet.js — bottom-sheet overlay used by the blank picker and the move log.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FONT_SEMI } from '../theme';

export default function Sheet({ visible, title, onClose, theme, children }) {
  if (!visible) return null;
  return (
    <Pressable style={styles.scrim} onPress={onClose} testID="sheet-scrim" accessible={false}>
      <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={() => {}} accessible={false}>
        <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>
        {children}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
    backgroundColor: 'rgba(20,20,25,0.42)', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.25, shadowRadius: 40 },
  title: { fontFamily: FONT_SEMI, fontSize: 19, textAlign: 'center' },
});
