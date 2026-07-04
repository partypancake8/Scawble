# Validating the native app

How to prove a change to the iOS app actually works, in the order you should do it.
Web and the simulator are necessary but **not sufficient** — the real iPhone is the
source of truth (see the device-only bug classes at the bottom). Nothing here needs a
paid Apple account or a custom dev build.

## 1. Pure logic — `npm test` (repo root)

The board's drop/zoom/melt math and all engine/AI rules are pure and unit-tested. The
`src/board/` modules are re-copied into `apps/native/src/core/board/`, so the same
suite covers the native interaction math.

```bash
cd <repo-root> && npm test        # 33 engine + 16 AI + 78 board-interaction assertions
```
Extend these for any new logic — extract pure functions and test them **before/with**
the UI. UI-only "it renders" checks have repeatedly hidden device bugs.

**Not yet covered by unit tests** (validated via §3–§5 / device, or simply pending —
good next targets since they're pure and deterministic):
- **ScawBot review math** — `controller.js` `review()` (Strategy % / Luck %). Only
  exercised indirectly by the web `npm run smoke`; no dedicated assertions.
- **Daily seed** — `daily.js` `seedForDate` (date → `daily-YYYY-MM-DD`). No test imports it.
- **Sound** (`apps/prototype/sound.js`) and **app-level feel** (drag/render/animation
  timing, haptics) — judged on device, not in tests.

## 2. Bundle check — catches import/resolve errors offline

```bash
cd apps/native
npx expo export --platform ios    # fails loudly on a bad import, missing dep, etc.
```
Fast, no device. Run it after adding/removing deps or moving files.

## 3. Web render (react-native-web + Playwright) — layout/render only

```bash
cd apps/native
npx expo start --web --port 8090          # serves react-native-web
# then drive with Playwright (chromium, channel: 'chrome'); screenshot + assert layout
```
Good for catching render/layout regressions quickly. **Does NOT** exercise real touch,
iOS transform rasterization (zoom blur), gesture timing, or the accessibility tree — do
not sign off on interaction from web alone.

## 4. iOS Simulator via `idb` — the real iOS runtime

Expo Go for SDK 54 is not downloadable through the Expo CLI in every environment; grab
it from GitHub and install it directly:

```bash
# boot a sim + open Simulator.app
xcrun simctl boot <SIM_UDID>; open -a Simulator
# install Expo Go 54 (matches our SDK pin)
curl -L -o /tmp/expo-go-54.tar.gz \
  https://github.com/expo/expo-go-releases/releases/download/Expo-Go-54.0.7/Expo-Go-54.0.7.tar.gz
mkdir -p /tmp/expo-go-54 && tar -xzf /tmp/expo-go-54.tar.gz -C /tmp/expo-go-54
cp -R /tmp/expo-go-54 "/tmp/ExpoGo.app"            # the tarball payload IS the .app
xcrun simctl install <SIM_UDID> "/tmp/ExpoGo.app"  # bundle id: host.exp.Exponent

# start Metro, then open the project in Expo Go on the sim
cd apps/native && npx expo start --port 8088
xcrun simctl openurl <SIM_UDID> "exp://127.0.0.1:8088"
```

Drive the UI and capture screenshots with `idb` (fb-idb) + `simctl`:

```bash
idb ui describe-all --udid <SIM_UDID>     # a11y tree: testIDs (AXUniqueId), labels, frames
idb ui tap   --udid <SIM_UDID> <x> <y>    # coords are POINTS (screenshot px ÷ device scale)
idb ui swipe --udid <SIM_UDID> <x1> <y1> <x2> <y2> --duration 0.7   # a drag
xcrun simctl io <SIM_UDID> screenshot out.png
```

Notes that cost time to (re)learn:
- The **board is a single Skia canvas** — its cells are NOT accessibility nodes, so you
  can't `tap` a `cell-r-c` testID. Tap by **pixel/point coordinates** computed from the
  `board-box` frame (`idb ui describe-all` gives its x/y/w/h) + the geometry in
  `src/core/board/geometry.js`. `<Game key={seed}>` remounts on a new game, which is how
  you pick up a code change (Fast Refresh keeps `useRef`-held responders stale).
- Two-finger **pinch** isn't scriptable via idb; the zoom math is unit-tested instead,
  and Skia is crisp-at-scale by construction.
- The sim's Expo Go SDK must match ours (54). The user's real device is on 54 too.

## 5. The real iPhone (iPhone 16 Pro) — source of truth

```bash
cd apps/native && npx expo start --tunnel   # scan the QR in Expo Go (SDK 54)
```
Confirm on-device: pinch-zoom feel/60fps + crispness, drag (rack + placed tiles),
tap-to-place, melt, and no jank. Never claim "it works" from web/sim alone.

## Device-only bug classes web/sim miss (already hit — see CLAUDE.md)
- Touch coordinates / hit-testing under zoom+pan.
- iOS **transform rasterization** → zoom blur (why the board is Skia, not an RN View).
- `Button` `transform: undefined` → native validation crash on press.
- `Sheet` `accessible` Pressables collapsing children out of the a11y tree.
- Skia `Canvas` swallowing touches (needs `pointerEvents="none"` + capture handlers).
- Reanimated/worklets JS-vs-native version skew inside Expo Go.
