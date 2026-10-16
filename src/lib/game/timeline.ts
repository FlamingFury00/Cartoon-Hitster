// Pure helpers for chronological timelines.
//
// A timeline is an array of song ids sorted by year (ties keep insertion order).
// "Slots" are the gaps where a new card can be inserted: slot i means "before the
// card currently at index i", so a timeline of n cards has slots 0..n.

export type YearOf = (id: string) => number;

/** Inclusive range of slots where a card of `year` is chronologically correct. */
export function validSlotRange(timeline: readonly string[], year: number, yearOf: YearOf): [number, number] {
  let from = 0;
  let to = 0;
  for (const id of timeline) {
    const y = yearOf(id);
    if (y < year) from++;
    if (y <= year) to++;
  }
  return [from, to];
}

export function isValidSlot(timeline: readonly string[], slot: number, year: number, yearOf: YearOf): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot > timeline.length) return false;
  const [from, to] = validSlotRange(timeline, year, yearOf);
  return slot >= from && slot <= to;
}

/** Inserts `id` at a chronologically valid position, preferring `preferredSlot` when valid. */
export function insertSorted(timeline: readonly string[], id: string, yearOf: YearOf, preferredSlot?: number): string[] {
  const year = yearOf(id);
  const [from, to] = validSlotRange(timeline, year, yearOf);
  const slot = preferredSlot != null && preferredSlot >= from && preferredSlot <= to ? preferredSlot : to;
  const out = timeline.slice();
  out.splice(slot, 0, id);
  return out;
}

export function sortTimeline(ids: readonly string[], yearOf: YearOf): string[] {
  return ids
    .map((id, i) => ({ id, i, y: yearOf(id) }))
    .sort((a, b) => a.y - b.y || a.i - b.i)
    .map((x) => x.id);
}

/** Human friendly description of a slot, e.g. "tra il 1985 e il 1989". */
export function describeSlot(timeline: readonly string[], slot: number, yearOf: YearOf): string {
  const n = timeline.length;
  if (n === 0) return 'come prima carta';
  if (slot <= 0) return `prima del ${yearOf(timeline[0])}`;
  if (slot >= n) return `dopo il ${yearOf(timeline[n - 1])}`;
  const a = yearOf(timeline[slot - 1]);
  const b = yearOf(timeline[slot]);
  return a === b ? `nel ${a}` : `tra il ${a} e il ${b}`;
}
