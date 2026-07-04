# Phase 5 — Native iOS Port (scoping)

> ⚠️ **SUPERSEDED — historical planning doc.** The native port is **done**
> (`apps/native/`). What actually shipped differs from this plan in several places,
> so **treat this as history, not current guidance**. Key divergences:
> - **Gestures use the built-in `PanResponder`, NOT `react-native-gesture-handler`**
>   (which is not a dependency). `react-native-reanimated` + `react-native-worklets`
>   are present only because Skia's on-screen renderer requires them.
> - **The dictionary is inlined as `src/lexicon-data.js`**, not loaded via
>   `expo-asset`/`expo-file-system` from `enable1.txt`.
> - **Sound is not implemented** (`expo-audio` not installed); haptics stand in.
> - `controller.js` / `daily.js` live in **`apps/native/src/core/`** (copied), and the
>   repo-root `src/` was left unchanged (this plan suggested moving them into `src/`).
> - Pinned to **Expo SDK 54** (this doc predates that decision).
>
> **Current source of truth: [`../CLAUDE.md`](../CLAUDE.md)** (architecture + the Skia
> rebuild), [`../apps/native/README.md`](../apps/native/README.md), and
> [`RULES.md`](RULES.md). The section below is the original scoping map.

Target stack (per `docs/PRD.html` §04): **Expo + React Native + `@shopify/react-native-skia` + `react-native-reanimated` + `react-native-gesture-handler`**, with `expo-haptics`, `expo-audio`, `expo-font`, and `@react-native-async-storage/async-storage`.

The whole point of the architecture holds up: **`src/` is pure and moves over untouched.** Everything web-specific lives in `apps/prototype/` and gets rewritten against the same headless API. This doc is the map for that rewrite.

---

## 1. What ports as-is vs. what gets rewritten

I re-read every file to confirm portability. Result:

| File | Browser deps? | Phase-5 action |
|---|---|---|
| `src/engine/*` (tiles, board, score, rules, state) | none | **copy unchanged** |
| `src/ai/*` (generate, bot) | none | **copy unchanged** |
| `src/lexicon/lexicon.js` | none | **copy unchanged** |
| `apps/prototype/controller.js` | none (no DOM) | **copy ~unchanged** → `src/controller.js` |
| `apps/prototype/daily.js` | `new Date()` only (fine in RN) | **copy unchanged** |
| `apps/prototype/sound.js` | WebAudio + `navigator.vibrate` | **rewrite** → `expo-audio` + `expo-haptics` |
| `apps/prototype/app.js` (453 lines) | DOM, pointer events, CSS anims | **rewrite** as the native view layer |
| `apps/prototype/style.css` / `fonts.css` | CSS | **re-express** as RN styles + design tokens |
| `apps/prototype/enable1.txt` (172,823 words, 1.8 MB) | fetched at runtime | **bundle as an asset**, load with `expo-asset` |

Verified: nothing in `src/` imports the DOM, `window`, or `document`. The "keep `src/` unchanged" promise is real.

**Recommendation:** move `controller.js` + `daily.js` into `src/` during the port so the entire portable core lives in one tree the native app imports. (They only sit under `apps/prototype/` today for the web build.)

---

## 2. The API the native view must target

The view never touches the engine directly — it talks to the `createGame()` API in `controller.js`. This is the contract to build the UI against (all synchronous, all pure data):

```
const game = createGame(words, { seed, difficulty })

game.state            // { board[15][15]{premium,tile}, racks{player,bot},
                      //   scores{player,bot}, turn, history[], bag[], over,
                      //   finalCountdown, seed }
game.preview(pls)     // dry-run → { ok, score, words[], isBingo } | { ok:false, error }
game.commit(pls)      // player move → { ok, error?, move? }   (records analysis)
game.playerBest()     // best move now (powers Hint)
game.playerMoves()    // all legal moves (highlights)
game.pass() / game.swap(tiles)
game.botTurn()        // runs the bot → move record | null (passed)
game.review()         // end-of-game { strategy, luck, turns[], bestPlay, biggestMiss }
```

A `placement` is `{ tile, row, col }`; blanks carry `tile.assigned`. That's the entire surface — the native UI is "render `game.state`, collect placements, call `commit`."

---

## 3. Web → Native translation table

| Web mechanism (`app.js`/`sound.js`) | Native replacement |
|---|---|
| `document.getElementById` DOM tree | React component tree (function components + hooks) |
| 15×15 `.cell` divs + tile divs | **Skia `Canvas`**: board, premiums, committed tiles drawn as Skia nodes |
| Pointer-event drag (`startDrag`) | `react-native-gesture-handler` `PanGesture` + Reanimated shared values |
| Tap-to-place (`onCellClick`) | `TapGesture` → hit-test cell from canvas coords |
| CSS `@keyframes` (`.snap`, `.land`, `.shake`, count-up, confetti `burst`) | **Reanimated worklets** on the UI thread (60fps); confetti via animated Skia particles |
| `sfx.*` WebAudio blips | `expo-audio` (pre-baked sound files, or a tiny synth via `expo-audio` buffers) |
| `haptic()` → `navigator.vibrate` | `expo-haptics` (`impactAsync`, `notificationAsync`) |
| `localStorage` (settings, stats) | `@react-native-async-storage/async-storage` (or MMKV for speed) |
| `matchMedia('prefers-reduced-motion')` | `AccessibilityInfo.isReduceMotionEnabled()` |
| Fredoka via `@font-face` data-URI | `expo-font` (`useFonts`) with the `.ttf`/`woff2` in assets |
| `fetch('./enable1.txt')` | `expo-asset` → `expo-file-system` `readAsStringAsync`, then `split('\n')` |
| CSS pastel tokens (`style.css`) | a `theme.ts` tokens module (light/dark), consumed by Skia + RN styles |

---

## 4. Screens (five, matching the web app)

Reuse `react-navigation` (native-stack) or a simple state switch like the web `showScreen()`:

1. **Home / Daily** — wordmark, difficulty tiers, "Play today's puzzle" (`seedForDate`) + "Classic", streak line.
2. **Game / Board** — top HUD (scores, last move, bag count), Skia board, rack, controls (Shuffle/Recall/Hint/Swap/Pass/Submit), swap bar.
3. **Analysis** — ScawBot review from `game.review()` (Strategy %, Luck %, per-turn best-you-missed list).
4. **Settings** — sound/haptics/motion/theme/difficulty (same toggles as web).
5. **Overlays** — blank-letter picker sheet, move-log sheet.

---

## 5. Milestones

| # | Milestone | Deliverable | Size |
|---|---|---|---|
| **M0** | Bootstrap | `npx create-expo-app`, add Skia/Reanimated/gesture-handler, drop in `src/` unchanged, one "engine smoke" screen that runs `createGame` + a bot turn on-device to prove the core works. | S |
| **M1** | Static render | Skia board with premium squares + center star, rack of 7, HUD, theme tokens (light/dark). No interaction. | M |
| **M2** | Placement | Drag + tap-to-place, blank picker, live `preview` feedback + score badge, Submit → `commit`. | L |
| **M3** | Bot + juice | `botTurn` flow, tile-land / score-count-up / bingo-burst / shake via Reanimated. | M |
| **M4** | Full flow | Home/Daily, Analysis, Settings, move log, swap-select; AsyncStorage for settings + stats/streak. | M |
| **M5** | Feel + perf | Haptics, sound, reduced-motion; profile Skia frame budget + on-device dictionary/trie build time. | M |
| **M6** | Ship | App icon/splash, EAS build, TestFlight. (P2: resume game, share card, definitions.) | M |

The portable core (engine/AI/lexicon/controller) is done, so this is mostly
mechanical view work against the API in §2 — a working build is a short task. No
calendar estimate here on purpose; the only parts that can balloon are M2 (does
the drag feel right) and M5 (how much of the CSS juice you reproduce). Measure,
don't guess.

---

## 6. Risks & unknowns (measure early)

- **Skia + gesture coordination for the dragged tile.** Main architectural call (see §7). Prototype in M2 before committing.
- **On-device dictionary load.** 1.8 MB text → `Set` + trie builds in ~160 ms on desktop; measure on a real iPhone in M0. If slow, precompute a **packed GADDAG/DAWG** asset (PRD §08 already anticipates this) and load that instead of building at boot.
- **Bot latency.** 15–40 ms desktop; expect maybe 2–4× on device. The web app already masks bot "thinking" with a 480 ms delay, so this is comfortable — but confirm "Brutal" (currently == Expert) stays snappy.
- **Reanimated worklet rules.** Engine calls can't run in worklets; keep game logic on the JS thread and only drive *visual* values on the UI thread. Straightforward but easy to trip on.
- **`expo-av` is deprecated** in favor of `expo-audio`/`expo-video` — use `expo-audio`.

---

## 7. Decisions to lock before/at M0

1. **Expo (managed)** vs bare RN — *recommend Expo managed*: Skia/Reanimated/Haptics/Font/Asset are all first-class, and EAS handles the TestFlight build without local Xcode fiddling (you still need a Mac + Apple dev account).
2. **Keep `src/` as JS** vs convert to TS — *recommend keep JS* (it's the tested core; the JSDoc typedefs already give editor types). Add a `tsconfig` with `checkJs` if you want type coverage without a rewrite.
3. **Rendering split** — *recommend*: static board (grid, premiums, committed tiles) drawn in **one Skia `Canvas`**; the rack + currently-dragging tile as **Reanimated-driven** nodes for buttery drag. Validate in M2.
4. **Storage** — AsyncStorage (simple, enough here) vs MMKV (faster). *Recommend AsyncStorage* for v1.

---

## 8. Day-1 bootstrap (M0)

```bash
npx create-expo-app scawble-native --template blank
cd scawble-native
npx expo install @shopify/react-native-skia react-native-reanimated \
  react-native-gesture-handler expo-haptics expo-audio expo-font expo-asset expo-file-system \
  @react-native-async-storage/async-storage
# add reanimated plugin to babel.config.js
cp -r ../Scawble/src ./src
cp ../Scawble/apps/prototype/{controller.js,daily.js} ./src/
cp ../Scawble/apps/prototype/enable1.txt ./assets/
```

Then a throwaway `<EngineSmoke/>` screen: `createGame(words,{seed:'test'})`, run `botTurn()` a few times, render `game.state.scores` — if that shows real scores on the simulator, the entire portable core is proven and M1 (rendering) is pure view work.

---

*Companion to `HANDOFF.md`. The engine/AI/lexicon are done and test-verified (49 unit tests + headless DOM smoke, all green); Phase 5 is view-layer + platform-glue work against the API in §2.*
