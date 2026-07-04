# Shipping Scawble to TestFlight

Everything below is staged and ready. This is the exact sequence for when your
**Apple Developer Program** enrollment is approved (you'll get an email from Apple).

## Already done
- App identity: name **Scawble**, bundle id **`com.scawble.app`**, version 1.0.0
- App icon (cream tile on coral) + splash installed
- `eas.json` build profiles + `eas-cli` installed
- `expo-doctor`: 21/21 checks pass
- SDK pinned to 56 (stable); JS validated (full game plays, identical scores, 0 errors)

## What you need
1. **Apple Developer Program** — approved (in progress).
2. **A free Expo account** — make one now at https://expo.dev/signup (30 seconds).
   Nothing else to buy; EAS Build's free tier is enough for a beta.

## The build (≈30 min, mostly waiting on the cloud build)
Run from `apps/native/`. You'll hit two interactive logins — that's expected.

```bash
eas login                       # your Expo account
eas build:configure             # one-time: links the project, writes projectId

eas build -p ios --profile production
#   → EAS asks to log into your APPLE account (Apple ID + app-specific password
#     or 2FA). It then auto-creates the signing certificate + provisioning
#     profile for you. Build runs in the cloud (~15-30 min; may queue on free tier).

eas submit -p ios --latest
#   → uploads the finished build to App Store Connect / TestFlight. If no app
#     record exists yet, it offers to create "Scawble" for you. Apple then
#     "processes" the build (~5-15 min).
```

## Install on your iPhone
1. Install **TestFlight** from the App Store (this is the real distribution app —
   not Expo Go).
2. In **App Store Connect → Apps → Scawble → TestFlight**, add yourself under
   *Internal Testing* (uses your Apple ID email).
3. Open TestFlight on the phone → Scawble appears → **Install** → play. No cable,
   no Wi-Fi-to-Mac, no SDK juggling. The build lasts 90 days.

## Notes
- App-specific password: create at https://account.apple.com → Sign-In & Security
  → App-Specific Passwords, if EAS asks for one instead of interactive 2FA.
- Bumping a new build later: just re-run the two `eas build` / `eas submit` lines;
  `autoIncrement` bumps the build number automatically.
- **Use EAS cloud, not a local build.** This Mac has **Xcode 26**, which is newer
  than Expo SDK 56's native code supports — a local `expo run:ios` / `eas build
  --local` fails on Swift errors in `expo-modules-jsi` (`weak let` / `Sendable`).
  EAS's cloud builders use a Xcode matched to SDK 56, so `eas build` (no `--local`)
  is unaffected. Expo Go is also unaffected (it ships a prebuilt runtime).
