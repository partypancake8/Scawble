// Game.js — the play screen. Mirrors apps/prototype/app.js feature-for-feature:
// tap-to-place, blank picker, live preview, hint, swap, pass, move log, bot turn.
// Game logic stays in the tested controller; this is the view + interaction.
import React, { useState, useRef, useReducer, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Animated, PanResponder, StyleSheet, useWindowDimensions, Platform, Alert, ScrollView } from 'react-native';
import Board, { PAD, GAP, boardWidth } from '../ui/Board';
import ZoomableBoard from '../ui/ZoomableBoard';
import Rack from '../ui/Rack';
import Tile from '../ui/Tile';
import { letterOf, VALUE } from '../core/engine/tiles.js';
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';
import AnimatedNumber from '../ui/AnimatedNumber';
import Icon from '../ui/Icon';
import { FONT, FONT_SEMI } from '../theme';
import * as H from '../haptics';

const key = (r, c) => `${r},${c}`;
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function IconBtn({ icon, onPress, theme, testID }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.iconbtn, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Icon name={icon} size={20} color={theme.ink} />
    </Pressable>
  );
}

export default function Game({ game, settings, theme, onExit, onOpenSettings, onGameOver }) {
  const { width } = useWindowDimensions();
  const [, bump] = useReducer((x) => x + 1, 0);

  const [draft, setDraft] = useState([]);
  const [rackOrder, setRackOrder] = useState(() => game.state.racks.player.map((t) => t.id));
  const [tapSelected, setTapSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSel, setSwapSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [pendingBlank, setPendingBlank] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [evt, setEvt] = useState({ text: 'Your move — build off the center ✦', err: false });
  const timerRef = useRef(null);
  const shakeX = useRef(new Animated.Value(0)).current;
  const reduced = settings.motion === 'off';

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function shake() {
    if (reduced) return;
    shakeX.setValue(0);
    Animated.sequence([-6, 6, -4, 4, 0].map((v) => Animated.timing(shakeX, { toValue: v, duration: 45, useNativeDriver: true }))).start();
  }

  // ---- sizing ----
  const boardMax = Math.min(width - 8, 600);
  const cell = Math.floor((boardMax - 2 * PAD - 14 * GAP) / 15);
  const rackSize = Math.min(Math.floor((Math.min(width, 600) - 16 - 6 * 7) / 7), 52);
  const SS = 2; // supersample: render the board at 2x so zoom stays crisp

  // ---- derived: rack slots ----
  const byId = new Map(game.state.racks.player.map((t) => [t.id, t]));
  const placed = new Set(draft.map((d) => d.tile.id));
  const slots = [];
  for (let i = 0; i < 7; i++) {
    const id = rackOrder[i];
    slots.push(id && byId.get(id) && !placed.has(id) ? byId.get(id) : null);
  }

  // ---- derived: live preview ----
  const placements = useMemo(
    () => draft.map((d) => ({ tile: d.blank ? { ...d.tile, assigned: d.letter } : d.tile, row: d.row, col: d.col })),
    [draft]
  );
  const pv = draft.length ? game.preview(placements) : null;
  const validNow = !!(pv && pv.ok);
  const validSet = validNow ? new Set(draft.map((d) => key(d.row, d.col))) : null;

  const isPlayer = game.state.turn === 'player' && !game.state.over;
  const myTurn = isPlayer && !busy && !swapMode;

  let message = evt.text, msgErr = evt.err;
  if (draft.length) {
    if (validNow) { message = pv.words.join(', '); msgErr = false; }
    else { message = pv.error || 'Keep building…'; msgErr = true; }
  }

  // ---- rack sync after any change to the player's tiles ----
  const syncRack = useCallback(() => {
    setRackOrder((prev) => {
      const ids = game.state.racks.player.map((t) => t.id);
      const kept = prev.filter((id) => ids.includes(id));
      for (const id of ids) if (!kept.includes(id)) kept.push(id);
      return kept;
    });
  }, [game]);

  const clearHint = () => setHint(null);

  // ---- placement ----
  function onTilePress(tile) {
    if (swapMode) { toggleSwap(tile.id); return; }
    if (!isPlayer || busy) return;
    clearHint();
    setTapSelected((s) => (s === tile.id ? null : tile.id));
    H.tapLight();
  }
  function onCellPress(r, c) {
    if (busy || swapMode || !isPlayer) return;
    if (!tapSelected) return;
    if (game.state.board[r][c].tile || draft.some((d) => d.row === r && d.col === c)) return;
    const tile = game.state.racks.player.find((t) => t.id === tapSelected);
    setTapSelected(null);
    if (tile) placeTile(tile, r, c);
  }
  function placeTile(tile, r, c) {
    clearHint();
    if (tile.letter === '_') setPendingBlank({ tile, r, c });
    else commitDraft(tile, r, c, tile.letter, false);
  }
  function commitDraft(tile, r, c, letter, blank) {
    setDraft((d) => [...d, { tile, row: r, col: c, letter, blank }]);
    setTapSelected(null);
    H.tapMedium();
  }
  function resolveBlank(letter) {
    const pb = pendingBlank; setPendingBlank(null);
    if (letter && pb) commitDraft(pb.tile, pb.r, pb.c, letter, true);
  }
  function onDraftPress(r, c) { setDraft((d) => d.filter((x) => !(x.row === r && x.col === c))); clearHint(); }

  // ---- drag & drop (works for rack tiles AND placed draft tiles) ----
  const boardBoxRef = useRef(null);
  const screenRef = useRef(null);
  const boardTf = useRef({ scale: 1, tx: 0, ty: 0 }).current;
  const dragXY = useRef(new Animated.ValueXY()).current;
  const dragState = useRef({ moved: false, rect: null, off: { x: 0, y: 0 } }).current;
  const [dragTile, setDragTile] = useState(null);
  const pans = useRef({}).current;
  const latest = useRef({});
  latest.current = { isPlayer, busy, swapMode, cell, draft };

  // which board cell is under a screen point (accounts for pinch zoom/pan)
  function cellAt(px, py) {
    const rect = dragState.rect; if (!rect) return null;
    const c = latest.current.cell, sizePx = boardWidth(c), center = sizePx / 2;
    const lx = px - rect.x, ly = py - rect.y;
    if (lx < 0 || ly < 0 || lx > rect.w || ly > rect.h) return null; // off the board
    const contentX = center + (lx - center - boardTf.tx) / boardTf.scale;
    const contentY = center + (ly - center - boardTf.ty) / boardTf.scale;
    const col = Math.floor((contentX - PAD) / (c + GAP));
    const row = Math.floor((contentY - PAD) / (c + GAP));
    if (row < 0 || row > 14 || col < 0 || col > 14) return null;
    return { row, col };
  }
  const cellFree = (row, col, exceptId) =>
    !game.state.board[row][col].tile &&
    !latest.current.draft.some((d) => d.row === row && d.col === col && d.tile.id !== exceptId);

  function handleDrop(tile, px, py) {
    const src = latest.current.draft.find((d) => d.tile.id === tile.id); // was it already on the board?
    const target = cellAt(px, py);
    if (src) {
      if (!target) { setDraft((d) => d.filter((x) => x.tile.id !== tile.id)); H.tapLight(); }            // off board → back to rack
      else if (cellFree(target.row, target.col, tile.id)) {                                              // empty → move it there
        setDraft((d) => d.map((x) => (x.tile.id === tile.id ? { ...x, row: target.row, col: target.col } : x)));
        H.tapMedium();
      }                                                                                                  // onto a tile → stays put
    } else {                                                                                             // from the rack
      if (target && cellFree(target.row, target.col)) placeTile(tile, target.row, target.col);           // empty → place
      // onto a tile / off board → nothing, it returns to the rack
    }
  }

  function panFor(tile) {
    if (pans[tile.id]) return pans[tile.id];
    const canGrab = () => { const L = latest.current; return L.isPlayer && !L.busy && !L.swapMode; };
    pans[tile.id] = PanResponder.create({
      onStartShouldSetPanResponder: canGrab,
      onMoveShouldSetPanResponder: canGrab,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragState.moved = false; dragState.rect = null;
        screenRef.current?.measureInWindow((x, y) => (dragState.off = { x, y }));
        boardBoxRef.current?.measureInWindow((x, y, w, h) => (dragState.rect = { x, y, w, h }));
      },
      onPanResponderMove: (e, g) => {
        if (!dragState.moved && Math.hypot(g.dx, g.dy) > 8) { dragState.moved = true; clearHint(); H.tapLight(); setDragTile(tile); }
        if (dragState.moved) dragXY.setValue({ x: e.nativeEvent.pageX - dragState.off.x, y: e.nativeEvent.pageY - dragState.off.y });
      },
      onPanResponderRelease: (e) => {
        if (!dragState.moved) { // a tap, not a drag
          const src = latest.current.draft.find((d) => d.tile.id === tile.id);
          if (src) onDraftPress(src.row, src.col); else onTilePress(tile);
          return;
        }
        setDragTile(null);
        handleDrop(tile, e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderTerminate: () => { setDragTile(null); dragState.moved = false; },
    });
    return pans[tile.id];
  }

  const dragId = dragTile ? dragTile.id : null;
  const dEntry = dragTile && draft.find((d) => d.tile.id === dragTile.id);
  const floatLabel = dragTile ? (dEntry && dEntry.blank ? dEntry.letter : letterOf(dragTile)) : '';
  const floatBlank = dEntry ? dEntry.blank : dragTile ? dragTile.letter === '_' : false;
  const floatVal = dEntry ? (dEntry.blank ? 0 : VALUE[dEntry.letter]) : dragTile ? dragTile.value : 0;

  // ---- controls ----
  function recall() { setDraft([]); setTapSelected(null); clearHint(); }
  function shuffle() {
    setRackOrder((prev) => { const a = [...prev]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; });
    H.tapLight();
  }
  function onHint() {
    clearHint();
    const best = game.playerBest();
    if (!best) { setEvt({ text: 'No legal moves — try Swap.', err: true }); return; }
    setHint(best); setEvt({ text: `Try ${best.words.join(', ')} (+${best.score})`, err: false });
  }
  function onPass() {
    const doPass = () => { recall(); game.pass(); afterPlayer(); };
    if (Platform.OS === 'web') doPass();
    else Alert.alert('Pass your turn?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Pass', onPress: doPass }]);
  }
  function enterSwap() {
    if (game.state.bag.length < 1) { setEvt({ text: 'No tiles left to swap.', err: true }); return; }
    recall(); setSwapMode(true); setSwapSel(new Set()); setTapSelected(null);
    setEvt({ text: 'Tap tiles to exchange, then confirm.', err: false });
  }
  function toggleSwap(id) { setSwapSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function confirmSwap() {
    const tiles = game.state.racks.player.filter((t) => swapSel.has(t.id));
    if (!tiles.length) { setEvt({ text: 'Pick at least one tile.', err: true }); return; }
    const res = game.swap(tiles);
    if (!res.ok) { setEvt({ text: res.error || 'Cannot swap right now.', err: true }); return; }
    setSwapMode(false); setSwapSel(new Set()); syncRack(); afterPlayer();
  }
  function cancelSwap() { setSwapMode(false); setSwapSel(new Set()); }

  function onSubmit() {
    if (!draft.length || !validNow || busy) return;
    clearHint();
    const res = game.commit(placements);
    if (!res.ok) { setEvt({ text: res.error, err: true }); H.warn(); shake(); return; }
    setDraft([]); setTapSelected(null); syncRack();
    setEvt({ text: `${res.move.words.join(', ')} +${res.move.score}${res.move.isBingo ? ' · BINGO!' : ''}`, err: false });
    res.move.isBingo ? H.success() : H.tapMedium();
    afterPlayer();
  }

  // ---- bot flow ----
  function afterPlayer() {
    bump();
    if (game.state.over) return finish();
    setBusy(true); setEvt({ text: 'ScawBot is thinking…', err: false });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(botMove, 480);
  }
  function botMove() {
    const move = game.botTurn();
    syncRack(); bump();
    if (move) setEvt({ text: `ScawBot played ${move.words.join(', ')} — +${move.score}${move.isBingo ? ' · BINGO!' : ''}  ·  Your move.`, err: false });
    else setEvt({ text: 'ScawBot passed.  ·  Your move.', err: false });
    setBusy(false);
    if (game.state.over) finish();
  }
  function finish() { clearTimeout(timerRef.current); setBusy(false); onGameOver(game.review()); }

  // ---- HUD helpers ----
  const lastFor = (who) => { const h = game.state.history; for (let i = h.length - 1; i >= 0; i--) if (h[i].by === who) return h[i]; return null; };
  const fmtLast = (h) => !h ? 'ready' : h.pass ? 'passed' : h.swap ? `swapped ${h.swap}` : `${h.words[0]} +${h.score}`;

  const s = game.state.scores;

  return (
    <View ref={screenRef} collapsable={false} style={[styles.screen, { backgroundColor: theme.paper }]}>
      {/* top bar */}
      <View style={styles.topbar}>
        <View style={styles.sidescore}>
          <Text style={[styles.who, { color: theme.muted }]}>YOU</Text>
          <AnimatedNumber value={s.player} animate={!reduced} style={[styles.pts, { color: game.state.turn === 'player' && !game.state.over ? theme.accent : theme.ink }]} />
          <Text style={[styles.last, { color: theme.muted }]} numberOfLines={1}>{fmtLast(lastFor('player'))}</Text>
        </View>
        <View style={styles.topmid}>
          <Text style={[styles.bagNum, { color: theme.ink }]}>{game.state.bag.length}</Text>
          <Text style={[styles.bagLbl, { color: theme.muted }]}>in bag</Text>
          <View style={styles.topbtns}>
            <IconBtn icon="log" testID="btn-log" theme={theme} onPress={() => setShowLog(true)} />
            <IconBtn icon="settings" testID="btn-settings" theme={theme} onPress={onOpenSettings} />
            <IconBtn icon="home" testID="btn-home" theme={theme} onPress={onExit} />
          </View>
        </View>
        <View style={[styles.sidescore, { alignItems: 'flex-end' }]}>
          <Text style={[styles.who, { color: theme.muted }]}>SCAWBOT</Text>
          <AnimatedNumber value={s.bot} animate={!reduced} style={[styles.pts, { color: game.state.turn === 'bot' && !game.state.over ? theme.accent : theme.ink }]} />
          <Text style={[styles.last, { color: theme.muted, textAlign: 'right' }]} numberOfLines={1}>{fmtLast(lastFor('bot'))}</Text>
        </View>
      </View>

      {/* board — takes the flexible middle space so there's room to zoom */}
      <View style={styles.boardArea}>
        <View ref={boardBoxRef} collapsable={false} style={{ width: boardWidth(cell), height: boardWidth(cell) }}>
          <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
            <ZoomableBoard size={boardWidth(cell)} transformRef={boardTf}>
              <Board board={game.state.board} draft={draft} hint={hint} validSet={validSet}
                cell={cell} theme={theme} onCellPress={onCellPress} onDraftPress={onDraftPress} animate={!reduced}
                panFor={swapMode ? null : panFor} dragId={dragId} />
            </ZoomableBoard>
          </Animated.View>
        </View>
      </View>

      {/* bottom dock: live score + message + rack + controls */}
      <View style={styles.bottom}>
        <View style={styles.msgRow}>
          <Text testID="game-msg" style={[styles.msg, { color: msgErr ? theme.accent : theme.inkSoft }]} numberOfLines={2}>{message}</Text>
          {validNow && (
            <View style={[styles.scorePill, { backgroundColor: theme.good }]}>
              <Text style={styles.scorePillTxt}>+{pv.score}{pv.isBingo ? ' · BINGO' : ''}</Text>
            </View>
          )}
        </View>

        <Rack slots={slots} tileSize={rackSize} theme={theme} selectedId={tapSelected}
          swapSel={swapMode ? swapSel : null} onTilePress={onTilePress} animate={!reduced}
          panFor={swapMode ? null : panFor} dragId={dragId} />

        {!swapMode ? (
          <>
            <View style={styles.controls}>
              <Button icon="shuffle" stack title="Shuffle" testID="btn-shuffle" small theme={theme} disabled={!myTurn} onPress={shuffle} style={styles.ctl} />
              <Button icon="recall" stack title="Recall" testID="btn-recall" small theme={theme} disabled={!myTurn} onPress={recall} style={styles.ctl} />
              <Button icon="hint" stack title="Hint" testID="btn-hint" small theme={theme} disabled={!myTurn} onPress={onHint} style={styles.ctl} />
              <Button icon="swap" stack title="Swap" testID="btn-swap" small theme={theme} disabled={!myTurn} onPress={enterSwap} style={styles.ctl} />
              <Button icon="pass" stack title="Pass" testID="btn-pass" small theme={theme} disabled={!myTurn} onPress={onPass} style={styles.ctl} />
            </View>
            <View style={styles.submitRow}>
              <Button icon="submit" title="Submit" testID="btn-submit" variant="submit" small theme={theme}
                disabled={!(myTurn && draft.length && validNow)} onPress={onSubmit} style={styles.ctl} />
            </View>
          </>
        ) : (
          <View style={styles.controls}>
            <Button title={`Swap ${swapSel.size}`} variant="primary" small theme={theme} onPress={confirmSwap} style={styles.submitWide} />
            <Button title="Cancel" variant="ghost" small theme={theme} onPress={cancelSwap} style={styles.ctl} />
          </View>
        )}
      </View>

      {/* blank picker */}
      <Sheet visible={!!pendingBlank} title="Choose a letter" theme={theme} onClose={() => resolveBlank(null)}>
        <View style={styles.letters}>
          {ALPHA.map((L) => (
            <Pressable key={L} testID={`blank-${L}`} onPress={() => resolveBlank(L)}
              style={[styles.letter, { backgroundColor: theme.tileFace, borderColor: theme.line, borderBottomColor: theme.tileLip }]}>
              <Text style={{ fontFamily: FONT_SEMI, fontSize: 18, color: theme.tileInk }}>{L}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Cancel" variant="ghost" theme={theme} onPress={() => resolveBlank(null)} />
      </Sheet>

      {/* move log */}
      <Sheet visible={showLog} title="Moves" theme={theme} onClose={() => setShowLog(false)}>
        <ScrollView style={{ maxHeight: 360 }}>
          {game.state.history.length === 0 && <Text style={{ color: theme.muted, textAlign: 'center' }}>No moves yet.</Text>}
          {game.state.history.slice().reverse().map((h, i) => (
            <View key={i} style={[styles.logrow, { borderLeftColor: h.by === 'player' ? theme.accent : theme.muted, backgroundColor: theme.lineSoft }]}>
              <View>
                <Text style={{ fontFamily: FONT_SEMI, fontSize: 10, color: theme.muted }}>{h.by === 'player' ? 'YOU' : 'SCAWBOT'}</Text>
                <Text style={{ fontFamily: FONT_SEMI, color: theme.ink }}>{h.pass ? 'passed' : h.swap ? `swapped ${h.swap}` : h.words.join(', ')}</Text>
              </View>
              <Text style={{ fontFamily: FONT_SEMI, color: theme.good }}>{h.score ? `+${h.score}` : ''}</Text>
            </View>
          ))}
        </ScrollView>
        <Button title="Close" variant="ghost" theme={theme} onPress={() => setShowLog(false)} />
      </Sheet>

      {/* floating tile while dragging */}
      {dragTile && (
        <Animated.View pointerEvents="none" style={[styles.floating, {
          transform: [{ translateX: Animated.subtract(dragXY.x, rackSize * 0.58) }, { translateY: Animated.subtract(dragXY.y, rackSize * 0.58) }],
        }]}>
          <Tile label={floatLabel} value={floatVal} blank={floatBlank} size={rackSize * 1.15} theme={theme} fontScale={0.52} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 8 },
  topbar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 10 },
  sidescore: { minWidth: 96 },
  who: { fontFamily: FONT_SEMI, fontSize: 11, letterSpacing: 1 },
  pts: { fontFamily: FONT_SEMI, fontSize: 32 },
  last: { fontFamily: FONT, fontSize: 11.5, maxWidth: 120 },
  topmid: { alignItems: 'center' },
  bagNum: { fontFamily: FONT_SEMI, fontSize: 19 },
  bagLbl: { fontFamily: FONT, fontSize: 10.5 },
  topbtns: { flexDirection: 'row', gap: 6, marginTop: 4 },
  iconbtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  bottom: { width: '100%', maxWidth: 600, alignSelf: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24, justifyContent: 'center', flexWrap: 'wrap' },
  msg: { fontFamily: FONT, fontSize: 15, textAlign: 'center', flexShrink: 1 },
  scorePill: { paddingHorizontal: 11, paddingVertical: 3, borderRadius: 999 },
  scorePillTxt: { fontFamily: FONT_SEMI, fontSize: 14, color: '#fff' },
  controls: { flexDirection: 'row', gap: 6, width: '100%', maxWidth: 600 },
  ctl: { flex: 1, paddingHorizontal: 2 },
  submitRow: { flexDirection: 'row', width: '100%', maxWidth: 600 },
  submitWide: { flex: 2 },
  letters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  letter: { width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  logrow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 10, borderLeftWidth: 3, marginBottom: 5 },
  floating: { position: 'absolute', left: 0, top: 0, zIndex: 300, elevation: 24 },
});
