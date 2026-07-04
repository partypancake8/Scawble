// ZoomableBoard.js — pinch-to-zoom + pan for the board, using built-in
// PanResponder + Animated (no extra deps, works in Expo Go). Single taps pass
// through to the cells (tap-to-place); two fingers pinch; one finger pans when
// zoomed. The board zooms inside a fixed square so the rest of the UI stays put.
import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder } from 'react-native';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function ZoomableBoard({ children, size, maxScale = 3, transformRef }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const cur = useRef({ scale: 1, tx: 0, ty: 0 }).current;   // live values
  const start = useRef({ scale: 1, tx: 0, ty: 0, dist: 0 }).current; // gesture start

  useEffect(() => {
    const push = () => { if (transformRef) transformRef.current = { scale: cur.scale, tx: cur.tx, ty: cur.ty }; };
    const s = scale.addListener(({ value }) => { cur.scale = value; push(); });
    const x = tx.addListener(({ value }) => { cur.tx = value; push(); });
    const y = ty.addListener(({ value }) => { cur.ty = value; push(); });
    return () => { scale.removeListener(s); tx.removeListener(x); ty.removeListener(y); };
  }, []);

  const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const mid = (t) => ({ x: (t[0].pageX + t[1].pageX) / 2, y: (t[0].pageY + t[1].pageY) / 2 });
  const panLimit = (v, s) => clamp(v, -(size * (s - 1)) / 2, (size * (s - 1)) / 2);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // let taps reach the cells
      onMoveShouldSetPanResponder: (e, g) => {
        const t = e.nativeEvent.touches;
        if (t.length >= 2) return true; // pinch
        return cur.scale > 1.02 && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6); // pan when zoomed
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        start.scale = cur.scale; start.tx = cur.tx; start.ty = cur.ty;
        const t = e.nativeEvent.touches;
        start.dist = t.length >= 2 ? dist(t) : 0;
        if (t.length >= 2) { const m = mid(t); start.mx = m.x; start.my = m.y; }
      },
      onPanResponderMove: (e, g) => {
        const t = e.nativeEvent.touches;
        if (t.length >= 2 && start.dist > 0) {
          // zoom from finger spread AND pan by how the two-finger midpoint moves
          const s = clamp((start.scale * dist(t)) / start.dist, 1, maxScale);
          const m = mid(t);
          scale.setValue(s);
          tx.setValue(panLimit(start.tx + (m.x - start.mx), s));
          ty.setValue(panLimit(start.ty + (m.y - start.my), s));
        } else if (cur.scale > 1.02) {
          tx.setValue(panLimit(start.tx + g.dx, cur.scale));
          ty.setValue(panLimit(start.ty + g.dy, cur.scale));
        }
      },
      onPanResponderRelease: () => {
        if (cur.scale <= 1.05) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 4 }),
            Animated.spring(tx, { toValue: 0, useNativeDriver: false, bounciness: 4 }),
            Animated.spring(ty, { toValue: 0, useNativeDriver: false, bounciness: 4 }),
          ]).start();
        }
      },
    })
  ).current;

  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} {...responder.panHandlers}>
      <Animated.View style={{ transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
        {children}
      </Animated.View>
    </View>
  );
}
