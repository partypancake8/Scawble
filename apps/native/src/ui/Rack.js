// Rack.js — the 7-tile rack. Tap a tile to select it (then tap a board cell to
// place), or drag it straight onto the board. In swap mode, tapping toggles it.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Tile from './Tile';
import { letterOf } from '../core/engine/tiles.js';

export default function Rack({ slots, tileSize, theme, selectedId, swapSel, onTilePress, animate, panFor, dragId }) {
  return (
    <View style={[styles.rack, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      {slots.map((tile, i) => (
        <View key={i} style={[styles.slot, { width: tileSize, height: tileSize, borderRadius: tileSize * 0.24, backgroundColor: theme.lineSoft }]}>
          {tile && (panFor ? (
            <View {...panFor(tile).panHandlers} testID={`rack-${i}`} style={{ opacity: tile.id === dragId ? 0 : 1 }}>
              <Tile label={letterOf(tile)} value={tile.value} blank={tile.letter === '_'} size={tileSize} theme={theme}
                fontScale={0.52} selected={tile.id === selectedId} swapsel={swapSel && swapSel.has(tile.id)} animate={animate} />
            </View>
          ) : (
            <Tile label={letterOf(tile)} value={tile.value} blank={tile.letter === '_'} size={tileSize} theme={theme}
              fontScale={0.52} selected={tile.id === selectedId} swapsel={swapSel && swapSel.has(tile.id)}
              testID={`rack-${i}`} animate={animate} onPress={() => onTilePress(tile)} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rack: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 16, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  slot: { alignItems: 'center', justifyContent: 'center' },
});
