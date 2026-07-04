// Icon.js — one icon system for the whole app. We use Ionicons (rounded, cute,
// ships with Expo). Reference icons by semantic name; to add a feature icon just
// add a line here, and to switch icon packs later you change only this file.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

const NAMES = {
  // header / nav
  home: 'home-outline',
  settings: 'settings-outline',
  log: 'list-outline',
  back: 'chevron-back',
  close: 'close',
  // game actions (available for future icon buttons)
  shuffle: 'shuffle',
  recall: 'arrow-undo-outline',
  hint: 'bulb-outline',
  swap: 'swap-horizontal',
  pass: 'play-skip-forward-outline',
  submit: 'checkmark',
  // misc for later features
  star: 'star',
  stats: 'stats-chart-outline',
  share: 'share-outline',
  trophy: 'trophy-outline',
  sound: 'volume-high-outline',
  info: 'information-circle-outline',
};

export default function Icon({ name, size = 20, color = '#333', style }) {
  return <Ionicons name={NAMES[name] || name} size={size} color={color} style={style} />;
}
