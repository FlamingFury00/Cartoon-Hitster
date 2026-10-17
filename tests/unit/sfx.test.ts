import { readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../src/assets/sfx/manifest.json';
import { preloadSfx, sfx } from '../../src/lib/audio/sfx';

const dir = new URL('../../src/assets/sfx/', import.meta.url);
const entries = Object.entries(manifest) as [string, { files: string[]; seconds: number[]; loop?: number[] }][];

describe('sound effects', () => {
  it('the manifest lists exactly the files that are bundled', () => {
    const listed = entries.flatMap(([, e]) => e.files).sort();
    const onDisk = readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort();
    expect(listed).toEqual(onDisk);
  });

  it('every file matches its duration in the manifest (96 kb/s MP3)', () => {
    for (const [, e] of entries) {
      expect(e.seconds).toHaveLength(e.files.length);
      e.files.forEach((f, i) => {
        const seconds = statSync(new URL(f, dir)).size / 12000; // bytes per second at 96 kb/s
        expect(Math.abs(seconds - e.seconds[i]), f).toBeLessThan(0.12);
      });
    }
  });

  it('the drum roll loops inside the sample', () => {
    const [start, end] = manifest.roll.loop;
    expect(start).toBeGreaterThan(0.2);
    expect(end - start).toBeGreaterThan(1);
    expect(end).toBeLessThan(manifest.roll.seconds[0]);
  });

  it('everything is silently skipped where Web Audio is missing', async () => {
    await expect(preloadSfx()).resolves.toBeUndefined();
    for (const [name, fn] of Object.entries(sfx)) {
      if (name !== 'drumroll') expect(() => (fn as () => void)()).not.toThrow();
    }
    expect(sfx.drumroll()).toBeNull();
  });
});
