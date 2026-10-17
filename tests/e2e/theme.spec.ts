import { expect, test, type Page } from '@playwright/test';
import meta from '../../src/assets/music/theme.json' with { type: 'json' };
import manifest from '../../src/assets/sfx/manifest.json' with { type: 'json' };
import { makeGame, mockMusic, seed } from './helpers';
import { toFinish, toFirstReveal } from './tutorial-steps';

type Source = { duration: number; loop: boolean; stopped: boolean };

/** Records every Web Audio source the page starts, and whether it was stopped. */
async function recordSources(page: Page) {
  await page.addInitScript(() => {
    const log: { duration: number; loop: boolean; stopped: boolean }[] = [];
    const entries = new WeakMap<AudioBufferSourceNode, (typeof log)[number]>();
    (window as unknown as { __sources: typeof log }).__sources = log;
    const { start, stop } = AudioBufferSourceNode.prototype;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<typeof start>) {
      const e = { duration: this.buffer?.duration ?? 0, loop: this.loop, stopped: false };
      log.push(e);
      entries.set(this, e);
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (this: AudioBufferSourceNode, ...args: Parameters<typeof stop>) {
      const e = entries.get(this);
      if (e) e.stopped = true;
      return stop.apply(this, args);
    };
  });
}

/** For each time the theme started: whether it has been stopped since. */
const themes = async (page: Page) =>
  (await page.evaluate(() => (window as unknown as { __sources: Source[] }).__sources))
    .filter((s) => s.loop && Math.abs(s.duration - meta.seconds) < 0.01)
    .map((s) => s.stopped);

/** Resolves once the sound effects are decoded: by then the theme would have started too. */
async function audioAwake(page: Page) {
  const files = Object.values(manifest).flatMap((e) => e.files).length;
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/assets\/[^/]+\.mp3$/.test(e.name)).length))
    .toBeGreaterThanOrEqual(files);
}

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
  await recordSources(page);
});

test('the main theme plays on the menus and stops for a game', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Nuova partita/ }).click();
  await expect.poll(() => themes(page)).toEqual([false]);
  await page.getByLabel('Nome del giocatore 1').fill('Anna');
  await page.getByLabel('Nome del giocatore 2').fill('Bruno');
  await page.getByRole('button', { name: /Si comincia/ }).click();
  await expect.poll(() => themes(page)).toEqual([true]);
});

test('the theme gives way to the song previews and comes back after', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Come si gioca/ }).click();
  await expect.poll(() => themes(page)).toEqual([false]);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: /Le sigle/ }).click();
  await expect.poll(() => themes(page)).toEqual([true]);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect.poll(() => themes(page)).toEqual([true, false]);
});

test('no theme when the menu music is switched off', async ({ page }) => {
  await seed(page, null, { menuMusic: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Come si gioca/ }).click();
  await audioAwake(page);
  expect(await themes(page)).toEqual([]);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((e) => /theme-[^/]*\.mp3$/.test(e.name)))).toBe(false);
});

test('the rules of a running game stay quiet, the setup reached from there does not', async ({ page }) => {
  await seed(page, makeGame());
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await page.getByRole('button', { name: 'Menu di pausa' }).click();
  await page.getByRole('button', { name: /Regole/ }).click();
  await page.getByRole('button', { name: /tutorial interattivo/ }).click();
  await toFirstReveal(page);
  await toFinish(page);
  await page.getByRole('button', { name: /Gioca una partita/ }).click();
  await expect.poll(() => themes(page)).toEqual([false]);
  // Back to the rules opened from the game: quiet again.
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('heading', { name: /Lo scopo/ })).toBeVisible();
  await expect.poll(() => themes(page)).toEqual([true]);
});

test('no theme on the rules opened from a running game', async ({ page }) => {
  await seed(page, makeGame());
  await page.goto('/');
  await page.getByRole('button', { name: /Riprendi la partita/ }).click();
  await audioAwake(page);
  await page.getByRole('button', { name: 'Menu di pausa' }).click();
  await page.getByRole('button', { name: /Regole/ }).click();
  await expect(page.getByRole('heading', { name: /Lo scopo/ })).toBeVisible();
  await page.waitForTimeout(800);
  expect(await themes(page)).toEqual([]);
});
