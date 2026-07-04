# Scawble — native (Expo / React Native)

The iOS build (Phase 5). It reuses the **exact portable core** from `../../src`
(engine, AI, lexicon) plus `controller.js` + `daily.js` — copied unchanged into
`src/core/`. Only the view layer is new. The same code runs on iOS and (for
headless validation) on the web via react-native-web.

## Run it

```bash
cd apps/native
npm install
npx expo start            # scan the QR with Expo Go on an iPhone (same Wi-Fi)
npx expo start --web      # run in a browser (react-native-web) — used for CI-style checks
```

No custom native modules, so it runs in **Expo Go** — no Xcode needed to play it.
An App Store build later uses EAS (`eas build -p ios`).

> **SDK is pinned to Expo 56** (the latest *stable*). `create-expo-app@latest`
> defaults to SDK 57, which is a pre-release (`next`/`canary` npm tag) that the
> App Store Expo Go does **not** support yet — scanning gives "project is
> incompatible with this version of Expo Go." Verified: SDK 56 loads in current
> Expo Go on a real iOS 26 simulator. Don't bump to 57 until it ships to Expo Go.

## Layout

```
App.js               root: fonts + dictionary + settings, screen routing, theme
src/core/            the portable game logic, copied from repo /src (do not fork — re-copy on change)
src/lexicon-data.js  the ENABLE word list inlined as a JS module (generated from prototype/enable1.txt)
src/theme.js         Soft & Cute design tokens (ported 1:1 from prototype/style.css)
src/storage.js       AsyncStorage: settings + stats/streak
src/haptics.js       expo-haptics wrapper (honors the Haptics setting)
src/ui/              Tile · Board · Rack · Button · Sheet · AnimatedNumber
src/screens/         Home · Game · Analysis · Settings
```

## Parity

Interaction is **tap-to-place** (tap a rack tile, tap a cell; tap a placed tile to
recall) — the web app's tap mode. The full 5-screen flow, blank picker, hint,
swap, pass, move log, live preview, and ScawBot analysis all match the web build.

Validated two ways, both reaching the **same final score as the offline engine**
(334–294 on 2026-07-03), zero console errors:
- **Web** (react-native-web) driven headlessly via Playwright.
- **Real iOS**: a full 15-move game (incl. a blank tile) driven on the iPhone 17
  Pro simulator via `idb` taps through Expo Go — the actual iOS runtime.

The iOS playthrough caught two **iOS-only** bugs that web testing missed (both fixed):
1. `Button` emitted `transform: undefined`, which iOS's native transform validation
   rejects → render crash on any button press. (`src/ui/Button.js`)
2. `Sheet`'s `Pressable` wrappers collapsed their children in the accessibility tree,
   making the blank picker / move-log letters invisible to VoiceOver and to UI
   automation. Fixed with `accessible={false}`. (`src/ui/Sheet.js`)

## Not yet ported (polish backlog)

- Drag-to-place (Reanimated + gesture-handler) — tap-to-place covers gameplay today.
- Bingo confetti burst + floating "+score" chip (web has these; count-up, tile
  pop-in, and invalid-shake are in).
- Sound — the web app's WebAudio blips don't port directly; haptics stand in.
  Add via `expo-audio` with baked tones later.
