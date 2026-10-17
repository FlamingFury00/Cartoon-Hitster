// The scripted cards of the interactive tutorial (components/screens/Tutorial.svelte): a short
// game against "Bruno" built from famous themes whose years tell a clear story.
import { validSlotRange, type YearOf } from './game/timeline';

export const TUTORIAL = {
  /** Your first card: Occhi di gatto (1985). */
  start: '100',
  /** Guided: Ufo Robot (1978) goes above it. */
  first: '002',
  /** On your own: Canzone dei Puffi (1982) goes in between. */
  second: '050',
  /** Bruno's cards: Ken il guerriero (1987) and Dragon Ball (1999)... */
  rival: ['109', '214'],
  /** ...and the card he puts after Dragon Ball: Sailor Moon (1995), which you can steal. */
  steal: '197',
  rivalSlot: 2,
} as const;

export const YOU = { avatar: '😎', color: '#ffd23f' };
export const BRUNO = { name: 'Bruno', avatar: '🐶', color: '#2bc4ff' };

/** True if `id` placed at `slot` of `timeline` is in chronological order. */
export function rightSlot(timeline: readonly string[], id: string, slot: number, yearOf: YearOf): boolean {
  const [from, to] = validSlotRange([...timeline], yearOf(id), yearOf);
  return slot >= from && slot <= to;
}
