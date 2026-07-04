# Scawble

A single-player tile word game built to match the polish of **NYT Crossplay**
(with the broader NYT Games craft bar as the secondary reference). Solo vs. bot,
a daily puzzle, and a CrossBot-style post-game analysis. No live multiplayer in v1.

**Full spec:** [`docs/PRD.html`](docs/PRD.html) — open in a browser. It's the
executable build brief (design tokens, interaction timings, data models,
definition-of-done, and the phased build loop).

## Stack decision
- **Web prototype first** (zero-build ES modules) to validate feel cheaply.
- Then port to **React Native + Skia + Reanimated** for the iOS build.
- Engine + AI are portable TypeScript/JS and move between both unchanged.

## Layout
```
src/engine/   pure game logic (tiles, board, scoring, rules, state) — zero deps
src/lexicon/  swappable word source (ENABLE public-domain list)
src/feel/     interaction primitives (drag, springs, haptics, sound) — later
tests/        zero-dependency engine tests
apps/prototype/  web prototype (later)
docs/PRD.html    the spec
```

## Rules (Scawble = Crossplay-flavored)
- 15×15 board, 100 tiles, 7-tile rack, 50-pt bingo bonus.
- **Rebalanced tile values** (our own IP): common consonants N/R/S/T = 1pt,
  K/V/W/Y = 5pt. See `src/engine/tiles.js`.
- **Fair endgame:** when the bag empties, both sides get an equal number of
  final turns (Crossplay's "last turn" rule), then leftover racks are deducted.

## Play
Easiest — open the self-contained build in any browser (no server needed):
```
apps/prototype/scawble.html      # double-click it, or: xdg-open apps/prototype/scawble.html
npm run build                    # regenerate scawble.html from source
```
Or run the dev version from a server (serve from THIS repo root so the
`../../src/...` module imports resolve):
```bash
npm run serve     # needs Python 3
# then open http://localhost:8080/apps/prototype/
```
Node was installed locally at `~/.local/bin`.

## Verify
```bash
npm test          # 33 engine + 16 AI tests (pure logic)
npm run smoke     # boots the whole UI in a headless DOM, plays turns, checks for errors
```

## Build status
- [x] **Phase 1** — engine + lexicon. *33 tests green.*
- [x] **Phase 2** — trie move generator + 4 bot difficulty tiers + `bestMove`. *16 tests green.*
- [x] **Phase 3** — web feel prototype: drag/snap/squash tiles, sound, haptics,
      score count-up, bingo burst, reduced-motion. *DOM smoke green.*
- [x] **Phase 4 (web)** — five-screen flow: Home/Daily, Board, Analysis (ScawBot
      Strategy/Luck review), Stats/streak, difficulty select. Full game playable vs. bot.
- [ ] **Phase 5** — native port (React Native + Skia) and iOS/TestFlight.
      *Requires a Mac + Xcode — not buildable on this Linux box.*

### v2 pass — Soft & Cute + P1 (done)
Redesigned to a rounded pastel look (embedded Fredoka font, soft tiles, pastel
premiums) and added all P1 features: last-move-per-player HUD, move log, blank-tile
picker, hint, tap-to-place, settings screen (sound/haptics/motion/theme/difficulty),
and select-tiles-to-swap. Spec: `docs/PRD-v2.html`. Verified via `npm run smoke`.

The full playable single-player game exists as the **web prototype** above. The
move generator uses a trie (the un-optimized DAWG); swap for a packed GADDAG when
speed matters. Full ENABLE dictionary (172,823 words) builds in ~160ms; bot moves
in 15–40ms.
