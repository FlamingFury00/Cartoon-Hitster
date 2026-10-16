// Core domain types for "Sigle in Fila".

/** A single card of the deck: one Italian cartoon theme song ("sigla"). */
export interface Song {
  /** Stable card number, e.g. "042". */
  id: string;
  /** Show the theme belongs to. */
  cartoon: string;
  /** Title of the song as released. */
  title: string;
  /** Credited performer. */
  performer: string;
  /** Year of the first Italian broadcast / first release of THIS theme. */
  year: number;
  /** Country the show comes from (ISO-like code, e.g. JP, US, IT). */
  origin: string;
  /** Emoji used as the card illustration. */
  emoji: string;
  /** 3 = iconic, 2 = well known, 1 = deep cut. */
  fame: 1 | 2 | 3;
  /** Free tags used by deck filters (e.g. "cristina", "vanni", "robot"). */
  tags: string[];
  /** Short note shown on the revealed card (e.g. "Sigla delle repliche"). */
  note?: string;
  /** Playback sources. */
  src: SongSources;
}

export interface SongSources {
  /** Deezer track id (30 s preview resolved at runtime). */
  dz?: number;
  /** iTunes track id. */
  it?: number;
  /** iTunes preview URL (stable, CORS enabled). */
  itp?: string;
  /** Spotify track id (deep link / full song in the Spotify app). */
  sp?: string;
  /** Spotify 30 s preview URL (public CDN, CORS enabled), used as a fallback source. */
  spp?: string;
  /** Loudness correction in dB for each preview source. */
  gain?: { dz?: number; it?: number; sp?: number };
  /** Seconds to skip at the start of the preview (silence). */
  skip?: { dz?: number; it?: number; sp?: number };
}

export interface Deck {
  version: number;
  generated: string;
  songs: Song[];
}

export type Decade = 1970 | 1980 | 1990 | 2000 | 2010 | 2020;

export type GameMode = 'classic' | 'pro' | 'coop';

export interface GameSettings {
  mode: GameMode;
  /** Cards needed to win. */
  target: number;
  /** Token rules (skip / steal / buy) enabled. Always on in co-op (tokens are the team's lives). */
  tokens: boolean;
  /** Tokens each player starts with. */
  startTokens: number;
  /** Maximum tokens a player can hold. */
  maxTokens: number;
  /** When on, the game ends only after everyone had the same number of turns. */
  equalTurns: boolean;
  /** Deck filters. */
  decades: Decade[];
  minFame: 1 | 2 | 3;
  /** Optional tag filter: empty = everything. */
  tags: string[];
}

export interface PlayerStats {
  placed: number;
  correct: number;
  bonus: number;
  steals: number;
  stolen: number;
  skips: number;
  bought: number;
  streak: number;
  bestStreak: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  /** Song ids, kept sorted by year. In co-op only the team timeline is used. */
  timeline: string[];
  tokens: number;
  stats: PlayerStats;
}

export interface Challenge {
  playerId: string;
  slot: number;
}

export interface RevealOutcome {
  /** Was the active player's slot chronologically valid? */
  placementCorrect: boolean;
  /** Valid slots (inclusive range) in the active timeline. */
  validFrom: number;
  validTo: number;
  /** Player who wins a challenge (steals the card), if any. */
  stolenBy: string | null;
  /** The card was bought with tokens: no guess was made. */
  bought: boolean;
}

export type Phase =
  | { t: 'intro' }
  | { t: 'listen'; card: string; slot: number | null }
  | { t: 'challenge'; card: string; slot: number; challenges: Challenge[] }
  | { t: 'reveal'; card: string; slot: number | null; challenges: Challenge[]; outcome: RevealOutcome }
  | { t: 'over'; reason: 'target' | 'deck' | 'coop-won' | 'coop-lost'; winners: string[] };

/** One resolved turn, kept for statistics and the end-of-game summary. */
export interface TurnRecord {
  turn: number;
  playerId: string;
  card: string;
  kind: 'placed' | 'bought' | 'skipped';
  correct: boolean;
  /** Where the card ended: a player id, 'team' or null (discarded). */
  wonBy: string | null;
  cartoonGuessed: boolean;
  performerGuessed: boolean;
  tokenEarned: boolean;
}

export interface GameState {
  v: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  seed: number;
  settings: GameSettings;
  players: Player[];
  /** Co-op team: shared timeline and shared tokens (= lives). */
  team: { timeline: string[]; tokens: number } | null;
  /** Draw pile, the next card is the LAST element. */
  deck: string[];
  discard: string[];
  /** Number of completed turns. */
  turn: number;
  /** Index of the active player. */
  active: number;
  /** Index of the player who started the game (for equal-turns rounds). */
  firstPlayer: number;
  phase: Phase;
  history: TurnRecord[];
}

export interface PlayerSetup {
  name: string;
  avatar: string;
  color: string;
}
