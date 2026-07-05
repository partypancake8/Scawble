// confetti.js — deterministic particle burst for celebrations (e.g. a bingo).
// PURE and dependency-free: this module owns only the physics. The renderer
// (a Skia overlay) reads the particle array each frame and draws it. Because a
// seeded RNG drives the spawn, a burst is fully reproducible in tests.

const TAU = Math.PI * 2;

// mulberry32 — tiny seeded PRNG so bursts are deterministic (same seed => same burst).
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Soft & Cute palette (pulled from the theme accents) for the confetti pieces.
export const CONFETTI_COLORS = ['#FF8A80', '#FFD54F', '#81C784', '#64B5F6', '#BA68C8', '#4DB6AC'];

/**
 * Spawn a burst of `count` particles at (x, y). Each particle carries position,
 * velocity, rotation/spin, colour, size and a time-to-live. Velocities fan out
 * mostly upward (so pieces arc up then fall). Deterministic for a given `seed`.
 */
export function confettiBurst(x, y, { count = 26, speed = 340, spread = TAU * 0.55, seed = 1, colors = CONFETTI_COLORS } = {}) {
  const rng = makeRng(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (rng() - 0.5) * spread; // -PI/2 = straight up
    const v = speed * (0.45 + rng() * 0.9);
    parts.push({
      x, y,
      vx: Math.cos(ang) * v,
      vy: Math.sin(ang) * v,
      rot: rng() * TAU,
      spin: (rng() - 0.5) * 14,
      color: colors[Math.floor(rng() * colors.length)],
      size: 6 + rng() * 7,
      life: 0,
      ttl: 1.05 + rng() * 0.55,
    });
  }
  return parts;
}

/**
 * Advance every particle by `dt` seconds under gravity + air drag, aging `life`.
 * Mutates and returns the same array. Pure given (parts, dt, opts).
 */
export function stepParticles(parts, dt, { gravity = 950, drag = 1.4 } = {}) {
  for (const p of parts) {
    p.vx -= p.vx * drag * dt;
    p.vy += gravity * dt - p.vy * drag * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.life += dt;
  }
  return parts;
}

// Opacity for a particle: fully opaque until 70% of its life, then fades to 0.
export function particleAlpha(p) {
  const t = p.life / p.ttl;
  if (t >= 1) return 0;
  return t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
}

// True once every particle has outlived its ttl (so the overlay can unmount).
export function allDead(parts) {
  return parts.every((p) => p.life >= p.ttl);
}
