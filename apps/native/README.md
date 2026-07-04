# Scawble — native (Expo / React Native)

The iOS build — the **active** build of Scawble. It reuses the **exact portable
core** from `../../src` (engine, AI, lexicon, board math) plus `controller.js` +
`daily.js` — copied unchanged into `src/core/`. Only the view layer is new. The
same code runs on iOS and (for headless render checks) on the web via
react-native-web.

> Read the repo-root **`../../CLAUDE.md`** first — it's the operating manual
> (principles, architecture, the Skia rebuild, device-only bugs). The game rules
> are in **`../../docs/RULES.md`**.

## Run it

```bash
cd apps/native
npm install
npx expo start --tunnel   # scan the QR with Expo Go (SDK 54) on an iPhone — any network
npx expo start --web      # react-native-web in a browser — render checks only, NOT touch/blur
```

Everything the app uses (**Skia**, **reanimated** + **worklets**, gesture handling
via built-in `PanResponder`, **safe-area-context**, haptics, AsyncStorage) ships
inside **Expo Go** — no Xcode and no custom dev build needed to play it. An App
Store build later uses EAS (`eas build -p ios`); see `TESTFLIGHT.md`.

> **SDK is pinned to Expo 54** (`package.json`), because **Expo Go runs exactly ONE
> SDK** and the target device's Expo Go is on SDK 54. `create-expo-app@latest`
> pulls a newer SDK (a `next`/`canary` npm tag) that the App Store Expo Go rejects
> with "project is incompatible with this version of Expo Go." Don't bump the SDK
> unless the target runtime supports it. Use the **SDK 54** Expo docs.
> Skia's on-screen renderer runs a reanimated worklet, so `react-native-reanimated`
> (~4.1) + `react-native-worklets` (**0.5.1**, matching Expo Go's native side) are
> REQUIRED even though we don't use reanimated directly. `babel-preset-expo` v54
> auto-adds the worklets Babel plugin — do NOT add a `babel.config.js` for it.

## Layout

```
App.js               root: fonts + dictionary + settings, screen routing, theme, safe-area
src/core/            the portable game logic, copied from repo /src (do not fork — re-copy on change)
                       incl. core/board/{geometry,interaction}.js (tested drop/zoom/melt math)
src/lexicon-data.js  the ENABLE word list inlined as a JS module (generated from prototype/enable1.txt)
src/theme.js         Soft & Cute design tokens (ported 1:1 from prototype/style.css)
src/storage.js       AsyncStorage: settings + stats/streak
src/haptics.js       expo-haptics wrapper (honors the Haptics setting)
src/ui/              Tile · SkiaBoard · Rack · Button · Sheet · Icon · AnimatedNumber
src/screens/         Home · Game · Analysis · Settings
```

The board is **`SkiaBoard.js`** (vector/GPU). The old RN-View `Board.js` /
`ZoomableBoard.js` were deleted — iOS rasterizes RN View transforms into a blur
when zoomed, whereas Skia re-draws the vector scene crisp at any scale.

## Interaction

Full **drag-and-drop** (drag a rack tile onto the board, drag a placed tile to a new
cell, drag off-board to recall) **and tap-to-place** (tap a rack tile, tap a cell;
tap a placed tile to recall), plus **pinch-zoom + pan** (the board grows into the
space above/below when zoomed) and the **tile merge/melt** (a word renders as one
continuous pill). All of it runs through the pure, unit-tested math in
`src/core/board/` (`cellAtScreen`, `decideDrop`, `pinchView`/`panView`, `melt`).

The full 5-screen flow, blank picker, hint, swap, pass, move log, live score
preview, and ScawBot analysis all match the web build.

## How it's validated

**Full reproducible flow (commands): [`VALIDATION.md`](VALIDATION.md).** In short:
pure logic is covered by the repo-root **`npm test`** (the `src/board/` modules are
re-copied into `src/core/board/`, so the same tests cover the native drop/zoom/melt
math — 78 board assertions). Then the running app is confirmed:
- **Web** (react-native-web) driven headlessly via Playwright — render/layout only.
- **iOS Simulator** driven via `idb` through Expo Go — the real iOS runtime: render,
  tap-to-place, drag, melt, zoom, the commit→ScawBot loop. Reached the **same final
  score as the offline engine** (334–294 replay), zero console errors.
- **The real iPhone (iPhone 16 Pro)** — the source of truth; web/sim miss touch,
  transform-rasterization blur, gesture timing, and accessibility-tree bugs.

**iOS-only bugs caught here that web testing missed** (all fixed — keep the fixes):
1. `Button` emitted `transform: undefined`, which iOS's native transform validation
   rejects → render crash on button press. (`src/ui/Button.js`)
2. `Sheet`'s `Pressable` wrappers collapsed their children in the accessibility tree,
   hiding the blank picker / move-log letters from VoiceOver + automation. Fixed with
   `accessible={false}`. (`src/ui/Sheet.js`)
3. The Skia `Canvas` swallowed touches; the board responder needs
   `pointerEvents="none"` on the Canvas + capture handlers or drag/tap never reach it.
   (`src/ui/SkiaBoard.js` + `src/screens/Game.js`)

There is no `apps/native`-local test script — native game logic is validated by the
**root** `npm test` (run it from the repo root). To catch import/bundling errors
offline: `npx expo export --platform ios`.

## Backlog (polish)

- Merge/melt "settle" animation (tiles springing together as a word forms).
- Board **VoiceOver** cells — the Skia canvas has no per-cell accessibility nodes yet.
- Bingo confetti burst + floating "+score" chip (count-up, tile pop-in, invalid-shake
  are in).
- Sound — the web app's WebAudio blips don't port directly; haptics stand in. Add via
  an Expo audio module with baked tones later.
