import { expect, test, type Page } from '@playwright/test';
import manifest from '../../src/assets/sfx/manifest.json' with { type: 'json' };
import { makeGame, mockMusic, seed } from './helpers';

// The full reveal (drum roll, then the card turns) only runs with animations on.
test.use({ contextOptions: { reducedMotion: 'no-preference' } });

type Played = { duration: number; loop: boolean };

/** Records every Web Audio source the page starts (decoded length and loop flag). */
async function recordSounds(page: Page) {
  await page.addInitScript(() => {
    const log: { duration: number; loop: boolean }[] = [];
    (window as unknown as { __sounds: typeof log }).__sounds = log;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<typeof start>) {
      log.push({ duration: this.buffer?.duration ?? 0, loop: this.loop });
      return start.apply(this, args);
    };
  });
}

const played = (page: Page) => page.evaluate(() => (window as unknown as { __sounds: Played[] }).__sounds);

/** Which effect a played buffer is (by its length), or null for music and silence. */
function effect(p: Played): string | null {
  for (const [name, e] of Object.entries(manifest)) if (e.seconds.some((s) => Math.abs(s - p.duration) < 0.004)) return name;
  return null;
}

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
  await recordSounds(page);
});

test('every sound effect is bundled and decodes', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.mp3') && r.url().includes('/assets/') && !r.ok()) failed.push(r.url());
  });
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Nuova partita/ }).click();
  const files = Object.values(manifest).flatMap((e) => e.files).length;
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/assets\/[^/]+\.mp3$/.test(e.name)).length))
    .toBe(files);
  expect(failed).toEqual([]);
  // The very first tap already has its sound (a "pop"), even though the audio was asleep.
  await expect.poll(async () => (await played(page)).map(effect)).toContain('pop');
});

test('a turn sounds like a game show: draw, place, drum roll, cymbal, verdict', async ({ page }) => {
  await seed(page, makeGame({ tokens: false }));
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByRole('button', { name: /Avanti/ })).toBeVisible();

  await expect
    .poll(async () => (await played(page)).map(effect).filter((n) => n !== null))
    .toEqual(expect.arrayContaining(['draw', 'place', 'roll', 'crash']));
  const names = (await played(page)).map(effect).filter((n): n is string => n !== null);
  const verdict = names.findIndex((n) => n === 'correct' || n === 'wrong');
  expect(verdict).toBeGreaterThan(-1);
  // In order, and the roll is the looping sample.
  expect(names.indexOf('draw')).toBeLessThan(names.indexOf('place'));
  expect(names.indexOf('place')).toBeLessThan(names.indexOf('roll'));
  expect(names.indexOf('roll')).toBeLessThan(names.indexOf('crash'));
  expect(names.indexOf('crash')).toBeLessThan(verdict);
  expect((await played(page)).find((p) => effect(p) === 'roll')?.loop).toBe(true);
});

test('no sound effects when they are switched off', async ({ page }) => {
  await seed(page, makeGame({ tokens: false }), { sfx: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: /Pesca la sigla/ }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Metti la carta in questa posizione' }).first().click();
  await page.getByRole('button', { name: /Conferma/ }).click();
  await expect(page.getByRole('button', { name: /Avanti/ })).toBeVisible();
  expect((await played(page)).map(effect).filter((n) => n !== null)).toEqual([]);
});
