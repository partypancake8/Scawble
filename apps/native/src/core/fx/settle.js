// settle.js — the "settle" a word does the moment it commits: it lands slightly
// enlarged and eases down to its resting size. PURE so the curve is unit-tested;
// SkiaBoard draws the just-committed word as an overlay scaled by settleScale()
// around the word's centre. The scale stays >= 1 for the whole window, so the
// overlay always fully covers its resting footprint (no gap peeks through).

export const SETTLE_MS = 280;

/**
 * Scale factor at `elapsedMs` into the settle: eases from `from` (a touch over 1)
 * down to exactly 1. Clamped: `from` at/before 0, exactly 1 at/after `duration`.
 * Monotonic and always >= 1.
 */
export function settleScale(elapsedMs, { duration = SETTLE_MS, from = 1.12 } = {}) {
  if (elapsedMs <= 0) return from;
  if (elapsedMs >= duration) return 1;
  const t = elapsedMs / duration;
  const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic, 0..1
  return from + (1 - from) * ease;      // from -> 1
}

// True once the settle window has elapsed (so the board can drop the overlay).
export function settleDone(elapsedMs, duration = SETTLE_MS) {
  return elapsedMs >= duration;
}
