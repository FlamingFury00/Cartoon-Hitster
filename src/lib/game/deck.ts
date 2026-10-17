import type { Decade, GameSettings, Song } from './types';

export const DECADES: { value: Decade; label: string; short: string }[] = [
  { value: 1970, label: 'Anni 70', short: '70' },
  { value: 1980, label: 'Anni 80', short: '80' },
  { value: 1990, label: 'Anni 90', short: '90' },
  { value: 2000, label: 'Anni 2000', short: '00' },
  { value: 2010, label: 'Anni 2010', short: '10' },
  { value: 2020, label: 'Anni 2020', short: '20' },
];

export function decadeOf(year: number): Decade {
  const d = Math.floor(year / 10) * 10;
  return Math.min(2020, Math.max(1970, d)) as Decade;
}

/** Tag groups offered as deck filters in the setup screen. */
export const TAG_FILTERS: { tag: string; label: string; emoji: string }[] = [
  { tag: 'cristina', label: "Cristina D'Avena", emoji: '👑' },
  { tag: 'vanni', label: 'Giorgio Vanni', emoji: '🎸' },
  { tag: 'robot', label: 'Super robot', emoji: '🤖' },
  { tag: 'magia', label: 'Maghette', emoji: '🪄' },
  { tag: 'sport', label: 'Sport', emoji: '⚽' },
  { tag: 'anime', label: 'Anime giapponesi', emoji: '🗾' },
  { tag: 'western', label: 'Cartoni occidentali', emoji: '🌍' },
];

export function matchesFilters(song: Song, settings: Pick<GameSettings, 'decades' | 'minFame' | 'tags'>): boolean {
  if (settings.decades.length && !settings.decades.includes(decadeOf(song.year))) return false;
  if (song.fame < settings.minFame) return false;
  if (settings.tags.length && !settings.tags.some((t) => song.tags.includes(t))) return false;
  return true;
}

export function filterDeck(songs: readonly Song[], settings: Pick<GameSettings, 'decades' | 'minFame' | 'tags'>): Song[] {
  return songs.filter((s) => matchesFilters(s, settings));
}

/** Minimum deck size for a game with `players` players aiming at `target` cards. */
export function minDeckSize(players: number, target: number): number {
  return Math.max(20, players + target + 8);
}

/** Rough number of cards a game needs, used to warn when a filtered deck is too small. */
export function recommendedDeckSize(players: number, target: number): number {
  // Empirically ~45-55 % of placements are correct, so the leader needs ~2 draws per kept card.
  return players + Math.ceil(players * (target - 1) * 1.6);
}
