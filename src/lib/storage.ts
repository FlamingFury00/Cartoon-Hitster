// localStorage persistence (guarded: storage can be unavailable or full).
import type { GameSettings, GameState, PlayerSetup } from './game/types';
import { DEFAULT_SETTINGS } from './game/engine';
import type { SourcePreference } from './audio/sources';

const KEY = {
  game: 'sif.game.v1',
  settings: 'sif.settings.v1',
  history: 'sif.history.v1',
  recent: 'sif.recent.v1',
  roster: 'sif.roster.v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled: the game still works, it just won't persist */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ settings

export interface AppSettings {
  musicVolume: number;
  sfx: boolean;
  sfxVolume: number;
  haptics: boolean;
  keepAwake: boolean;
  motion: 'auto' | 'reduced';
  source: SourcePreference;
  playback: 'preview' | 'spotify';
  autoLoop: boolean;
  game: GameSettings;
  seenRules: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  musicVolume: 0.9,
  sfx: true,
  sfxVolume: 0.7,
  haptics: true,
  keepAwake: true,
  motion: 'auto',
  source: 'auto',
  playback: 'preview',
  autoLoop: true,
  game: DEFAULT_SETTINGS,
  seenRules: false,
};

export function loadSettings(): AppSettings {
  const s = read<Partial<AppSettings>>(KEY.settings, {});
  return { ...DEFAULT_APP_SETTINGS, ...s, game: { ...DEFAULT_SETTINGS, ...(s.game ?? {}) } };
}

export function saveSettings(s: AppSettings) {
  write(KEY.settings, s);
}

// ------------------------------------------------------------------ saved game

export function loadGame(): GameState | null {
  const g = read<GameState | null>(KEY.game, null);
  return g && g.v === 1 && g.phase ? g : null;
}

export function saveGame(g: GameState | null) {
  if (g) write(KEY.game, g);
  else remove(KEY.game);
}

// ------------------------------------------------------------------ roster

export function loadRoster(): PlayerSetup[] {
  return read<PlayerSetup[]>(KEY.roster, []);
}

export function saveRoster(r: PlayerSetup[]) {
  write(KEY.roster, r);
}

// ------------------------------------------------------------------ history

export interface HistoryPlayer {
  name: string;
  avatar: string;
  color: string;
  cards: number;
  tokens: number;
  correct: number;
  placed: number;
  steals: number;
  bestStreak: number;
}

export interface HistoryEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  mode: GameSettings['mode'];
  target: number;
  reason: string;
  turns: number;
  winners: string[];
  players: HistoryPlayer[];
  team?: { cards: number; tokens: number };
}

const HISTORY_MAX = 100;

export function loadHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(KEY.history, []);
}

export function addHistory(e: HistoryEntry) {
  const h = loadHistory().filter((x) => x.id !== e.id);
  h.unshift(e);
  write(KEY.history, h.slice(0, HISTORY_MAX));
}

export function clearHistory() {
  remove(KEY.history);
}

// ------------------------------------------------------------------ freshness

interface Recent {
  games: number;
  seen: Record<string, number>;
}

/** Called when a new game starts: returns a weight function favouring songs not heard recently. */
export function beginGameFreshness(): (id: string) => number {
  const r = read<Recent>(KEY.recent, { games: 0, seen: {} });
  const games = r.games + 1;
  write(KEY.recent, { ...r, games });
  return (id: string) => {
    const last = r.seen[id];
    if (last == null) return 1;
    const ago = games - last; // 1 = heard in the previous game
    return Math.min(1, 0.25 * ago);
  };
}

export function markSeen(ids: string[]) {
  const r = read<Recent>(KEY.recent, { games: 1, seen: {} });
  for (const id of ids) r.seen[id] = r.games;
  write(KEY.recent, r);
}

export function resetAll() {
  for (const k of Object.values(KEY)) remove(k);
}
