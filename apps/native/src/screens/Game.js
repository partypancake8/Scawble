// Game.js — the play screen. Mirrors apps/prototype/app.js feature-for-feature:
// tap-to-place, blank picker, live preview, hint, swap, pass, move log, bot turn.
// Game logic stays in the tested controller; this is the view + interaction.
import React, { useState, useRef, useReducer, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Animated, PanResponder, StyleSheet, useWindowDimensions, Platform, Alert, ScrollView } from 'react-native';
import SkiaBoard from '../ui/SkiaBoard';
import { PAD, GAP, boardWidth } from '../core/board/geometry.js';
import { decideDrop, cellAtScreen, pinchView, panView } from '../core/board/interaction.js';
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
  // `rev`/`bump`: the controller MUTATES game.state in place (commit, bot move), so
  // React never sees a prop change. bump() after each move increments `rev`, and
  // `rev` is passed to SkiaBoard so its scene useMemo re-runs (busts the memo).
  // Without this the board wouldn't repaint after a committed move.
  const [rev, bump] = useReducer((x) => x + 1, 0);

  const [draft, setDraft] = useState([]);
  const [rackOrder, setRackOrder] = useState(() => game.state.racks.player.map((t) => t.id));
  const [tapSelected, setTapSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSel, setSwapSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [pendingBlank, setPendingBlank] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [areaH, setAreaH] = useState(0); // measured height of the board area → tall canvas
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
  // rack must fit 7 tiles + 6 gaps(6) + rack padding(2×8) + dock padding(2×10)
  // inside the screen, or the tiles run off the edges. Cap so it isn't huge.
  const rackSize = Math.min(Math.floor((Math.min(width, 600) - 72) / 7), 50);

  // The board renders into a canvas as TALL as the board area, so pinch-zoom can
  // grow the board into the space above/below (not just the square footprint).
  // The board sits centred in that canvas; hit-testing uses the same layout.
  const size = boardWidth(cell);
  const canvasH = areaH > size ? areaH : size;
  const boardLayout = { cx: size / 2, cy: canvasH / 2, ox: 0, oy: (canvasH - size) / 2 };

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
  // outline the FULL word(s) — pv.cells includes pre-existing committed letters,
  // not just the tiles placed this turn.
  const validSet = validNow ? new Set((pv.cells || []).map((c) => key(c.row, c.col))) : null;

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

  // ---- drag & drop + zoom/pan (one PanResponder over the Skia board) ----
  const boardBoxRef = useRef(null);
  const screenRef = useRef(null);
  const dragXY = useRef(new Animated.ValueXY()).current;
  const dragState = useRef({ moved: false, rect: null, off: { x: 0, y: 0 } }).current;
  const [dragTile, setDragTile] = useState(null);
  const pans = useRef({}).current;
  // Live-state snapshot read by the once-created PanResponders (which capture a
  // stale render's closure). Mirror of the `hRef` pattern below: refreshed every
  // render so the responders always see current turn/draft/cell/layout.
  const latest = useRef({});
  latest.current = { isPlayer, busy, swapMode, cell, draft, layout: boardLayout };

  // Live board zoom/pan. `view` drives the Skia render; `viewRef` is the
  // synchronous source of truth read during a gesture and by hit-testing, so
  // what you see and what you touch never diverge (the old bug shot tiles to
  // random cells because it hit-tested against a stale transform object).
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const applyView = useCallback((v) => { viewRef.current = v; setView(v); }, []);

  // ease the board back to rest (identity) after a pan/pinch that ended near 1x
  const easeToRest = useCallback(() => {
    if (reduced) { applyView({ scale: 1, tx: 0, ty: 0 }); return; }
    const from = { ...viewRef.current };
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / 180);
      const e = 1 - Math.pow(1 - p, 3);
      applyView({ scale: from.scale + (1 - from.scale) * e, tx: from.tx * (1 - e), ty: from.ty * (1 - e) });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [reduced, applyView]);

  // is (row,col) blocked for this drag? a committed tile, or another draft tile —
  // never the dragged tile's own current cell (so it can be dropped back in place).
  const occupiedFor = (exceptId) => (row, col) =>
    !!game.state.board[row][col].tile ||
    latest.current.draft.some((d) => d.row === row && d.col === col && d.tile.id !== exceptId);

  // Drop resolution is pure + unit-tested (decideDrop): zoom/pan-aware screen→cell
  // hit-test + the place/move/recall/none rulebook (incl. the snap to a near slot).
  function handleDrop(tile, px, py) {
    const from = latest.current.draft.some((d) => d.tile.id === tile.id) ? 'board' : 'rack';
    const decision = decideDrop({
      from, point: { x: px, y: py }, cell: latest.current.cell,
      rect: dragState.rect, transform: viewRef.current, isOccupied: occupiedFor(tile.id),
      layout: latest.current.layout,
    });
    switch (decision.action) {
      case 'place': placeTile(tile, decision.row, decision.col); break;   // handles the blank picker
      case 'move':
        setDraft((d) => d.map((x) => (x.tile.id === tile.id ? { ...x, row: decision.row, col: decision.col } : x)));
        H.tapMedium(); break;
      case 'recall': setDraft((d) => d.filter((x) => x.tile.id !== tile.id)); H.tapLight(); break;
      default: break;   // 'none' — rack tile bounces back, board tile stays put
    }
  }

  // keep the board box's window rect + screen origin fresh (measured on layout and
  // re-measured on each gesture). We DON'T null the rect first: the board never
  // moves, so the last measurement stays valid and is available synchronously for
  // a fast tap (whose async re-measure wouldn't resolve before release).
  const measureForDrag = () => {
    screenRef.current?.measureInWindow((x, y) => (dragState.off = { x, y }));
    boardBoxRef.current?.measureInWindow((x, y, w, h) => { if (w) dragState.rect = { x, y, w, h }; });
  };

  // handlers that read live state, reached from the once-created responders below
  // through a ref so they never see a stale render's closure.
  const hRef = useRef({});
  hRef.current = { onCellPress, onDraftPress, handleDrop, easeToRest };

  // rack tiles keep their own responder: drag onto the board, or tap to select.
  function panFor(tile) {
    if (pans[tile.id]) return pans[tile.id];
    const canGrab = () => { const L = latest.current; return L.isPlayer && !L.busy && !L.swapMode; };
    pans[tile.id] = PanResponder.create({
      onStartShouldSetPanResponder: canGrab,
      onMoveShouldSetPanResponder: canGrab,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { dragState.moved = false; measureForDrag(); },
      onPanResponderMove: (e, g) => {
        if (!dragState.moved && Math.hypot(g.dx, g.dy) > 8) { dragState.moved = true; clearHint(); H.tapLight(); setDragTile(tile); }
        if (dragState.moved) dragXY.setValue({ x: e.nativeEvent.pageX - dragState.off.x, y: e.nativeEvent.pageY - dragState.off.y });
      },
      onPanResponderRelease: (e) => {
        if (!dragState.moved) { onTilePress(tile); return; }
        setDragTile(null); hRef.current.handleDrop(tile, e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderTerminate: () => { setDragTile(null); dragState.moved = false; },
    });
    return pans[tile.id];
  }

  // one responder over the whole Skia board: pinch-zoom, pan-when-zoomed, drag a
  // placed tile, tap an empty cell to place, tap a placed tile to recall.
  const gstate = useRef({}).current;
  const twoFinger = (t) => {
    const a = t[0], b = t[1];
    return { dist: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY), mid: { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 } };
  };
  const startPinch = (t) => {
    const v = viewRef.current, f = twoFinger(t);
    gstate.mode = 'pinch';
    gstate.start = { scale: v.scale, tx: v.tx, ty: v.ty, dist: f.dist, mid: f.mid };
  };
  const boardPan = useRef(
    PanResponder.create({
      // capture at the box BEFORE the Skia Canvas child can claim the touch —
      // otherwise taps/board-drags never reach this responder.
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        measureForDrag();
        const t = e.nativeEvent.touches;
        if (t.length >= 2) { startPinch(t); return; }
        const L = latest.current;
        const c = L.cell, sz = boardWidth(c);
        const ne = e.nativeEvent;
        // hit-test from window coords + the measured board rect (same proven path as
        // the drop); fall back to view-local coords if the rect isn't ready yet.
        const canvasH = L.layout ? L.layout.cy * 2 : sz;
        const hit = dragState.rect
          ? cellAtScreen(ne.pageX, ne.pageY, c, dragState.rect, viewRef.current, L.layout)
          : cellAtScreen(ne.locationX, ne.locationY, c, { x: 0, y: 0, w: sz, h: canvasH }, viewRef.current, L.layout);
        const dTile = hit && L.draft.find((d) => d.row === hit.row && d.col === hit.col);
        const canGrab = L.isPlayer && !L.busy && !L.swapMode;
        if (dTile && canGrab) {
          gstate.mode = 'tile'; gstate.tile = dTile.tile; gstate.moved = false; gstate.cell = hit;
        } else {
          gstate.mode = 'board'; gstate.moved = false; gstate.start = { ...viewRef.current };
          gstate.canPan = viewRef.current.scale > 1.02; gstate.tapCell = hit;
        }
      },
      onPanResponderMove: (e, g) => {
        const t = e.nativeEvent.touches;
        const sz = boardWidth(latest.current.cell);
        if (t.length >= 2) {
          if (gstate.mode !== 'pinch') startPinch(t);
          applyView(pinchView(gstate.start, twoFinger(t), sz));
          return;
        }
        if (gstate.mode === 'tile') {
          if (!gstate.moved && Math.hypot(g.dx, g.dy) > 8) { gstate.moved = true; clearHint(); H.tapLight(); setDragTile(gstate.tile); }
          if (gstate.moved) dragXY.setValue({ x: e.nativeEvent.pageX - dragState.off.x, y: e.nativeEvent.pageY - dragState.off.y });
        } else if (gstate.mode === 'board') {
          if (Math.hypot(g.dx, g.dy) > 6) gstate.moved = true;
          if (gstate.canPan) applyView(panView(gstate.start, g.dx, g.dy, sz));
        }
      },
      onPanResponderRelease: (e) => {
        if (gstate.mode === 'tile') {
          if (!gstate.moved) hRef.current.onDraftPress(gstate.cell.row, gstate.cell.col);
          else { setDragTile(null); hRef.current.handleDrop(gstate.tile, e.nativeEvent.pageX, e.nativeEvent.pageY); }
        } else if (gstate.mode === 'board') {
          if (!gstate.moved && gstate.tapCell) hRef.current.onCellPress(gstate.tapCell.row, gstate.tapCell.col);
          else if (viewRef.current.scale <= 1.05) hRef.current.easeToRest();
        } else if (gstate.mode === 'pinch') {
          if (viewRef.current.scale <= 1.05) hRef.current.easeToRest();
        }
        gstate.mode = null;
      },
      onPanResponderTerminate: () => { setDragTile(null); gstate.mode = null; },
    })
  ).current;

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

      {/* board — Skia (crisp at any zoom); one responder handles all interaction.
          The canvas is as tall as this area so zoom grows the board into the space
          above/below, not just the square footprint. */}
      <View style={styles.boardArea} onLayout={(e) => setAreaH(Math.round(e.nativeEvent.layout.height))}>
        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <View ref={boardBoxRef} collapsable={false} accessible testID="board-box" onLayout={measureForDrag}
            {...boardPan.panHandlers}
            style={{ width: size, height: canvasH }}>
            <SkiaBoard board={game.state.board} draft={draft} hint={hint} validSet={validSet}
              cell={cell} theme={theme} view={view} dragId={dragId} rev={rev} canvasHeight={canvasH} />
          </View>
        </Animated.View>
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
