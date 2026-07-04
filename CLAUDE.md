# CLAUDE.md — Scawble

Read this every session. It is the operating manual for building Scawble.

Scawble is a single-player tile word game (Scrabble-*esque*, but our own game and IP)
being built to be **the greatest word-tile game app ever made**. A web prototype
exists; the active build is a **native iOS app** (Expo / React Native) in `apps/native/`.

**Read `docs/NORTH-STAR.md` before any product/design decision.** It defines the vision
and the quality bar.

---

## 🔴 Non-negotiable principles (no exceptions)

1. **Always TDD.** Extract logic into pure, dependency-free functions and unit-test them
   (Node, no DOM/UI) *before or alongside* implementation. Add to `npm test`. UI-only or
   web-only "it renders" checks are NOT sufficient and have repeatedly hidden device bugs.
   TDD is not a tradeoff we weigh — we do it unless the downside is genuinely significant.

2. **Never trade quality for simplicity.** If something could be better, build the better
   thing even if it's harder or more complex. "Too complicated" is not a valid reason to
   ship something mediocre. Complexity in service of the experience is always worth it.
   The current bar: would this be okayed for a best-in-class App Store game? If not, redo it.

3. **The device is the source of truth.** Chrome (react-native-web) and the iOS Simulator
   miss device-only bugs — touch coordinates, iOS transform/text rasterization (zoom blur),
   accessibility-tree collapse, gesture timing. Validate pure logic with tests, then confirm
   on the real iPhone (the user tests on an **iPhone 16 Pro**). Never claim "it works" from a
   web/sim proxy alone.

4. **Feel is paramount.** 60fps, crisp rendering, physical-feeling gestures, smooth
   transitions, satisfying juice. No blur, no jank, no jarring screen cuts.

---

## Architecture

- **`src/`** — portable, pure, **zero-dependency** game logic. Runs identically in web + RN.
  Has 49 unit tests. NEVER add UI/DOM/RN deps here.
  - `src/engine/` — tiles · board · score · rules · state (Crossplay-flavored rules, rebalanced tile values, fair endgame)
  - `src/ai/` — generate (trie move generator) · bot (4 difficulty tiers, bestMove)
  - `src/lexicon/` — swappable word source (ENABLE, 172,823 words)
- **`apps/prototype/`** — original web app (reference implementation of every feature).
- **`apps/native/`** — the iOS app (Expo/RN). Reuses `src/` **unchanged**, copied to
  `apps/native/src/core/` (re-copy on change; don't fork the core).
  - `src/screens/` — Home · Game · Analysis · Settings
  - `src/ui/` — Tile · Board · Rack · Button · Sheet · Icon · ZoomableBoard · AnimatedNumber
  - `src/core/` — the copied portable core
  - `src/lexicon-data.js` — ENABLE list inlined (~1.9MB)
  - `src/theme.js` — Soft & Cute design tokens (ported from prototype `style.css`)

## What's built (native app)
5 screens, tap-to-place, drag-and-drop (rack tiles + placed tiles), pinch-zoom + pan,
live score pill, bottom-docked controls, Ionicons icon system (`src/ui/Icon.js`), screen
transitions, haptics, blank picker, hint, swap, move log, ScawBot analysis. Playable on
device via Expo Go.

## 🚧 Active / next major work (do these TDD)
1. **Rebuild the board in Skia** (`@shopify/react-native-skia`). The RN-View board cannot
   zoom crisply — iOS rasterizes transforms → blur (a supersample attempt made it worse and
   broke drop coordinates via a failed `transformOrigin`). Skia renders vector/GPU → crisp at
   any zoom, makes all board interaction **pure coordinate math** (fully unit-testable, no
   Pressable soup), and makes the tile merge/melt effect natural. This is the approved bigger
   change. Structure: pure `screen→cell` hit-test + `drop-decision` modules in `src/core/`
   (or a tested `src/board/` util), exhaustively unit-tested, then a thin Skia view on top.
2. **Tile merge/melt** — adjacent tiles in a word close the gap, round only outer corners,
   with a "settle" animation → one continuous soft pill. Committed words merge too.
3. Keep hardening drag/placement with device confirmation.

## SDK / Expo Go (important)
Pinned to **Expo SDK 54** (`apps/native/package.json`). Modern Expo Go runs exactly ONE SDK;
the user's Expo Go is on SDK 54, and `create-expo-app@latest` pulls SDK 57 (a `next`/`canary`
tag shipping Expo Go rejects). Don't bump the SDK unless the target runtime supports it.
Skia / Reanimated / gesture-handler ship inside Expo Go — usable without a custom dev build
(verify per SDK).

## How to run / test
- `npm test` (repo root) — 49 pure-logic engine/AI tests. **Extend this for all new logic.**
- Native: `cd apps/native && npx expo start --tunnel` → scan with Expo Go (works over any network).
- Web validation (logic/render only — NOT touch/blur): `npx expo start --web` + Playwright
  (harness lives in the session scratchpad).
- iOS Simulator: drivable end-to-end via `idb` (fb-idb). Note: sim's Expo Go SDK may differ from device.

## Device-only bugs we've already hit (why web isn't enough)
- `Button` emitting `transform: undefined` → iOS render crash on button press.
- `Sheet` Pressable wrappers collapsing children out of the accessibility tree (VoiceOver + automation).
- `transformOrigin` supersample failing on iOS → worse blur + misplaced drops (Chrome hid it).

## Delivery
- Dev: Expo Go via tunnel.
- Proper: **TestFlight** — staged in `apps/native/TESTFLIGHT.md`, gated on the user's Apple
  Developer Program approval. Build via EAS cloud (local build blocked by Xcode 26 vs SDK Swift skew).
