# apps/native — agent notes

**Read the repo-root `CLAUDE.md` and `docs/NORTH-STAR.md` first** — they hold the
principles (always TDD, never trade quality for complexity, device is the source of truth)
and the vision.

## This package
Expo / React Native iOS app. Pinned to **Expo SDK 54** (matches the user's Expo Go — do not
bump without confirming the target runtime supports the new SDK). Reuses the portable core
from the repo root `src/`, copied to `src/core/` (re-copy on change; never fork it).

## Docs to consult for Expo APIs
Use the **SDK 54** docs (https://docs.expo.dev/versions/v54.0.0/), not latest — this project
is intentionally not on the newest SDK. Verify a module ships inside Expo Go before relying
on it in dev (Skia, Reanimated, gesture-handler do).
