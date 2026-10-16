// The rules of "Sigle in Fila", as pure functions: (state, action) -> new state.
// Nothing here touches the DOM, audio or storage, so every rule is unit-testable.
import { filterDeck, minDeckSize } from './deck';
import { mulberry32, randomSeed, spreadByKey, weightedOrder } from './rng';
import { insertSorted, isValidSlot, validSlotRange } from './timeline';
import type {
  Challenge,
  GameSettings,
  GameState,
  Phase,
  Player,
  PlayerSetup,
  PlayerStats,
  RevealOutcome,
  Song,
  TurnRecord,
} from './types';

export const BUY_COST = 3;
export const SKIP_COST = 1;
export const CHALLENGE_COST = 1;
export const MAX_PLAYERS = 6;

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'classic',
  target: 10,
  tokens: true,
  startTokens: 2,
  maxTokens: 5,
  equalTurns: false,
  decades: [],
  minFame: 2,
  tags: [],
};

export class RuleError extends Error {}

/** Lookup used by the engine to know the year of a card. */
export interface SongLookup {
  get(id: string): Song | undefined;
}

const emptyStats = (): PlayerStats => ({
  placed: 0,
  correct: 0,
  bonus: 0,
  steals: 0,
  stolen: 0,
  skips: 0,
  bought: 0,
  streak: 0,
  bestStreak: 0,
});

function yearFn(songs: SongLookup) {
  return (id: string) => {
    const s = songs.get(id);
    if (!s) throw new RuleError(`Carta sconosciuta: ${id}`);
    return s.year;
  };
}

// Game states are plain JSON; structuredClone is missing on old Safari versions.
const clone = (v: GameState): GameState =>
  typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as GameState);

export interface NewGameOptions {
  players: PlayerSetup[];
  settings: GameSettings;
  songs: readonly Song[];
  seed?: number;
  /** 0..1 multiplier lowering the odds of songs heard in recent games. */
  freshness?: (id: string) => number;
  /** Index of the player who takes the first turn (default: the first one). */
  firstPlayer?: number;
  now?: number;
}

const FAME_WEIGHT = { 1: 0.75, 2: 1, 3: 1.35 } as const;

export function newGame(opts: NewGameOptions): GameState {
  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const coop = settings.mode === 'coop';
  const n = opts.players.length;
  if (n < (coop ? 1 : 2) || n > MAX_PLAYERS) throw new RuleError(coop ? 'Servono da 1 a 6 giocatori' : 'Servono da 2 a 6 giocatori');
  if (settings.target < 3 || settings.target > 30) throw new RuleError('Obiettivo non valido');
  const pool = filterDeck(opts.songs, settings);
  const starters = coop ? 1 : n;
  if (pool.length < minDeckSize(starters, settings.target)) {
    throw new RuleError(`Il mazzo filtrato ha solo ${pool.length} sigle: allarga i filtri.`);
  }

  const seed = (opts.seed ?? randomSeed()) >>> 0;
  const rand = mulberry32(seed);
  const fresh = opts.freshness ?? (() => 1);
  const ordered = spreadByKey(
    weightedOrder(pool, (s) => FAME_WEIGHT[s.fame] * fresh(s.id), rand),
    (s) => s.cartoon,
    4,
  );

  // Starting cards come from the central band of years, so nobody starts with an
  // extreme card that makes the first placements trivial (fairer opening).
  const years = pool.map((s) => s.year).sort((a, b) => a - b);
  const lo = years[Math.floor(years.length * 0.2)];
  const hi = years[Math.floor(years.length * 0.8)];
  const startCards: Song[] = [];
  for (let i = 0; i < starters; i++) {
    const taken = new Set(startCards.map((s) => s.year));
    let idx = ordered.findIndex((s) => s.year >= lo && s.year <= hi && !taken.has(s.year));
    if (idx < 0) idx = ordered.findIndex((s) => s.year >= lo && s.year <= hi);
    if (idx < 0) idx = 0;
    startCards.push(ordered.splice(idx, 1)[0]);
  }

  const players: Player[] = opts.players.map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name.trim() || `Giocatore ${i + 1}`,
    avatar: p.avatar,
    color: p.color,
    timeline: coop ? [] : [startCards[i].id],
    tokens: coop || !settings.tokens ? 0 : Math.min(settings.startTokens, settings.maxTokens),
    stats: emptyStats(),
  }));

  const now = opts.now ?? Date.now();
  const first = Math.max(0, Math.min(n - 1, Math.trunc(opts.firstPlayer ?? 0)));
  return {
    v: 1,
    id: `g${now.toString(36)}${seed.toString(36)}`,
    createdAt: now,
    updatedAt: now,
    seed,
    settings: coop ? { ...settings, tokens: true } : settings,
    players,
    team: coop ? { timeline: [startCards[0].id], tokens: Math.min(settings.startTokens, settings.maxTokens) } : null,
    // The draw pile is consumed from the end.
    deck: ordered.map((s) => s.id).reverse(),
    discard: [],
    turn: 0,
    active: first,
    firstPlayer: first,
    phase: { t: 'intro' },
    history: [],
  };
}

// ------------------------------------------------------------------ queries

export const activePlayer = (s: GameState): Player => s.players[s.active];
export const isCoop = (s: GameState): boolean => s.settings.mode === 'coop';

/** Timeline the active player is building (the team timeline in co-op). */
export function activeTimeline(s: GameState): string[] {
  return s.team ? s.team.timeline : activePlayer(s).timeline;
}

export function timelineOf(s: GameState, playerId: string): string[] {
  if (s.team) return s.team.timeline;
  return s.players.find((p) => p.id === playerId)?.timeline ?? [];
}

/** Tokens available to the active player (team tokens in co-op). */
export function activeTokens(s: GameState): number {
  return s.team ? s.team.tokens : activePlayer(s).tokens;
}

export function nextCardId(s: GameState): string | undefined {
  return s.deck[s.deck.length - 1];
}

export function canSkip(s: GameState): boolean {
  return s.phase.t === 'listen' && s.settings.tokens && activeTokens(s) >= SKIP_COST && s.deck.length > 0;
}

export function canBuy(s: GameState): boolean {
  if (isCoop(s) || !s.settings.tokens) return false;
  if (s.phase.t === 'intro') return activeTokens(s) >= BUY_COST && s.deck.length > 0;
  return s.phase.t === 'listen' && activeTokens(s) >= BUY_COST;
}

/** Players that may still challenge the current placement. */
export function challengers(s: GameState): Player[] {
  if (isCoop(s) || !s.settings.tokens) return [];
  const active = activePlayer(s);
  const taken = s.phase.t === 'challenge' ? new Set(s.phase.challenges.map((c) => c.playerId)) : new Set<string>();
  return s.players.filter((p) => p.id !== active.id && p.tokens >= CHALLENGE_COST && !taken.has(p.id));
}

export function canChallenge(s: GameState): boolean {
  return challengers(s).length > 0;
}

/** Slots still free for a challenge (not the active player's and not another challenger's). */
export function freeChallengeSlots(s: GameState): number[] {
  if (s.phase.t !== 'challenge') return [];
  const n = activeTimeline(s).length;
  const used = new Set([s.phase.slot, ...s.phase.challenges.map((c) => c.slot)]);
  return Array.from({ length: n + 1 }, (_, i) => i).filter((i) => !used.has(i));
}

export function isFinalRound(s: GameState): boolean {
  return !isCoop(s) && s.settings.equalTurns && s.players.some((p) => p.timeline.length >= s.settings.target);
}

export function leaders(s: GameState): Player[] {
  const max = Math.max(...s.players.map((p) => p.timeline.length));
  let best = s.players.filter((p) => p.timeline.length === max);
  if (best.length > 1) {
    const maxTokens = Math.max(...best.map((p) => p.tokens));
    best = best.filter((p) => p.tokens === maxTokens);
  }
  return best;
}

// ------------------------------------------------------------------ actions

function expectPhase<T extends Phase['t']>(s: GameState, ...kinds: T[]): asserts s is GameState & { phase: Extract<Phase, { t: T }> } {
  if (!kinds.includes(s.phase.t as T)) throw new RuleError(`Azione non valida nella fase "${s.phase.t}"`);
}

function touch(s: GameState): GameState {
  s.updatedAt = Date.now();
  return s;
}

function spendActive(s: GameState, cost: number) {
  if (s.team) {
    if (s.team.tokens < cost) throw new RuleError('Gettoni insufficienti');
    s.team.tokens -= cost;
  } else {
    const p = activePlayer(s);
    if (p.tokens < cost) throw new RuleError('Gettoni insufficienti');
    p.tokens -= cost;
  }
}

function endGame(s: GameState, reason: Extract<Phase, { t: 'over' }>['reason'], winners: string[]): GameState {
  s.phase = { t: 'over', reason, winners };
  return touch(s);
}

/** Intro -> listen: draws the next card. Ends the game if the deck is exhausted. */
export function drawCard(state: GameState): GameState {
  expectPhase(state, 'intro');
  const s = clone(state);
  const card = s.deck.pop();
  if (!card) return endGame(s, isCoop(s) ? 'coop-lost' : 'deck', isCoop(s) ? [] : leaders(s).map((p) => p.id));
  s.phase = { t: 'listen', card, slot: null };
  return touch(s);
}

export function setSlot(state: GameState, slot: number | null): GameState {
  expectPhase(state, 'listen');
  const n = activeTimeline(state).length;
  if (slot != null && (!Number.isInteger(slot) || slot < 0 || slot > n)) throw new RuleError('Posizione non valida');
  const s = clone(state);
  (s.phase as Extract<Phase, { t: 'listen' }>).slot = slot;
  return touch(s);
}

/** Spends a token to discard the current song and draw another one (same turn). */
export function skipCard(state: GameState): GameState {
  if (!canSkip(state)) throw new RuleError('Non puoi saltare questa carta');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'listen' }>;
  spendActive(s, SKIP_COST);
  activePlayer(s).stats.skips++;
  s.discard.push(phase.card);
  s.history.push({
    turn: s.turn,
    playerId: activePlayer(s).id,
    card: phase.card,
    kind: 'skipped',
    correct: false,
    wonBy: null,
    cartoonGuessed: false,
    performerGuessed: false,
    tokenEarned: false,
  });
  const next = s.deck.pop()!;
  s.phase = { t: 'listen', card: next, slot: null };
  return touch(s);
}

/** Replaces a card whose audio cannot be played (free of charge, the card leaves the game). */
export function swapUnplayable(state: GameState): GameState {
  expectPhase(state, 'listen');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'listen' }>;
  s.discard.push(phase.card);
  const next = s.deck.pop();
  if (!next) return endGame(s, isCoop(s) ? 'coop-lost' : 'deck', isCoop(s) ? [] : leaders(s).map((p) => p.id));
  s.phase = { t: 'listen', card: next, slot: null };
  return touch(s);
}

/** Spends 3 tokens to take the card straight into the timeline without guessing. */
export function buyCard(state: GameState, songs: SongLookup): GameState {
  if (!canBuy(state)) throw new RuleError('Non puoi comprare la carta');
  let s = clone(state);
  if (s.phase.t === 'intro') s = drawCard(s);
  const phase = s.phase as Extract<Phase, { t: 'listen' }>;
  spendActive(s, BUY_COST);
  const [from, to] = validSlotRange(activeTimeline(s), yearFn(songs)(phase.card), yearFn(songs));
  s.phase = {
    t: 'reveal',
    card: phase.card,
    slot: to,
    challenges: [],
    outcome: { placementCorrect: true, validFrom: from, validTo: to, stolenBy: null, bought: true },
  };
  return touch(s);
}

/** Locks the active player's choice. Moves to the challenge window when someone can challenge. */
export function confirmPlacement(state: GameState, songs: SongLookup): GameState {
  expectPhase(state, 'listen');
  if (state.phase.slot == null) throw new RuleError('Scegli prima dove mettere la carta');
  if (canChallenge(state)) {
    const s = clone(state);
    const p = s.phase as Extract<Phase, { t: 'listen' }>;
    s.phase = { t: 'challenge', card: p.card, slot: p.slot!, challenges: [] };
    return touch(s);
  }
  return reveal(state, songs);
}

export function addChallenge(state: GameState, playerId: string, slot: number): GameState {
  expectPhase(state, 'challenge');
  const who = challengers(state).find((p) => p.id === playerId);
  if (!who) throw new RuleError('Questo giocatore non può sfidare');
  if (!freeChallengeSlots(state).includes(slot)) throw new RuleError('Posizione già occupata');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'challenge' }>;
  s.players.find((p) => p.id === playerId)!.tokens -= CHALLENGE_COST;
  phase.challenges.push({ playerId, slot } satisfies Challenge);
  return touch(s);
}

/** Cancels a challenge (the token is given back). */
export function removeChallenge(state: GameState, playerId: string): GameState {
  expectPhase(state, 'challenge');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'challenge' }>;
  const i = phase.challenges.findIndex((c) => c.playerId === playerId);
  if (i < 0) return state;
  phase.challenges.splice(i, 1);
  s.players.find((p) => p.id === playerId)!.tokens += CHALLENGE_COST;
  return touch(s);
}

/** Flips the card: computes whether the placement (and the challenges) were right. */
export function reveal(state: GameState, songs: SongLookup): GameState {
  expectPhase(state, 'listen', 'challenge');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'listen' | 'challenge' }>;
  if (phase.slot == null) throw new RuleError('Scegli prima dove mettere la carta');
  const yearOf = yearFn(songs);
  const tl = activeTimeline(s);
  const year = yearOf(phase.card);
  const [from, to] = validSlotRange(tl, year, yearOf);
  const correct = isValidSlot(tl, phase.slot, year, yearOf);
  const challenges = phase.t === 'challenge' ? phase.challenges : [];
  // When the active player is wrong, the first challenger (in calling order) with a valid slot steals the card.
  const thief = correct ? null : challenges.find((c) => c.slot >= from && c.slot <= to) ?? null;
  const outcome: RevealOutcome = {
    placementCorrect: correct,
    validFrom: from,
    validTo: to,
    stolenBy: thief?.playerId ?? null,
    bought: false,
  };
  s.phase = { t: 'reveal', card: phase.card, slot: phase.slot, challenges, outcome };
  return touch(s);
}

export interface Guess {
  cartoon: boolean;
  performer: boolean;
}

/** Where the revealed card will end up given the honour-system guesses. */
export function cardDestination(s: GameState, guess: Guess): string | 'team' | null {
  if (s.phase.t !== 'reveal') return null;
  const { outcome } = s.phase;
  const active = activePlayer(s);
  if (outcome.bought) return isCoop(s) ? 'team' : active.id;
  if (isCoop(s)) return outcome.placementCorrect ? 'team' : null;
  if (outcome.placementCorrect) {
    if (s.settings.mode === 'pro' && !guess.cartoon) return null;
    return active.id;
  }
  return outcome.stolenBy;
}

/** Whether the guesses earn a token. */
export function earnsToken(s: GameState, guess: Guess): boolean {
  if (!s.settings.tokens || s.phase.t !== 'reveal' || s.phase.outcome.bought) return false;
  return guess.cartoon && guess.performer;
}

/** Applies the revealed card, tokens and statistics, then passes the turn (or ends the game). */
export function resolveTurn(state: GameState, songs: SongLookup, guess: Guess): GameState {
  expectPhase(state, 'reveal');
  const s = clone(state);
  const phase = s.phase as Extract<Phase, { t: 'reveal' }>;
  const yearOf = yearFn(songs);
  const active = activePlayer(s);
  const dest = cardDestination(s, guess);
  const tokenEarned = earnsToken(s, guess);
  const { outcome } = phase;

  // Card movement
  if (dest === 'team' && s.team) {
    s.team.timeline = insertSorted(s.team.timeline, phase.card, yearOf, phase.slot ?? undefined);
  } else if (dest) {
    const owner = s.players.find((p) => p.id === dest)!;
    const preferred = dest === active.id ? phase.slot ?? undefined : undefined;
    owner.timeline = insertSorted(owner.timeline, phase.card, yearOf, preferred);
  } else {
    s.discard.push(phase.card);
  }

  // Tokens
  if (tokenEarned) {
    if (s.team) s.team.tokens = Math.min(s.settings.maxTokens, s.team.tokens + 1);
    else active.tokens = Math.min(s.settings.maxTokens, active.tokens + 1);
  }

  // Statistics
  if (outcome.bought) {
    active.stats.bought++;
  } else {
    active.stats.placed++;
    if (outcome.placementCorrect) {
      active.stats.correct++;
      active.stats.streak++;
      active.stats.bestStreak = Math.max(active.stats.bestStreak, active.stats.streak);
    } else {
      active.stats.streak = 0;
    }
    if (tokenEarned) active.stats.bonus++;
    if (outcome.stolenBy && dest === outcome.stolenBy) {
      s.players.find((p) => p.id === outcome.stolenBy)!.stats.steals++;
      active.stats.stolen++;
    }
  }

  const record: TurnRecord = {
    turn: s.turn,
    playerId: active.id,
    card: phase.card,
    kind: outcome.bought ? 'bought' : 'placed',
    correct: outcome.placementCorrect,
    wonBy: dest,
    cartoonGuessed: guess.cartoon,
    performerGuessed: guess.performer,
    tokenEarned,
  };
  s.history.push(record);

  // Co-op: a wrong card costs a life; with no lives left the team loses.
  if (s.team && !outcome.bought && !outcome.placementCorrect) {
    if (s.team.tokens <= 0) return endGame(s, 'coop-lost', []);
    s.team.tokens -= 1;
  }

  // Victory checks
  const target = s.settings.target;
  if (s.team) {
    if (s.team.timeline.length >= target) return endGame(s, 'coop-won', s.players.map((p) => p.id));
  } else if (!s.settings.equalTurns) {
    const winner = s.players.find((p) => p.timeline.length >= target);
    if (winner) return endGame(s, 'target', [winner.id]);
  }

  // Next player
  s.turn++;
  const nextActive = (s.active + 1) % s.players.length;
  if (!s.team && s.settings.equalTurns && nextActive === s.firstPlayer) {
    const reached = s.players.filter((p) => p.timeline.length >= target);
    if (reached.length) return endGame(s, 'target', leaders(s).map((p) => p.id));
  }
  if (s.deck.length === 0) {
    return endGame(s, s.team ? 'coop-lost' : 'deck', s.team ? [] : leaders(s).map((p) => p.id));
  }
  s.active = nextActive;
  s.phase = { t: 'intro' };
  return touch(s);
}

/** Ends the game early (players stop): the leaders win. */
export function abandonGame(state: GameState): GameState {
  const s = clone(state);
  if (s.team) return endGame(s, 'coop-lost', []);
  return endGame(s, 'deck', leaders(s).map((p) => p.id));
}
