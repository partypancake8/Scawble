// daily.js — deterministic seed for the day's puzzle (PRD §07).
// Same date => same seed => identical board + tile draw for everyone.
export function seedForDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `daily-${y}-${m}-${d}`;
}
