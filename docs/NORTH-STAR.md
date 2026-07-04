# Scawble — North Star

## The intention, in one line
Build **the greatest tile word game app ever made.** Not "great for a Scrabble clone" — the
best word game on the App Store, period.

> We describe Scawble as "Scrabble-esque" only as shorthand. Scawble is its **own game** with
> its own identity, tile economy, and IP. It is not Scrabble and should never feel like a clone.

## What "greatest" means here

**Feel before features.** A tile word game lives or dies on how it feels to pick up, drag,
and set down a tile. Every gesture must feel *physical* — weighty, responsive, delightful,
60fps, zero blur, zero jank. If any competitor's tile-drag feels better than ours, we have
failed. This is the single most important thing.

**NYT Games is the floor, not the ceiling.** Match the craft of NYT Crossplay / NYT Games,
then exceed it. That level of polish is the *baseline expectation*, not the goal.

**Every screen is designed, not assembled.** No default components, no placeholder spacing,
no "good enough." Considered typography, considered motion, considered color — everywhere.

**Delight lives in the details.** Tiles that melt into a single smooth word. A score that
counts up and lands with a haptic. A board you can pinch into, crisp as print. Celebrations
that feel earned. Transitions that flow — nothing ever hard-cuts or drops onto the screen.

## Design language: Soft & Cute
Rounded, pastel, cozy, warm. Fredoka type. Cream tiles with soft lips and gentle shadows.
Scawble should feel like a friendly daily ritual, not a sterile board simulator. Tokens live
in `apps/native/src/theme.js` (ported from `apps/prototype/style.css`).

## The game (ours, not Scrabble)
- **Our IP:** rebalanced tile values (common consonants N/R/S/T = 1pt; K/V/W/Y = 5pt), our
  own palette, our own name. Public-domain ENABLE dictionary (swappable).
- **Solo-first:** you vs. **ScawBot**, a deterministic **daily puzzle**, and a post-game
  **ScawBot review** (Strategy % + Luck %, best-move-you-missed coaching).
- **Fair endgame:** when the bag empties both sides get equal final turns (Crossplay's rule),
  then leftover racks are deducted.
- **Lean into what's ours:** the cozy solo daily loop, the crafted tactile feel, ScawBot as a
  coach, and tiles that feel *alive* (drag, melt, settle, celebrate).

## How we build (non-negotiable)
1. **Always TDD.** Pure, unit-tested logic before/with implementation. No untested behavior ships.
2. **Never trade quality for simplicity.** Do the harder, better thing. Complexity in service
   of the experience is always justified.
3. **The real device is the truth.** Prove it on the iPhone, not just on web/simulator proxies.

## The bar (apply before calling anything "done")
> Would this make it into a best-in-class, NYT-Games-tier App Store game — the *greatest*
> word game ever shipped? If the honest answer is no, it is not done. Redo it.
