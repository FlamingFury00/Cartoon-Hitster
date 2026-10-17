import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import theme from '../../src/assets/music/theme.json';
import { mp3Head } from '../../src/lib/audio/mp3';
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

  it('can be cut after its first seconds, on a frame', () => {
    const bytes = new Uint8Array(readFileSync(new URL(`../../src/assets/music/${theme.file}`, import.meta.url)));
    const head = mp3Head(bytes, 9)!;
    // The intro and the start of the loop, a sixth of the file.
    expect(head.seconds).toBeGreaterThan(theme.loop[0] + 2);
    expect(head.seconds).toBeLessThan(9.05);
    expect(Math.abs(head.size / 16000 - head.seconds)).toBeLessThan(0.05);
    // The cut falls between two frames: the next one starts there.
    expect([bytes[head.size], bytes[head.size + 1] & 0xfe]).toEqual([0xff, 0xfa]);
    // Every frame of the file is walked through, up to its very end.
    const all = mp3Head(bytes, theme.seconds)!;
    expect(bytes.length - all.size).toBeLessThan(1000);
    expect(mp3Head(bytes, theme.seconds + 1)).toBeNull();
  });
});

describe('mp3Head', () => {
  // MPEG-1 Layer III, 128 kb/s, 44.1 kHz: frames of 417 bytes (418 with padding), 1152 samples.
  const frame = (pad = 0) => [0xff, 0xfb, 0x90 | (pad << 1), 0x00, ...new Array(413 + pad).fill(0)];

  it('counts whole frames', () => {
    const bytes = new Uint8Array([...frame(), ...frame(1), ...frame()]);
    expect(mp3Head(bytes, 0.02)).toEqual({ size: 417, seconds: 1152 / 44100 });
    expect(mp3Head(bytes, 0.05)).toEqual({ size: 835, seconds: 2304 / 44100 });
    expect(mp3Head(bytes, 0.07)?.size).toBe(1252);
    expect(mp3Head(bytes, 0.08)).toBeNull();
  });

  it('gives up on anything else', () => {
    expect(mp3Head(new Uint8Array([0x49, 0x44, 0x33, 4, ...frame()]), 0.01)).toBeNull(); // ID3 tag first
    expect(mp3Head(new Uint8Array([0xff, 0xf3, 0x90, 0, ...frame()]), 0.01)).toBeNull(); // MPEG-2
    expect(mp3Head(new Uint8Array([0xff, 0xfb, 0xf0, 0, ...frame()]), 0.01)).toBeNull(); // bad bitrate
    expect(mp3Head(new Uint8Array(frame()).slice(0, 300), 0.01)).toBeNull(); // cut short
    expect(mp3Head(new Uint8Array(), 1)).toBeNull();
  });
});
