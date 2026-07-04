# CLAUDE.md — Scawble

Read this every session. It is the operating manual for building Scawble.

Scawble is a single-player tile word game (Scrabble-*esque*, but our own game and IP)
being built to be **the greatest word-tile game app ever made**. A web prototype
exists; the active build is a **native iOS app** (Expo / React Native) in `apps/native/`.

**Read `docs/NORTH-STAR.md` before any product/design decision.** It defines the vision
and the quality bar. **`docs/RULES.md` is the authoritative rules of the game** (tile
values, placement legality, scoring, endgame, bot tiers) — read it before touching game
logic, and keep it in sync with `src/engine/` if a rule ever changes.

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
  33 engine + 16 AI + 78 board-interaction assertions. NEVER add UI/DOM/RN deps here.
  - `src/engine/` — tiles · board · score · rules · state (Crossplay-flavored rules, rebalanced tile values, fair endgame)
  - `src/ai/` — generate (trie move generator) · bot (4 difficulty tiers, bestMove)
  - `src/lexicon/` — swappable word source (ENABLE, 172,823 words)
  - `src/board/` — pure interaction math: `geometry.js` (single-source 15×15 layout) +
    `interaction.js` (zoom/pan-aware screen→cell hit-test + place/move/recall/none drop rules).
    The Skia/RN board is a thin view over this. Exhaustively tested in `tests/board.test.js`.
- **`apps/prototype/`** — original web app (reference implementation of every feature).
- **`apps/native/`** — the iOS app (Expo/RN). Reuses `src/` **unchanged**, copied to
  `apps/native/src/core/` (re-copy on change; don't fork the core).
  - `src/screens/` — Home · Game · Analysis · Settings
  - `src/ui/` — Tile · **SkiaBoard** · Rack · Button · Sheet · Icon · AnimatedNumber
    (the RN-View `Board.js`/`ZoomableBoard.js` were deleted — Skia replaced them)
  - `src/core/` — the copied portable core (incl. `core/board/{geometry,interaction}.js`)
  - `src/lexicon-data.js` — ENABLE list inlined (~1.9MB)
  - `src/theme.js` — Soft & Cute design tokens (ported from prototype `style.css`)

## What's built (native app)
5 screens, tap-to-place, drag-and-drop (rack tiles + placed tiles + board→board), pinch-zoom +
pan (crisp Skia board), tile merge/melt, live score pill, bottom-docked controls, Ionicons icon
system (`src/ui/Icon.js`), screen transitions, haptics, blank picker, hint, swap, move log,
ScawBot analysis. Playable on device via Expo Go — validated end-to-end on the iOS simulator
(render, tap-place, drag, melt, valid outline, commit→bot loop) and on the user's iPhone.

## ✅ Skia board rebuild (DONE) — how it works
- **Pure math** (`src/board/{geometry,interaction}.js`, tested in `tests/board.test.js`,
  78 assertions): `geometry` = single-source 15×15 layout; `interaction` = zoom/pan-aware
  `screen→cell` hit-test, `decideDrop` (place/move/recall/none + snap to a near empty slot),
  and `pinchView`/`panView`/`clampView` transform helpers.
- **`src/ui/SkiaBoard.js`** — pure render from props. Cells/premiums/star/tiles are Skia
  vector shapes inside one `<Group transform origin=center>`; zoom scales the vector scene so
  it stays print-sharp (no rasterization blur). The center star is a drawn path (the `✦` glyph
  isn't in Fredoka). Two design points that took device iteration to get right:
  - **Melt = union of uniform cell squares + `CornerPathEffect`** (`meltUnion` in SkiaBoard).
    Each tile is drawn one pitch wide (cell + GAP) so neighbours overlap → a STEP-FREE orthogonal
    polygon; one `<CornerPathEffect r={cellR}>` at draw time then rounds EVERY corner uniformly —
    convex outer caps AND concave inner "armpits" where words cross (T/plus/L/hole junctions),
    with no seams or fillet hacks. (An earlier hand-rolled per-corner + concave-fillet approach
    left 1px slivers at the GAP/2 steps — this replaced it.) The lip is the same union shifted
    down; the SAME `meltUnion` builds the green valid-word outline, so its junctions round too.
  - **Green outline spans the whole word**, incl. pre-existing committed letters, because it
    uses `preview().cells` (every cell of every word `analyze` reports), not just dropped tiles.
  - **Tall canvas for zoom-fill**: the canvas is as tall as the board area (`canvasHeight`), the
    board is centred in it (offset `oy`), zoom pivots about the canvas centre → the board grows
    into the space above/below on zoom instead of staying a small square. Hit-testing threads a
    `layout {cx,cy,ox,oy}` through `cellAtScreen`/`decideDrop` so touch still maps correctly when
    the canvas ≠ the board (tested in `tests/board.test.js`).
- **`Game.js`** — one `boardPan` PanResponder over the board does pinch/pan/tile-drag/tap-place,
  all through the tested math off the LIVE `view` (fixed the old "shoots to a random spot" bug,
  which was hit-testing a stale transform). Gotchas that cost time (keep them):
  - The Skia `<Canvas>` must be `pointerEvents="none"` AND `boardPan` needs
    `onStart/MoveShouldSetPanResponderCapture: () => true`, or touches never reach the board.
  - `boardPan`/`SkiaBoard` are recreated only on a full mount — `<Game key={seed}>` remounts on
    a new game; Fast Refresh alone keeps the old `useRef` responder.

## 🚧 Next / polish (do these TDD)
1. **Merge/melt "settle" animation** — tiles currently melt instantly; add a spring nudge as a
   word forms (needs animating the Skia face rects; the static melt already ships).
2. **Board accessibility** — the Skia canvas has no per-cell a11y nodes (the old RN Pressables
   did). VoiceOver users can't navigate cells; add an a11y overlay for the App Store bar.
3. **Opening rack should never be all consonants (or all vowels).** `newGame` (`src/engine/state.js`)
   deals 7 tiles straight from the shuffled bag, so you can get a vowel-less rack (e.g. N R L S R C R)
   with no legal opening move. Guarantee ≥1–2 vowels in the initial deal, redrawing deterministically
   so the daily stays reproducible. TDD in `tests/engine.test.js`.
4. Keep hardening pinch-zoom feel on-device (math is tested; confirm 60fps on the iPhone).

## SDK / Expo Go (important)
Pinned to **Expo SDK 54** (`apps/native/package.json`). Modern Expo Go runs exactly ONE SDK;
the user's Expo Go is on SDK 54, and `create-expo-app@latest` pulls a newer SDK (`next`/`canary`
tag) that shipping Expo Go rejects. Don't bump the SDK unless the target runtime supports it.
**`@shopify/react-native-skia` (2.2.12) + `react-native-reanimated` (4.1.7) + `react-native-worklets`
(0.5.1) ship inside Expo Go SDK 54** — no dev build needed. Skia's on-screen renderer runs a
reanimated worklet, so reanimated+worklets are REQUIRED (not optional) even though we don't use
reanimated directly. `babel-preset-expo` v54 auto-adds the worklets Babel plugin — do NOT add a
`babel.config.js` for it (an explicit one fails to resolve `babel-preset-expo` from the root).
Pin worklets to **0.5.1** to match Expo Go's native side (installing gesture-handler drags in a
newer worklets that mismatches). `react-native-safe-area-context` (5.6.x) is also used (real
Dynamic-Island insets in `App.js` — a hardcoded `paddingTop` clips the top on the 16 Pro).
To validate on the sim, Expo Go 54 isn't downloadable via the CLI here — install it from
`github.com/expo/expo-go-releases` (Expo-Go-54.0.7) + `simctl install`.

## How to run / test
**Full reproducible validation flow: `apps/native/VALIDATION.md`.** In short:
- `npm test` (repo root) — pure-logic engine/AI/board tests. **Extend this for all new logic.**
- Native: `cd apps/native && npx expo start --tunnel` → scan with Expo Go (works over any network).
- Bundle check (offline, catches bad imports): `npx expo export --platform ios`.
- Web validation (logic/render only — NOT touch/blur): `npx expo start --web` + Playwright.
- iOS Simulator: drivable end-to-end via `idb` (fb-idb) — install Expo Go 54 from
  `github.com/expo/expo-go-releases` (steps in VALIDATION.md). Sim SDK must match the device (54).

## Device-only bugs we've already hit (why web isn't enough)
- `Button` emitting `transform: undefined` → iOS render crash on button press.
- `Sheet` Pressable wrappers collapsing children out of the accessibility tree (VoiceOver + automation).
- `transformOrigin` supersample failing on iOS → worse blur + misplaced drops (Chrome hid it).

## Delivery
- Dev: Expo Go via tunnel.
- Proper: **TestFlight** — staged in `apps/native/TESTFLIGHT.md`, gated on the user's Apple
  Developer Program approval. Build via EAS cloud (local build blocked by Xcode 26 vs SDK Swift skew).
