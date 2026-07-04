// AnimatedNumber.js — count-up tween for scores (matches the web score roll).
import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

export default function AnimatedNumber({ value, style, animate = true }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef(null);
  useEffect(() => {
    if (!animate || prev.current === value) { setDisplay(value); prev.current = value; return; }
    const from = prev.current, to = value, start = Date.now(), dur = 420;
    cancelAnimationFrame(raf.current);
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / dur);
      setDisplay(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(step); else prev.current = to;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, animate]);
  return <Text style={style}>{display}</Text>;
}
