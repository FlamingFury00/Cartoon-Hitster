import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import theme from '../../src/assets/music/theme.json';
import { songsById } from '../../src/lib/deckdata';
import { insertSorted } from '../../src/lib/game/timeline';
import { BRUNO, TUTORIAL as T, YOU, rightSlot } from '../../src/lib/tutorial';

const yearOf = (id: string) => songsById.get(id)!.year;

describe('tutorial script', () => {
  it('uses cards of the deck, from different cartoons', () => {
    const ids = [T.start, T.first, T.second, ...T.rival, T.steal];
    for (const id of ids) expect(songsById.has(id), id).toBe(true);
    expect(new Set(ids.map((id) => songsById.get(id)!.cartoon)).size).toBe(ids.length);
    expect(new Set(ids.map(yearOf)).size).toBe(ids.length); // no ties: every answer is clear-cut
  });

  it('tells the story the guide tells', () => {
    // Guided: the first card goes above the starting one.
    expect(rightSlot([T.start], T.first, 0, yearOf)).toBe(true);
    expect(rightSlot([T.start], T.first, 1, yearOf)).toBe(false);
    // Alone: the second card goes in between.
    const mine = insertSorted([T.start], T.first, yearOf);
    expect(rightSlot(mine, T.second, 1, yearOf)).toBe(true);
    expect([0, 2].some((s) => rightSlot(mine, T.second, s, yearOf))).toBe(false);
    // Bruno's cards are in order, his placement is wrong and the middle slot is right.
    expect(insertSorted([T.rival[0]], T.rival[1], yearOf)).toEqual([...T.rival]);
    expect(rightSlot(T.rival, T.steal, T.rivalSlot, yearOf)).toBe(false);
    expect(rightSlot(T.rival, T.steal, 1, yearOf)).toBe(true);
    expect(rightSlot(T.rival, T.steal, 0, yearOf)).toBe(false);
  });

  it('the guide quotes the right years', () => {
    expect([yearOf(T.start), yearOf(T.first), yearOf(T.second)]).toEqual([1985, 1978, 1982]);
    expect([...T.rival.map(yearOf), yearOf(T.steal)]).toEqual([1987, 1999, 1995]);
    expect(YOU.avatar).not.toBe(BRUNO.avatar);
  });
});

describe('main theme', () => {
  it('loops inside the file, after a short intro', () => {
    const [start, end] = theme.loop;
    expect(start).toBeGreaterThan(1);
    expect(end - start).toBeGreaterThan(30);
    expect(end).toBeLessThan(theme.seconds);
    // 128 kb/s: 16000 bytes per second.
    const seconds = statSync(new URL(`../../src/assets/music/${theme.file}`, import.meta.url)).size / 16000;
    expect(Math.abs(seconds - theme.seconds)).toBeLessThan(0.15);
  });
});
