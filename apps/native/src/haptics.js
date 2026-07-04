// haptics.js — thin wrapper over expo-haptics that honors the user's setting.
// No-op on web (expo-haptics is a no-op there) and never throws.
import * as Haptics from 'expo-haptics';

let enabled = true;
export function setHaptics(on) { enabled = on; }

export function tapLight() { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
export function tapMedium() { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }
export function success() { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
export function warn() { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); }
