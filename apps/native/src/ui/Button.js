// Button.js — the chunky rounded button. Optional icon (row or stacked over label).
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FONT_SEMI } from '../theme';
import Icon from './Icon';

export default function Button({ title, onPress, variant = 'normal', disabled, theme, style, small, testID, icon, stack }) {
  const primary = variant === 'primary' || variant === 'submit';
  const ghost = variant === 'ghost';
  const fg = primary ? '#fff' : theme.ink;
  const fontSize = stack ? 11.5 : small ? 13.5 : 15.5;

  let content;
  if (icon && stack) {
    content = (
      <View style={styles.stack}>
        <Icon name={icon} size={19} color={fg} />
        <Text numberOfLines={1} style={{ fontFamily: FONT_SEMI, fontSize, color: fg }}>{title}</Text>
      </View>
    );
  } else if (icon) {
    content = (
      <View style={styles.row}>
        <Icon name={icon} size={17} color={fg} />
        <Text numberOfLines={1} style={{ fontFamily: FONT_SEMI, fontSize, color: fg }}>{title}</Text>
      </View>
    );
  } else {
    content = <Text numberOfLines={1} style={{ fontFamily: FONT_SEMI, fontSize, color: fg }}>{title}</Text>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: ghost ? 'transparent' : primary ? theme.accent : theme.surface,
          borderColor: primary || ghost ? 'transparent' : theme.line,
          borderBottomColor: ghost ? 'transparent' : primary ? theme.accentPress : theme.line,
          paddingVertical: stack ? 8 : small ? 10 : 13,
          opacity: disabled ? 0.4 : 1,
        },
        pressed && !disabled ? { transform: [{ translateY: 1 }, { scale: 0.98 }] } : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stack: { alignItems: 'center', gap: 3 },
});
