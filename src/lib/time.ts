/**
 * Human readable timestamps for persisted epoch-millisecond fields.
 *
 * Firestore stores `createdAtMs` / `updatedAtMs` (server clock, sortable);
 * the domain types expose a display string, exactly like the rest of the
 * campus UI. The conversion lives here so no adapter, service or page has
 * to invent its own date formatting.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'Just now';
  const delta = Date.now() - ms;
  if (delta < MINUTE) return 'Just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Absolute date for surfaces that never show relative copy (audit rows). */
export function absoluteDate(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return 'Just now';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
