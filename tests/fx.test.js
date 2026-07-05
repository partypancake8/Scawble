// fx.test.js — zero-dependency tests for the celebration FX math (confetti + settle).
// Run: `node tests/fx.test.js`

import { confettiBurst, stepParticles, particleAlpha, allDead, makeRng } from '../src/fx/confetti.js';
import { settleScale, settleDone, SETTLE_MS } from '../src/fx/settle.js';

let passed = 0, failed = 0; const fails = [];
const ok = (c, m) => (c ? passed++ : (failed++, fails.push(m)));
const near = (a, b, eps, m) => ok(Math.abs(a - b) <= eps, `${m}: |${a} - ${b}| > ${eps}`);

// --- confetti ---
const burst = confettiBurst(100, 200, { count: 26, seed: 7 });
ok(burst.length === 26, 'burst spawns requested count');
ok(burst.every((p) => p.x === 100 && p.y === 200), 'all particles start at the origin');
ok(burst.every((p) => p.ttl > 0 && p.size > 0), 'particles have positive ttl + size');

// deterministic: same seed => identical first particle
const a = confettiBurst(0, 0, { seed: 42 })[0];
const b = confettiBurst(0, 0, { seed: 42 })[0];
ok(JSON.stringify(a) === JSON.stringify(b), 'same seed => identical burst');
const c = confettiBurst(0, 0, { seed: 43 })[0];
ok(JSON.stringify(a) !== JSON.stringify(c), 'different seed => different burst');

// most particles fan upward at spawn (vy < 0 = up in screen space)
ok(burst.filter((p) => p.vy < 0).length >= burst.length * 0.6, 'burst mostly fans upward');

// gravity pulls particles down over time
const p = confettiBurst(0, 0, { count: 1, seed: 3 })[0];
const before = p.vy;
stepParticles([p], 0.2);
ok(p.vy > before, 'gravity increases downward velocity');
ok(p.life > 0, 'stepping ages particle life');

// alpha fades: full early, zero once dead
const fresh = { life: 0, ttl: 1 };
const mid = { life: 0.5, ttl: 1 };
const late = { life: 0.9, ttl: 1 };
ok(particleAlpha(fresh) === 1, 'fresh particle is opaque');
ok(particleAlpha(mid) === 1, 'particle opaque before 70% life');
ok(particleAlpha(late) < 1 && particleAlpha(late) > 0, 'particle fades in its last 30%');
ok(particleAlpha({ life: 1, ttl: 1 }) === 0, 'dead particle is transparent');

// allDead once every particle outlives ttl
const two = confettiBurst(0, 0, { count: 5, seed: 1 });
ok(!allDead(two), 'fresh burst is not all dead');
for (let i = 0; i < 200; i++) stepParticles(two, 0.05);
ok(allDead(two), 'burst dies out after enough time');

// rng in [0,1)
const rng = makeRng(99);
let inRange = true;
for (let i = 0; i < 100; i++) { const v = rng(); if (v < 0 || v >= 1) inRange = false; }
ok(inRange, 'makeRng stays in [0,1)');

// --- settle (lands enlarged, eases to rest; stays >= 1 the whole time) ---
near(settleScale(0), 1.12, 1e-9, 'settle starts at `from` (a touch over 1)');
ok(settleScale(SETTLE_MS) === 1, 'settle ends exactly at 1');
ok(settleScale(SETTLE_MS + 50) === 1, 'settle clamps to 1 after the window');
ok(settleScale(-10) === 1.12, 'settle clamps to `from` before start');
// monotonically eases DOWN from `from` toward 1, never dipping below 1
let prev = settleScale(0), monotonic = true, everBelow1 = false;
for (let t = 1; t <= SETTLE_MS; t += 1) {
  const v = settleScale(t);
  if (v > prev + 1e-9) monotonic = false;
  if (v < 1 - 1e-9) everBelow1 = true;
  prev = v;
}
ok(monotonic, 'settle eases down monotonically');
ok(!everBelow1, 'settle never dips below 1 (overlay always covers its footprint)');
ok(settleScale(SETTLE_MS * 0.5) < settleScale(0), 'settle shrinks from its start toward rest');
ok(settleScale(30, { from: 1.3 }) > 1 && settleScale(30, { from: 1.3 }) <= 1.3, 'custom `from` respected');
ok(!settleDone(SETTLE_MS - 1) && settleDone(SETTLE_MS), 'settleDone flips at the window end');

console.log(`\nScawble fx tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log(fails.join('\n')); process.exit(1); }
