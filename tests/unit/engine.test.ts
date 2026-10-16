import { describe, expect, it } from 'vitest';
import {
  abandonGame,
  addChallenge,
  activePlayer,
  activeTimeline,
  buyCard,
  canBuy,
  canChallenge,
  canSkip,
  cardDestination,
  confirmPlacement,
  DEFAULT_SETTINGS,
  drawCard,
  freeChallengeSlots,
  newGame,
  removeChallenge,
  resolveTurn,
  reveal,
  RuleError,
  setSlot,
  skipCard,
} from '../../src/lib/game/engine';
import { validSlotRange } from '../../src/lib/game/timeline';
import type { GameSettings, GameState, PlayerSetup, Song } from '../../src/lib/game/types';

function makeSongs(n = 80): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1).padStart(3, '0'),
    cartoon: `Cartone ${i % 50}`,
    title: `Sigla ${i}`,
    performer: i % 2 ? "Cristina D'Avena" : 'Altri',
    year: 1978 + (i % 40),
    origin: 'JP',
    emoji: '🎵',
    fame: (((i % 3) + 1) as 1 | 2 | 3),
    tags: [],
    src: {},
  }));
}

const songs = makeSongs();
const lookup = new Map(songs.map((s) => [s.id, s]));
const yearOf = (id: string) => lookup.get(id)!.year;
const players: PlayerSetup[] = [
  { name: 'Anna', avatar: '🐱', color: '#f00' },
  { name: 'Bruno', avatar: '🐶', color: '#0f0' },
  { name: 'Carla', avatar: '🦊', color: '#00f' },
];
const settings = (over: Partial<GameSettings> = {}): GameSettings => ({ ...DEFAULT_SETTINGS, minFame: 1, ...over });

function start(over: Partial<GameSettings> = {}, seed = 42, ps = players): GameState {
  return newGame({ players: ps, settings: settings(over), songs, seed, now: 1 });
}

/** Valid / invalid slot for the card being played. */
function slotFor(s: GameState, valid: boolean): number {
  const card = (s.phase as { card: string }).card;
  const tl = activeTimeline(s);
  const [from, to] = validSlotRange(tl, yearOf(card), yearOf);
  if (valid) return from;
  for (let i = 0; i <= tl.length; i++) if (i < from || i > to) return i;
  return from; // every slot is valid (e.g. a single card with the same year)
}

describe('newGame', () => {
  it('deals one starting card per player and keeps the deck consistent', () => {
    const s = start();
    expect(s.players).toHaveLength(3);
    for (const p of s.players) expect(p.timeline).toHaveLength(1);
    const all = [...s.deck, ...s.players.flatMap((p) => p.timeline)];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(songs.length);
    expect(s.players.every((p) => p.tokens === 2)).toBe(true);
    expect(s.phase).toEqual({ t: 'intro' });
  });

  it('is deterministic for a given seed', () => {
    expect(start({}, 7).deck).toEqual(start({}, 7).deck);
    expect(start({}, 7).deck).not.toEqual(start({}, 8).deck);
  });

  it('gives starting cards from the central band of years with distinct years', () => {
    const s = start();
    const ys = s.players.map((p) => yearOf(p.timeline[0]));
    expect(new Set(ys).size).toBe(ys.length);
    for (const y of ys) expect(y).toBeGreaterThanOrEqual(1985);
  });

  it('rejects invalid player counts and too small decks', () => {
    expect(() => start({}, 1, players.slice(0, 1))).toThrow(RuleError);
    expect(() => start({ mode: 'coop' }, 1, players.slice(0, 1))).not.toThrow();
    expect(() => start({ decades: [1970] })).toThrow(/mazzo/);
  });

  it('keeps cards of the same cartoon apart in the draw pile', () => {
    const s = start();
    const order = s.deck.slice().reverse();
    for (let i = 0; i < 20; i++) {
      const c = lookup.get(order[i])!.cartoon;
      const near = order.slice(i + 1, i + 5).map((id) => lookup.get(id)!.cartoon);
      expect(near).not.toContain(c);
    }
  });
});

describe('turn flow', () => {
  it('draw -> place -> reveal -> resolve keeps the card when right', () => {
    let s = drawCard(start({ tokens: false }));
    expect(s.phase.t).toBe('listen');
    const card = (s.phase as { card: string }).card;
    s = setSlot(s, slotFor(s, true));
    s = confirmPlacement(s, lookup); // no tokens -> no challenge window
    expect(s.phase.t).toBe('reveal');
    s = resolveTurn(s, lookup, { cartoon: false, performer: false });
    expect(s.players[0].timeline).toContain(card);
    expect(s.players[0].timeline.map(yearOf)).toEqual([...s.players[0].timeline.map(yearOf)].sort((a, b) => a - b));
    expect(s.active).toBe(1);
    expect(s.phase.t).toBe('intro');
    expect(s.players[0].stats.correct).toBe(1);
  });

  it('discards the card when wrong', () => {
    let s = drawCard(start({ tokens: false }));
    const card = (s.phase as { card: string }).card;
    s = setSlot(s, slotFor(s, false));
    s = resolveTurn(confirmPlacement(s, lookup), lookup, { cartoon: true, performer: true });
    expect(s.players[0].timeline).not.toContain(card);
    expect(s.discard).toContain(card);
  });

  it('accepts either side of a card with the same year', () => {
    let s = start({ tokens: false });
    s = drawCard(s);
    const card = (s.phase as { card: string }).card;
    // Force a timeline made of a card with the same year
    const twin = songs.find((x) => x.year === yearOf(card) && x.id !== card)!;
    s.players[0].timeline = [twin.id];
    for (const slot of [0, 1]) {
      const r = reveal(setSlot(s, slot), lookup);
      expect(r.phase.t === 'reveal' && r.phase.outcome.placementCorrect).toBe(true);
    }
  });

  it('requires a slot before confirming', () => {
    const s = drawCard(start());
    expect(() => confirmPlacement(s, lookup)).toThrow(RuleError);
  });
});

describe('tokens', () => {
  it('earns a token only when cartoon AND performer are guessed, capped at max', () => {
    let s = drawCard(start());
    s = reveal(setSlot(s, slotFor(s, true)), lookup);
    expect(resolveTurn(s, lookup, { cartoon: true, performer: false }).players[0].tokens).toBe(2);
    expect(resolveTurn(s, lookup, { cartoon: true, performer: true }).players[0].tokens).toBe(3);
    s.players[0].tokens = 5;
    expect(resolveTurn(s, lookup, { cartoon: true, performer: true }).players[0].tokens).toBe(5);
  });

  it('skip costs one token and draws another card', () => {
    let s = drawCard(start());
    const first = (s.phase as { card: string }).card;
    expect(canSkip(s)).toBe(true);
    s = skipCard(s);
    expect(activePlayer(s).tokens).toBe(1);
    expect((s.phase as { card: string }).card).not.toBe(first);
    expect(s.discard).toContain(first);
    s = skipCard(s);
    expect(canSkip(s)).toBe(false);
    expect(() => skipCard(s)).toThrow(RuleError);
  });

  it('buying costs three tokens and places the card correctly', () => {
    let s = start();
    expect(canBuy(s)).toBe(false);
    s.players[0].tokens = 3;
    expect(canBuy(s)).toBe(true);
    s = buyCard(s, lookup);
    expect(s.phase.t).toBe('reveal');
    const card = (s.phase as { card: string }).card;
    s = resolveTurn(s, lookup, { cartoon: true, performer: true });
    expect(s.players[0].tokens).toBe(0); // no bonus on bought cards
    expect(s.players[0].timeline).toContain(card);
    expect(s.players[0].stats.bought).toBe(1);
  });
});

describe('challenges', () => {
  it('opens a challenge window when another player has tokens', () => {
    let s = drawCard(start());
    s = confirmPlacement(setSlot(s, slotFor(s, false)), lookup);
    expect(s.phase.t).toBe('challenge');
    expect(canChallenge(s)).toBe(true);
  });

  it('a right challenger steals the card when the active player is wrong', () => {
    let s = drawCard(start());
    const card = (s.phase as { card: string }).card;
    const wrong = slotFor(s, false);
    s = confirmPlacement(setSlot(s, wrong), lookup);
    const [from] = validSlotRange(activeTimeline(s), yearOf(card), yearOf);
    s = addChallenge(s, 'p2', from);
    expect(s.players[1].tokens).toBe(1);
    expect(freeChallengeSlots(s)).not.toContain(from);
    s = reveal(s, lookup);
    expect(s.phase.t === 'reveal' && s.phase.outcome.stolenBy).toBe('p2');
    s = resolveTurn(s, lookup, { cartoon: false, performer: false });
    expect(s.players[1].timeline).toContain(card);
    expect(s.players[0].timeline).not.toContain(card);
    expect(s.players[1].stats.steals).toBe(1);
  });

  it('challengers lose their token when the active player is right', () => {
    let s = drawCard(start());
    const right = slotFor(s, true);
    s = confirmPlacement(setSlot(s, right), lookup);
    const other = freeChallengeSlots(s)[0];
    s = reveal(addChallenge(s, 'p3', other), lookup);
    s = resolveTurn(s, lookup, { cartoon: false, performer: false });
    expect(s.players[2].tokens).toBe(1);
    expect(s.players[0].timeline).toHaveLength(2);
  });

  it('a cancelled challenge refunds the token and cannot reuse a taken slot', () => {
    let s = drawCard(start());
    s = confirmPlacement(setSlot(s, 0), lookup);
    expect(() => addChallenge(s, 'p2', 0)).toThrow(RuleError);
    s = addChallenge(s, 'p2', 1);
    expect(() => addChallenge(s, 'p3', 1)).toThrow(RuleError);
    s = removeChallenge(s, 'p2');
    expect(s.players[1].tokens).toBe(2);
    expect(() => addChallenge(s, 'p1', 1)).toThrow(RuleError); // the active player cannot challenge
  });
});

describe('modes and endings', () => {
  it('pro mode keeps a right card only if the cartoon was named', () => {
    let s = drawCard(start({ mode: 'pro', tokens: false }));
    s = reveal(setSlot(s, slotFor(s, true)), lookup);
    expect(cardDestination(s, { cartoon: false, performer: false })).toBeNull();
    expect(cardDestination(s, { cartoon: true, performer: false })).toBe('p1');
  });

  it('first player to reach the target wins immediately', () => {
    let s = start({ target: 3, tokens: false });
    for (let guard = 0; guard < 200 && s.phase.t !== 'over'; guard++) {
      s = drawCard(s);
      s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, true)), lookup), lookup, { cartoon: false, performer: false });
    }
    expect(s.phase.t).toBe('over');
    expect(s.phase.t === 'over' && s.phase.winners).toEqual(['p1']);
    expect(s.players[0].timeline).toHaveLength(3);
  });

  it('equal turns lets everybody finish the round', () => {
    let s = start({ target: 3, tokens: false, equalTurns: true });
    let turns = 0;
    while (s.phase.t !== 'over') {
      s = drawCard(s);
      s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, true)), lookup), lookup, { cartoon: false, performer: false });
      turns++;
    }
    expect(turns).toBe(6); // two full rounds of three players
    expect(s.phase.t === 'over' && s.phase.winners).toEqual(['p1', 'p2', 'p3']);
  });

  it('can start from any player, and equal turns closes the round before that player', () => {
    let s = newGame({ players, settings: settings({ target: 3, tokens: false, equalTurns: true }), songs, seed: 7, now: 1, firstPlayer: 2 });
    expect(activePlayer(s).id).toBe('p3');
    const order: string[] = [];
    while (s.phase.t !== 'over') {
      order.push(activePlayer(s).id);
      s = drawCard(s);
      s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, true)), lookup), lookup, { cartoon: false, performer: false });
    }
    expect(order).toEqual(['p3', 'p1', 'p2', 'p3', 'p1', 'p2']);
    expect(s.phase.t === 'over' && s.phase.winners).toEqual(['p1', 'p2', 'p3']);
  });

  it('co-op: shared timeline, wrong answers cost lives, the team can lose', () => {
    let s = start({ mode: 'coop', startTokens: 1 });
    expect(s.team?.timeline).toHaveLength(1);
    expect(s.players.every((p) => p.timeline.length === 0)).toBe(true);
    s = drawCard(s);
    s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, false)), lookup), lookup, { cartoon: false, performer: false });
    expect(s.team?.tokens).toBe(0);
    expect(s.active).toBe(1);
    s = drawCard(s);
    s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, false)), lookup), lookup, { cartoon: false, performer: false });
    expect(s.phase).toEqual({ t: 'over', reason: 'coop-lost', winners: [] });
  });

  it('ending the game early lets the leaders win (nobody in co-op)', () => {
    let s = start({ tokens: false });
    s = drawCard(s);
    s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, true)), lookup), lookup, { cartoon: false, performer: false });
    const ended = abandonGame(s);
    expect(ended.phase).toEqual({ t: 'over', reason: 'ended', winners: ['p1'] });
    const coop = abandonGame(start({ mode: 'coop' }));
    expect(coop.phase).toEqual({ t: 'over', reason: 'ended', winners: [] });
  });

  it('ends the game when the deck runs out, leaders win', () => {
    let s = start({ tokens: false, target: 30 });
    let guard = 0;
    while (s.phase.t !== 'over' && guard++ < 500) {
      s = drawCard(s);
      const ok = guard % 3 === 0;
      s = resolveTurn(confirmPlacement(setSlot(s, slotFor(s, ok)), lookup), lookup, { cartoon: false, performer: false });
    }
    expect(s.phase.t === 'over' && s.phase.reason).toBe('deck');
    expect(s.deck).toHaveLength(0);
  });

  it('never loses or duplicates cards during a long random game', () => {
    let s = start({ target: 12 }, 1234);
    const rand = (() => {
      let x = 99;
      return () => (x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    })();
    let guard = 0;
    while (s.phase.t !== 'over' && guard++ < 1000) {
      if (s.phase.t === 'intro') {
        s = canBuy(s) && rand() < 0.1 ? buyCard(s, lookup) : drawCard(s);
        continue;
      }
      if (s.phase.t === 'listen') {
        if (canSkip(s) && rand() < 0.1) {
          s = skipCard(s);
          continue;
        }
        s = setSlot(s, Math.floor(rand() * (activeTimeline(s).length + 1)));
        s = confirmPlacement(s, lookup);
        continue;
      }
      if (s.phase.t === 'challenge') {
        const free = freeChallengeSlots(s);
        const p = s.players.find((x) => x.id !== activePlayer(s).id && x.tokens > 0);
        if (p && free.length && rand() < 0.5) s = addChallenge(s, p.id, free[Math.floor(rand() * free.length)]);
        s = reveal(s, lookup);
        continue;
      }
      if (s.phase.t === 'reveal') s = resolveTurn(s, lookup, { cartoon: rand() < 0.5, performer: rand() < 0.5 });
    }
    const pending = s.phase.t === 'over' ? [] : [];
    const all = [...s.deck, ...s.discard, ...s.players.flatMap((p) => p.timeline), ...pending];
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(songs.length);
    for (const p of s.players) {
      const ys = p.timeline.map(yearOf);
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      expect(p.tokens).toBeGreaterThanOrEqual(0);
      expect(p.tokens).toBeLessThanOrEqual(5);
    }
  });
});
