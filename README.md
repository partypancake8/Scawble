# Scawble

A single-player **tile word game** — you vs. **ScawBot**, a deterministic daily
puzzle, and a post-game ScawBot review. Scrabble-*esque* but our own game and IP
(rebalanced tile values, our palette, public-domain dictionary).

The active build is a **native iOS app** (Expo / React Native, Skia board). A
**web prototype** is the reference implementation of every feature. Both run on
one **portable, zero-dependency JS core** (engine + AI + lexicon + board math).

> **The vision and the quality bar live in [`docs/NORTH-STAR.md`](docs/NORTH-STAR.md)**
> (build the greatest tile word game ever made — NYT Games is the *floor*).
> **The build manual is [`CLAUDE.md`](CLAUDE.md)** — read it before working here.
> **The rules of the game are [`docs/RULES.md`](docs/RULES.md).**

## Layout
```
src/                 PORTABLE pure-JS core (zero deps) — runs identically web + RN
  engine/   tiles · board · score · rules · state   (rebalanced values, fair endgame)
  ai/       generate (trie move-gen) · bot (4 difficulty tiers, bestMove)
  lexicon/  swappable word source (ENABLE, 172,823 words)
  board/    geometry · interaction (zoom/pan hit-test + drop rules)
tests/               engine.test.js · ai.test.js · board.test.js · dom-smoke.mjs
apps/native/         ← the iOS app (Expo/RN + Skia). Reuses src/ copied to src/core/
apps/prototype/      the web app — reference implementation of every feature
docs/                NORTH-STAR · RULES · PRD.html · PRD-v2.html · PHASE5-NATIVE-PLAN
scripts/             build-standalone.mjs · embed-fonts.mjs
```

## Rules (summary — full text in [`docs/RULES.md`](docs/RULES.md))
- 15×15 board, 100 tiles, 7-tile rack, 2 blanks, 50-pt bingo bonus.
- **Rebalanced tile values** (our IP): common consonants N/R/S/T = 1pt, K/V/W/Y = 5pt
  (`src/engine/tiles.js`).
- **Fair endgame:** when the bag empties both sides get an equal number of final
  turns, then each player's leftover-rack points are deducted; higher score wins.

## Run

**Native iOS app** (the active build):
```bash
cd apps/native
npm install
npx expo start --tunnel      # scan the QR with Expo Go (SDK 54) on your iPhone
npx expo start --web         # react-native-web, for headless render checks
```
It runs in **Expo Go** — no Xcode needed to play. See `apps/native/README.md` for
details and `apps/native/TESTFLIGHT.md` for the App Store path.

**Web prototype** (self-contained, no server):
```bash
open apps/prototype/scawble.html   # double-click it — dictionary + font inlined
npm run build                      # regenerate scawble.html from source
npm run serve                      # dev version on :8080 (serve from repo root)
```

## Test
```bash
npm test          # 33 engine + 16 AI + 78 board-interaction assertions (pure logic)
npm run smoke     # boots the prototype UI in a headless DOM, plays turns, checks errors
```
The native app's board/drop logic is validated by the same `npm test` (the pure
`src/board/` modules), then confirmed on the real iPhone — see `CLAUDE.md`.

## Status
- [x] **Engine + AI + lexicon** — pure core, test-verified (`npm test`).
- [x] **Web prototype** — full 5-screen game vs. bot, daily, ScawBot review, all P1
      features. Reference implementation.
- [x] **Native iOS app** — 5 screens, **Skia board** (crisp zoom), drag-and-drop
      (rack + placed tiles), tile merge/melt, pinch-zoom/pan, haptics. Playable on
      device via Expo Go, validated end-to-end on the iOS simulator + iPhone.
- [ ] **TestFlight** — staged (`apps/native/TESTFLIGHT.md`), gated on Apple Developer
      approval; build via EAS cloud.

Next / backlog: merge "settle" animation, board VoiceOver cells, sound, bingo
confetti, resume-in-progress, share card. See `CLAUDE.md` → "Next / polish".
