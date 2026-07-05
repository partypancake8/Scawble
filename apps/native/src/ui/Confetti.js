// Confetti.js — a full-screen Skia overlay that plays a celebratory particle
// burst (e.g. on a bingo). The physics live in the pure, unit-tested core
// (core/fx/confetti.js); this component only drives the clock and draws.
//
// `trigger` is a number that changes each time you want a new burst (pass a
// counter/timestamp). When it changes we spawn a fresh burst from (x, y) and
// run a rAF loop until every particle has died, then call onDone.
import React, { useEffect, useRef, useState } from 'react';
import { Canvas, Group, RoundedRect } from '@shopify/react-native-skia';
import { confettiBurst, stepParticles, particleAlpha, allDead } from '../core/fx/confetti.js';

export default function Confetti({ trigger, x, y, width, height, count = 34, onDone }) {
  const [parts, setParts] = useState(null);
  const raf = useRef(null);
  const last = useRef(0);

  useEffect(() => {
    if (!trigger) return undefined;
    const p = confettiBurst(x, y, { count, seed: (trigger % 100000) + 1, speed: 380, spread: Math.PI * 1.2 });
    last.current = Date.now();
    setParts(p.slice());
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.048, (now - last.current) / 1000);
      last.current = now;
      stepParticles(p, dt);
      setParts(p.slice());
      if (allDead(p)) { setParts(null); onDone && onDone(); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!parts) return null;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {parts.map((p, i) => (
        <Group key={i} origin={{ x: p.x, y: p.y }} transform={[{ rotate: p.rot }]} opacity={particleAlpha(p)}>
          <RoundedRect x={p.x - p.size / 2} y={p.y - p.size * 0.3} width={p.size} height={p.size * 0.6} r={p.size * 0.18} color={p.color} />
        </Group>
      ))}
    </Canvas>
  );
}
