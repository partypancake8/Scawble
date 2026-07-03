# Scawble — Handover

Everything you need to pick this up on a Mac and keep going. Read this top to
bottom once; it's the map.

---

## TL;DR

**Scawble** is a single-player tile word game — a Scrabble-like built to match the
polish of **NYT Crossplay** (with the broader NYT Games craft as the secondary
reference). It's **fully playable today as a web app**: you vs. a bot, a daily
puzzle, live word validation, and a post-game "ScawBot" review. The engine and AI
are done and test-verified. What's *not* done is the **native iOS build** (needs a
Mac + Xcode — that's why this is being handed to you).

- **Just want to play it?** Open `apps/prototype/scawble.html` in any browser. No
  server, no install — the whole game (172k-word dictionary + font) is inlined.
- **Want to develop?** See "Run from source" below.

---

## Current status

| Area | State |
|---|---|
| Game engine (rules, scoring, fair-endgame) | ✅ Done · 28 unit tests |
| AI (move generator + 4 difficulty tiers + best-move) | ✅ Done · 16 unit tests |
| Dictionary (full ENABLE, 172,823 words) | ✅ Done · builds ~160ms, bot moves 15–40ms |
| Web game (5 screens, drag+tap, juice, analysis) | ✅ Done · headless DOM smoke passes |
| Soft & Cute visual redesign + all "P1" features | ✅ Done (v2 pass) |
| **Native iOS (React Native + Skia)** | ⛔ **Not started** — your job on the Mac |

**P1 features shipped:** last-move-per-player HUD, move log, blank-tile picker,
hint, tap-to-place, settings screen (sound/haptics/motion/theme/difficulty),
select-tiles-to-swap.

---

## Play it right now

Double-click **`apps/prototype/scawble.html`** (or `open apps/prototype/scawble.html`
on macOS). Pick a difficulty, play the daily, build words off the center ✦.
Sound/haptics start on your first tile tap.

---

## Run from source (Mac setup)

Prereqs: **Node 18+** and **Python 3** (both ship with / are trivial to install on
macOS — `brew install node` if needed).

```bash
cd scawble
npm install          # dev deps only: esbuild (bundler) + linkedom (headless DOM test)

npm test             # engine + AI unit tests (pure logic, no browser)
npm run smoke        # boots the whole UI in a headless DOM and drives turns
npm run build        # regenerate apps/prototype/scawble.html (the standalone)
npm run serve        # static server on :8080 — open http://localhost:8080/apps/prototype/
```

> Serve from the **repo root** (that's what `npm run serve` does). The dev app uses
> native ES-module imports like `../../src/engine/state.js`, which only resolve when
> the server root is the project root.

There is **no build step for development** — the app is plain ES modules the browser
loads directly. `npm run build` only exists to produce the single-file standalone.

Fonts: `npm run build` reads `apps/prototype/fonts.css` (Fredoka, pre-embedded as
data-URIs). To regenerate it from the woff2 files: `node scripts/embed-fonts.mjs`.

---

## Repo map

```
scawble/
├─ HANDOFF.md              ← you are here
├─ README.md               quick reference
├─ docs/
│  ├─ PRD.html             v1 spec — the executable build brief (engine→AI→feel→ship)
│  └─ PRD-v2.html          v2 spec — Soft & Cute redesign + P1 features
├─ src/                    PORTABLE game logic (pure JS, zero deps) — reuse in RN as-is
│  ├─ engine/  tiles · board · score · rules · state
│  ├─ ai/      generate (trie move-gen) · bot (tiers, bestMove)
│  └─ lexicon/ lexicon (Set lookup) + starter list
├─ apps/prototype/         the WEB app (view layer)
│  ├─ index.html  style.css  fonts.css
│  ├─ app.js       DOM + interaction (drag, tap, juice, screens)
│  ├─ controller.js  headless orchestration (state + AI + analysis)
│  ├─ daily.js     date→seed
│  ├─ sound.js     WebAudio SFX
│  ├─ enable1.txt  the dictionary
│  └─ scawble.html THE STANDALONE (generated; everything inlined)
├─ tests/          engine.test.js · ai.test.js · dom-smoke.mjs
└─ scripts/        build-standalone.mjs · embed-fonts.mjs
```

**The key architectural idea:** everything in `src/` is pure, dependency-free
JavaScript with no DOM and no framework. It runs identically in the browser and in
React Native. Only `apps/prototype/` is web-specific. When you build the native app,
you **keep `src/` unchanged** and write a new native view layer against the same
`controller.js`-style API.

---

## How it's built (decisions worth knowing)

- **Rules = Crossplay-flavored, not tournament Scrabble.** Tile *values* are
  rebalanced (common consonants N/R/S/T = 1pt, K/V/W/Y = 5pt) — this is our own IP
  and legally distances us from Scrabble. Counts stay at the standard 100 tiles.
  **Fair endgame:** when the bag empties, both sides get an equal number of final
  turns (Crossplay's rule), then leftover racks are deducted. See `src/engine/`.
- **Dictionary = ENABLE (public domain).** Official lists (NWL/Collins) are licensed
  and enforced. The lexicon is a swappable module (`src/lexicon/`) — a licensed list
  can drop in behind the same `isWord()` API later.
- **AI = trie-guided move generation** (Appel–Jacobson style), then every candidate
  is re-checked against the tested engine, so the bot *cannot* make an illegal move.
  A trie is the un-optimized DAWG; swap for a packed **GADDAG** if you need more
  speed on device (it's already fast enough — 15–40ms). Difficulty tiers reach
  different depths of the ranked move list. "Brutal" currently == Expert (no 2-ply
  simulation yet — a P2 item).
- **Determinism:** the bag is seeded (`makeBag(seed)`), so the daily puzzle is
  identical for everyone and replayable. Bot RNG is seeded too.
- **Standalone build:** `scripts/build-standalone.mjs` uses esbuild to bundle
  `app.js` into one IIFE, inlines the CSS + fonts, and embeds the word list on
  `window.SCAWBLE_ENABLE` — producing a single self-contained HTML that runs from
  `file://`.

---

## Testing

- `npm test` — 44 pure-logic tests (scoring incl. cross-words/premiums/bingo/blanks,
  validation, fair-endgame; move-gen legality, bestMove, difficulty tiers).
- `npm run smoke` — boots the real UI in linkedom (headless DOM) and drives a game +
  every P1 surface (tap-to-place, hint, settings, move log), asserting zero runtime
  errors. This caught a real init-order bug during development.
- What tests **can't** cover: the actual *feel* (animation timing, haptics) — judge
  that in a real browser / on device.

---

## What's next

### Phase 5 — the native iOS app (your main task)
Per `docs/PRD.html` the target stack is **React Native + `@shopify/react-native-skia`
+ Reanimated**. Plan:
1. `npx create-expo-app` (or bare RN). Add `src/` unchanged (it's already portable JS/TS-ready).
2. Port `controller.js` (it has no DOM — nearly copy-paste).
3. Build the five screens natively; render tiles/board with Skia, animate with
   Reanimated worklets (60fps on the UI thread). The interaction spec (durations,
   easings, haptics) is literal in `docs/PRD.html` §04.
4. Real haptics via `expo-haptics`; sound via `expo-av`.
5. TestFlight.

### P2 backlog (nice-to-haves, not blockers)
- Resume an in-progress game (persist state to storage)
- Wordle-style share card + a "par" score on the daily
- A real stats screen (distribution/history, not just the streak line)
- Definitions on tap (Wiktionary — open licence)
- Implement "Brutal" as Expert + 2-ply simulation (Quackle-style)
- Richer sound design (current SFX are synthesized blips)
- First-run onboarding

### Full recommendations
The complete audit (P0/P1/P2) lives in the chat history that produced this repo; the
two PRDs in `docs/` capture the specs and acceptance criteria.

---

## Gotchas / notes

- On the Linux box this was built on, Node was installed locally at `~/.local/bin`
  (no sudo). On your Mac just use a normal Node install.
- `node_modules/` is **not** in this zip — run `npm install`. (The Linux esbuild
  binary wouldn't work on macOS anyway.)
- This was never git-committed. On the Mac: `git init && git add -A && git commit -m
  "Scawble handover"` to start clean history.
- "Scrabble" is a Hasbro/Mattel trademark — keep the name **Scawble**, keep our own
  tile palette/values, ship the public-domain word list. (Details in the PRDs.)
