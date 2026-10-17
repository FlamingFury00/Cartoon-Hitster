import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import meta from '../../src/assets/music/theme.json' with { type: 'json' };
import { mp3Head } from '../../src/lib/audio/mp3';
import { audioAwake, firstTouch, isTheme, isWhole, recordSources, sources, themeOn, themeStarts } from './audio';
import { makeGame, mockMusic, seed } from './helpers';
import { toFinish, toFirstReveal } from './tutorial-steps';

// Headless Chromium keeps the audio asleep until a first touch, like a browser tab does.
// Where the platform lets the app sound right away (the Android app): theme-app.spec.ts.

test.beforeEach(async ({ page }) => {
  await mockMusic(page);
  await recordSources(page);
});

test('the main theme plays on the menus and stops for a game', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Nuova partita/ }).click();
  await expect.poll(() => themeOn(page)).toBe(true);
  await page.getByLabel('Nome del giocatore 1').fill('Anna');
  await page.getByLabel('Nome del giocatore 2').fill('Bruno');
  await page.getByRole('button', { name: /Si comincia/ }).click();
  await expect.poll(() => themeOn(page)).toBe(false);
});

test('in a browser the theme is ready at launch and starts on the very first touch', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  // Everything is decoded before the first touch (the effects come after the theme)…
  await audioAwake(page);
  // …but nothing sounds before it.
  expect(await themeStarts(page)).toBe(0);
  await page.getByText(/Ascolta, indovina/).click();
  await expect.poll(() => themeOn(page)).toBe(true);
  const touch = (await firstTouch(page))!;
  const first = (await sources(page)).find(isTheme)!;
  // The whole theme, from the top, at once: nothing left to download or decode.
  expect(isWhole(first)).toBe(true);
  expect(first.offset).toBe(0);
  expect(first.t - touch).toBeLessThan(150);
});

test('the theme gives way to the song previews and comes back after', async ({ page }) => {
  await seed(page, null);
  await page.goto('/');
  await page.getByRole('button', { name: /Come si gioca/ }).click();
  await expect.poll(() => themeOn(page)).toBe(true);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await page.getByRole('button', { name: /Le sigle/ }).click();
  await expect.poll(() => themeOn(page)).toBe(false);
  const starts = await themeStarts(page);
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect.poll(() => themeOn(page)).toBe(true);
  expect(await themeStarts(page)).toBeGreaterThan(starts);
});

test('no theme when the menu music is switched off', async ({ page }) => {
  await seed(page, null, { menuMusic: false });
  await page.goto('/');
  await page.getByRole('button', { name: /Come si gioca/ }).click();
  await audioAwake(page);
  expect(await themeStarts(page)).toBe(0);
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
  await expect.poll(() => themeOn(page)).toBe(true);
  // Back to the rules opened from the game: quiet again.
  await page.getByRole('button', { name: 'Indietro' }).click();
  await expect(page.getByRole('heading', { name: /Lo scopo/ })).toBeVisible();
  await expect.poll(() => themeOn(page)).toBe(false);
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
  expect(await themeStarts(page)).toBe(0);
});

test('the first seconds decode into exactly the first samples of the whole theme', async ({ page }) => {
  await seed(page, null);
  // The app downloads the theme at launch.
  const download = page.waitForResponse(/\/assets\/theme-[^/]*\.mp3$/);
  await page.goto('/');
  const url = (await download).url();
  const head = mp3Head(new Uint8Array(readFileSync(new URL(`../../src/assets/music/${meta.file}`, import.meta.url))), 9)!;
  const result = await page.evaluate(async ({ url, size }) => {
    const bytes = await (await fetch(url)).arrayBuffer();
    const out: Record<number, { seconds: number; differ: number }> = {};
    for (const rate of [44100, 48000]) {
      const ctx = new OfflineAudioContext(2, 1, rate);
      const part = await ctx.decodeAudioData(bytes.slice(0, size));
      const whole = await ctx.decodeAudioData(bytes.slice(0));
      let differ = 0;
      for (let c = 0; c < 2; c++) {
        const a = part.getChannelData(c);
        const b = whole.getChannelData(c);
        for (let i = 0; i < a.length - rate * 0.2; i++) if (a[i] !== b[i]) differ++;
      }
      out[rate] = { seconds: part.length / rate, differ };
    }
    return out;
  }, { url, size: head.size });
  for (const rate of [44100, 48000]) {
    expect(result[rate].seconds).toBeGreaterThan(head.seconds - 0.1);
    expect(result[rate].differ).toBe(0);
  }
});
