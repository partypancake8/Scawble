// Settings.js — sound / haptics / motion / theme / difficulty (mirrors the web).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Button from '../ui/Button';
import { FONT, FONT_SEMI } from '../theme';

function Toggle({ on, theme, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, { backgroundColor: on ? theme.good : theme.line }]}>
      <View style={[styles.knob, { transform: [{ translateX: on ? 22 : 0 }] }]} />
    </Pressable>
  );
}
function Seg({ options, value, theme, onSelect, fill }) {
  return (
    <View style={[styles.seg, fill && styles.segFill]}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onSelect(v)}
            style={[styles.segbtn, fill && styles.segbtnFill, { backgroundColor: on ? theme.ink : 'transparent', borderColor: on ? 'transparent' : theme.line }]}>
            <Text numberOfLines={1} style={{ fontFamily: FONT_SEMI, fontSize: 12, color: on ? theme.paper : theme.muted }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Settings({ settings, difficulty, theme, onToggle, onChange, onSetDifficulty, onBack }) {
  const Row = ({ label, children, stack }) => (
    <View style={[styles.setrow, stack && styles.setrowStack, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Text style={{ fontFamily: FONT, fontSize: 15, color: theme.ink }}>{label}</Text>
      {children}
    </View>
  );
  return (
    <View style={[styles.screen, { backgroundColor: theme.paper }]}>
      <Text style={[styles.title, { color: theme.ink }]}>Settings</Text>
      <View style={styles.list}>
        <Row label="Sound"><Toggle on={settings.sound} theme={theme} onPress={() => onToggle('sound')} /></Row>
        <Row label="Haptics"><Toggle on={settings.haptics} theme={theme} onPress={() => onToggle('haptics')} /></Row>
        <Row label="Motion"><Seg options={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]} value={settings.motion} theme={theme} onSelect={(v) => onChange('motion', v)} /></Row>
        <Row label="Theme"><Seg options={[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]} value={settings.theme} theme={theme} onSelect={(v) => onChange('theme', v)} /></Row>
        <Row label="Difficulty" stack><Seg fill options={[['casual', 'Casual'], ['skilled', 'Skilled'], ['expert', 'Expert'], ['brutal', 'Brutal']]} value={difficulty} theme={theme} onSelect={onSetDifficulty} /></Row>
      </View>
      <Button title="Done" variant="primary" theme={theme} onPress={onBack} style={{ width: 300 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', paddingTop: 44, gap: 16, padding: 20 },
  title: { fontFamily: FONT_SEMI, fontSize: 30 },
  list: { gap: 10, width: '100%', maxWidth: 380 },
  setrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1.5 },
  setrowStack: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: 10 },
  toggle: { width: 48, height: 27, borderRadius: 999, padding: 3, justifyContent: 'center' },
  knob: { width: 21, height: 21, borderRadius: 999, backgroundColor: '#fff' },
  seg: { flexDirection: 'row', gap: 4 },
  segFill: { width: '100%', gap: 6 },
  segbtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5 },
  segbtnFill: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
});
