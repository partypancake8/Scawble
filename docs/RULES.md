# Scawble — Rules of Play

The complete, authoritative rules of the game, for players and for anyone (human or
AI) working on the code. Scawble is **Scrabble-*esque* but its own game** — its own
tile economy, palette, name, and public-domain dictionary. If you know crossword tile
games it will feel familiar, but **do not assume standard Scrabble numbers** — the
tile values are rebalanced and the endgame is Scawble's own.

Every rule here is exactly what the code enforces. The "where it lives" table at the
end maps each rule to its source file so this doc and the engine can't drift.

---

## 1. Overview

Scawble is **single-player**: you vs. **ScawBot**. Three ways to play a game:
- **Classic** — a fresh randomly-seeded game.
- **Daily puzzle** — a deterministic board+draw keyed to the date (everyone gets the
  same game that day).
After the game, a **ScawBot review** grades your play (Strategy % and Luck %) and
shows the best move you missed.

You move **first**. Play alternates until the game ends (see §9). Highest score wins.

---

## 2. Components

- **Board:** 15 × 15 grid of cells. Some cells are **premium squares** (§4). The
  center cell (row 7, col 7, 0-indexed) is a **double-word** star and the opening
  word must cross it.
- **Tiles:** **100** total. Each tile is a letter with a point value, plus **2 blanks**
  (see §8). The bag is **seeded and shuffled** — for the Daily, the same date always
  produces the same bag order.
- **Rack:** each side holds **7 tiles**, refilled to 7 from the bag after each move
  (until the bag runs out).
- **Dictionary:** the public-domain **ENABLE** word list (**172,823 words**). It's a
  swappable module — a licensed list could drop in behind the same `isWord()` API.

---

## 3. Tiles — values & distribution (Scawble's rebalance)

Common consonants are cheap (N/R/S/T = 1pt) and K/V/W/Y are expensive (5pt) — this is
Scawble's own tile economy, not tournament Scrabble. Counts total exactly 100.

| Value | Letters (count in bag) |
|------:|------------------------|
| **1** | A×9, E×12, I×9, O×8, U×4, N×6, R×6, S×4, T×6, L×4 |
| **2** | D×4, G×3, C×2, M×2 |
| **3** | B×2, P×2, H×2, F×2 |
| **5** | K×1, V×2, W×2, Y×2 |
| **8** | J×1, X×1 |
| **10**| Q×1, Z×1 |
| **0** | blank × 2 |

Total tiles = **100**. Rack size = **7**. Bingo bonus = **+50** (§7).

---

## 4. Premium squares

Four premium types multiply scoring for tiles **placed this turn** (§7):

| Symbol | Name | Effect |
|--------|------|--------|
| `DL` (2L) | Double Letter | ×2 the value of the tile on it |
| `TL` (3L) | Triple Letter | ×3 the value of the tile on it |
| `DW` (2W) | Double Word | ×2 the whole word's total |
| `TW` (3W) | Triple Word | ×3 the whole word's total |

The **center star** (`★`, cell 7,7) counts as a **Double Word**. The full symmetric
layout (`3`=TW, `2`=DW, `t`=TL, `d`=DL, `*`=center DW, `.`=plain):

```
3 . . d . . . 3 . . . d . . 3
. 2 . . . t . . . t . . . 2 .
. . 2 . . . d . d . . . 2 . .
d . . 2 . . . d . . . 2 . . d
. . . . 2 . . . . . 2 . . . .
. t . . . t . . . t . . . t .
. . d . . . d . d . . . d . .
3 . . d . . . * . . . d . . 3
. . d . . . d . d . . . d . .
. t . . . t . . . t . . . t .
. . . . 2 . . . . . 2 . . . .
d . . 2 . . . d . . . 2 . . d
. . 2 . . . d . d . . . 2 . .
. 2 . . . t . . . t . . . 2 .
3 . . d . . . 3 . . . d . . 3
```

---

## 5. A turn

On your turn you do exactly one of:
1. **Play a word** — place tiles from your rack onto the board (§6), forming valid
   word(s). You score, then refill your rack to 7.
2. **Swap** — exchange some rack tiles for new ones (§8b). Uses your turn, scores 0.
3. **Pass** — do nothing (§8c). Uses your turn, scores 0.

---

## 6. Playing a word — placement rules

A move's placed tiles must satisfy **all** of these, or it's rejected:

1. **On empty cells, on the board.** You can't place on an occupied cell or off-grid,
   and you can't put two tiles on the same cell.
2. **A single line.** All tiles placed this turn lie in **one row or one column**
   (a single tile is treated as horizontal if it has a horizontal neighbour, else
   vertical).
3. **Contiguous — no gaps.** Along that line, the span from your first to last placed
   tile must be completely filled (by your tiles and/or tiles already on the board);
   no holes.
4. **Connected.**
   - **First move of the game:** the word must **cross the center star** (7,7).
   - **Every later move:** at least one newly placed tile must **orthogonally touch a
     tile already on the board** (you build off existing words).
5. **Forms a word.** The placement must create at least one word of **length ≥ 2**.
6. **All words are real.** Every word formed — the main word **and** every cross-word
   (§6a) — must be in the dictionary. If any isn't, the whole move is rejected.

### 6a. Cross-words

When you place tiles, you form:
- the **main word** along your line, and
- a **cross-word** for each placed tile that, together with existing perpendicular
  tiles, makes a run of length ≥ 2.

**Every** word formed is validated and scored (§7). A move can be rejected because a
*cross*-word isn't valid, even if the main word is fine.

---

## 7. Scoring

For **each word** the move forms (main + all cross-words):

1. Sum the point value of every tile in the word.
2. If a tile was **placed this turn** on a **letter premium**, multiply *that tile's*
   value first: `DL` ×2, `TL` ×3.
3. After summing, if any tile placed this turn sits on a **word premium**, multiply
   the whole word total: `DW` ×2, `TW` ×3 (they **stack** — e.g. two double-words = ×4).
4. **Premiums only ever count for tiles placed on this turn.** Re-using a premium
   square under an already-placed tile gives no bonus.
5. **Blanks score 0** (but still complete words and can sit on premiums, contributing
   only the multiplier, not points).

The move's score is the **sum over all its words**. If you place **all 7** of your rack
tiles in one move (a **bingo**), add **+50**.

**Worked example.** Opening move `CAT` across the center with C on a plain cell, A on
the center DW, T plain: (3 + 1 + 1) = 5, then ×2 for the center double-word = **10**.

---

## 8. Blanks, swapping, passing

### 8a. Blanks
There are **2 blank tiles**. A blank can stand for **any letter** (you choose when you
place it) and is worth **0 points**. Its assigned letter is what forms/validates words.

### 8b. Swap (exchange)
Exchange any number of your rack tiles for the same number of fresh tiles from the bag.
- Only allowed if the **bag holds at least as many tiles as you're swapping**.
- The returned tiles are shuffled back deterministically (you won't just redraw them).
- **Uses your turn** and scores 0.

### 8c. Pass
Forfeit your turn (score 0). See §9 for how repeated passes end the game.

---

## 9. Endgame & winning

The game ends in either of these ways:

- **Bag empties, then equal final turns.** The moment the bag runs out, a
  **final countdown** starts: each side gets **one more turn** (2 plies total) and then
  the game ends. This "equal final turns" rule is Scawble's fair endgame — no one is
  cut off mid-round.
- **Four consecutive scoreless turns.** If **4 turns in a row** are passes/swaps
  (counted across both players, and reset to 0 by any scoring move), the game ends
  immediately.

**Final scoring.** When the game ends, **each player's leftover-rack points are
subtracted from their score** (sum of the values of tiles still on their rack). The
player with the **higher final score wins**.

---

## 10. ScawBot (the opponent)

ScawBot generates every legal move for its rack (a trie-guided search), then ranks them
by **score + a "leave value"** heuristic (the strategic worth of the tiles it keeps
back). The **difficulty tier** decides how far down that ranked list it plays:

| Tier | Behaviour |
|------|-----------|
| **Casual** | Plays a middling move — samples the **40th–70th percentile** band of ranked moves (deliberately not the best). |
| **Skilled** | Plays near the top — samples the **top ~15%** of ranked moves. |
| **Expert** | Always plays the **best** ranked move. |
| **Brutal** | Currently identical to Expert (best move); a **2-ply look-ahead** is planned but not yet built. |

Every move ScawBot considers is re-checked against the same rules engine, so **the bot
can never make an illegal move**. If it has no legal move, it passes.

---

## 11. Daily puzzle

The Daily uses a **deterministic seed** derived from the date: `daily-YYYY-MM-DD`. Same
date → same seeded bag → **identical board and tile draws for everyone**, and the game
is exactly replayable.

---

## 12. ScawBot review (post-game)

After the game, ScawBot grades your play:
- **Strategy %** — how close each of your moves came to the best move available at that
  moment (100% = you always found the top play).
- **Luck %** — your share of the total "best available" scoring across the game (a proxy
  for how good your tiles/positions were vs. the bot's).
- **Best move you missed** — the highest-scoring play you had available but didn't make.

---

## Where each rule lives in code (for AI agents & maintainers)

| Rule | Source of truth |
|------|-----------------|
| Tile values & counts, bag total, rack size, bingo bonus, seeded bag | `src/engine/tiles.js` (`VALUE`, `COUNT`, `RACK_SIZE`, `BINGO_BONUS`, `makeBag`) |
| Board size, premium-square layout, center star | `src/engine/board.js` (`LAYOUT`, `premiumAt`, `CENTER`) |
| Scoring, letter/word multipliers, new-tile-only premiums, bingo | `src/engine/score.js` (`scoreWord`, `scoreMove`, `LETTER_MULT`, `WORD_MULT`) |
| Placement legality (single line, no gaps, must-form-word, connectivity, first-move-center), cross-word gathering, dictionary check | `src/engine/rules.js` (`analyze`, `validate`) |
| Turn flow, swap, pass, 4-scoreless-turns end, bag-empty equal-final-turns, leftover-rack deduction, win | `src/engine/state.js` (`applyMove`, `swap`, `pass`, `endPly`, `finishGame`) |
| Blanks (assign letter, score 0) | `src/engine/tiles.js` (`letterOf`), `src/engine/rules.js` |
| Bot move choice + difficulty tiers | `src/ai/bot.js` (`chooseMove`, `DIFFICULTY`, `rankMoves`, `bestMove`) |
| Move generation (legal moves for a rack) | `src/ai/generate.js` (`buildTrie`, `generateMoves`) |
| Daily seed | `src/core/daily.js` / `apps/native/src/core/daily.js` (`seedForDate`) |
| ScawBot review (Strategy/Luck) | `apps/native/src/core/controller.js` / `apps/prototype/controller.js` (`review`) |
| Dictionary | `src/lexicon/lexicon.js`; word list in `apps/prototype/enable1.txt` / `apps/native/src/lexicon-data.js` |

These rules are covered by `tests/engine.test.js` and `tests/ai.test.js` (run `npm test`).
